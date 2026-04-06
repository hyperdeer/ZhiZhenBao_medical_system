# -*- coding: utf-8 -*-
"""调用百炼 qwen3.5-plus：多模态 + 流式。"""

from __future__ import annotations

from typing import Callable, List, Optional

from dashscope import MultiModalConversation

from config import MODEL, api_key
from messages import extract_stream_text_chunk


OptionalErrorCallback = Optional[Callable[[str], None]]


def iter_chat_deltas(
    messages: List[dict],
    *,
    on_error: OptionalErrorCallback = None,
):
    """同步迭代流式增量文本（供 SSE 等场景使用）。"""
    key = api_key()
    try:
        responses = MultiModalConversation.call(
            model=MODEL,
            messages=messages,
            api_key=key,
            stream=True,
            incremental_output=True,
            result_format="message",
        )
    except Exception as e:  # noqa: BLE001
        if on_error:
            on_error(str(e))
        raise

    for resp in responses:
        if resp.status_code != 200:
            err = getattr(resp, "message", None) or str(resp)
            if on_error:
                on_error(err)
            raise RuntimeError(err)
        code = getattr(resp, "code", None)
        if code not in (None, "", "Success", "success"):
            err = f"{code}: {getattr(resp, 'message', '')}"
            if on_error:
                on_error(err)
            raise RuntimeError(err)
        choices = getattr(resp.output, "choices", None) if resp.output else None
        if not choices:
            continue
        delta = extract_stream_text_chunk(choices[0])
        if delta:
            yield delta


def stream_chat(
    messages: List[dict],
    on_delta: Callable[[str], None],
    *,
    on_error: OptionalErrorCallback = None,
) -> str:
    """
    流式调用，将增量文本交给 on_delta；返回完整助手回复文本（用于写入历史）。
    """
    full = ""
    for delta in iter_chat_deltas(messages, on_error=on_error):
        full += delta
        on_delta(delta)
    return full
