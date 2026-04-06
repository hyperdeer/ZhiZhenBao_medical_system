# -*- coding: utf-8 -*-
"""多模态 messages 构造与历史裁剪。"""

from __future__ import annotations

import base64
import copy
from typing import Any, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from config import MAX_USER_TURNS, SYSTEM_PROMPT

# 百炼拉取部分公网 URL 时要求源站返回 Content-Length；分块传输站点会报
# Missing Content-Length of multimodal url，因此在客户端先下载再传 data URI。
MAX_IMAGE_BYTES = 15 * 1024 * 1024


def system_role_multimodal() -> dict:
    """多模态接口中 system 的 content 须为列表格式。"""
    return {"role": "system", "content": [{"text": SYSTEM_PROMPT}]}


def _http_url_to_data_uri(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; patient-medical-qa/1.0)",
        },
    )
    try:
        with urlopen(req, timeout=90) as resp:  # noqa: S310 — 仅用于用户显式传入的 URL
            raw = resp.read(MAX_IMAGE_BYTES + 1)
            headers = resp.headers
    except (HTTPError, URLError) as e:
        raise RuntimeError(f"无法下载图片 URL: {e}") from e

    if len(raw) > MAX_IMAGE_BYTES:
        raise RuntimeError(
            f"图片超过 {MAX_IMAGE_BYTES // (1024 * 1024)}MB，请改用本地路径或更小文件"
        )
    ctype = headers.get("Content-Type", "image/jpeg")
    mime = ctype.split(";")[0].strip().lower() if ctype else "image/jpeg"
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    b64 = base64.standard_b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def normalize_multimodal_image(ref: str) -> str:
    """http(s) 预取为 data URI；已是 data: 或本地路径则原样返回。"""
    ref = ref.strip()
    if ref.startswith("data:"):
        return ref
    if ref.startswith("http://") or ref.startswith("https://"):
        return _http_url_to_data_uri(ref)
    return ref


def build_user_content(text: str, image: Optional[str] = None) -> List[dict]:
    """
    image: 公网 URL、本地绝对路径，或 data:image/...;base64,... 格式。
    与文档一致：content 为多段 text/image。
    """
    parts: List[dict] = []
    if image:
        parts.append({"image": normalize_multimodal_image(image)})
    parts.append({"text": text})
    return parts


def trim_history(messages: List[dict], max_user_turns: int = MAX_USER_TURNS) -> List[dict]:
    """保留 system（若有），仅保留最近 max_user_turns 次用户提问及其助手回复。"""
    if not messages:
        return messages

    out = copy.deepcopy(messages)
    system_msgs = [m for m in out if m.get("role") == "system"]
    rest = [m for m in out if m.get("role") != "system"]

    user_indices = [i for i, m in enumerate(rest) if m.get("role") == "user"]
    if len(user_indices) <= max_user_turns:
        return system_msgs + rest

    cut = user_indices[len(user_indices) - max_user_turns]
    trimmed = rest[cut:]
    return system_msgs + trimmed


def assistant_message_from_text(text: str) -> dict:
    """写入下一轮上下文时 assistant 的消息结构（与多模态 message 格式一致）。"""
    return {"role": "assistant", "content": [{"text": text}]}


def extract_stream_text_chunk(choice: Any) -> str:
    """从单次流式 choice 中解析增量文本。"""
    msg = getattr(choice, "message", None)
    if msg is None and isinstance(choice, dict):
        msg = choice.get("message")
    if not msg:
        return ""
    content = getattr(msg, "content", None)
    if content is None and isinstance(msg, dict):
        content = msg.get("content")
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for piece in content:
            if isinstance(piece, dict) and piece.get("text"):
                parts.append(piece["text"])
        return "".join(parts)
    return ""
