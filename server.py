# -*- coding: utf-8 -*-
"""Web UI 后端：静态页 + 流式对话 API。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from client import iter_chat_deltas
from config import MAX_USER_TURNS
from messages import assistant_message_from_text, build_user_content, system_role_multimodal

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"

app = FastAPI(title="Patient Medical QA")
app.mount("/assets", StaticFiles(directory=str(WEB)), name="assets")

# run_in_threadpool(next, gen) 在耗尽时会把 StopIteration 传入协程，Python 3.7+ 会报错
# “coroutine raised StopIteration”。在线程内吞掉 StopIteration，用哨标结束流。
_STREAM_DONE = object()


def _next_delta_or_end(gen_iter):
    try:
        return next(gen_iter)
    except StopIteration:
        return _STREAM_DONE


class ChatMessage(BaseModel):
    role: str
    content: str = ""
    image: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)


def trim_plain_history(messages: List[ChatMessage]) -> List[ChatMessage]:
    plain = [m for m in messages if m.role in ("user", "assistant")]
    idxs = [i for i, m in enumerate(plain) if m.role == "user"]
    if len(idxs) <= MAX_USER_TURNS:
        return plain
    start = idxs[len(idxs) - MAX_USER_TURNS :][0]
    return plain[start:]


def plain_to_dashscope(plain: List[ChatMessage]) -> List[dict]:
    out: List[dict] = [system_role_multimodal()]
    for m in plain:
        if m.role == "user":
            out.append(
                {
                    "role": "user",
                    "content": build_user_content(m.content or "", m.image),
                }
            )
        elif m.role == "assistant":
            out.append(assistant_message_from_text(m.content or ""))
    return out


@app.get("/")
async def index():
    p = WEB / "index.html"
    if not p.is_file():
        raise HTTPException(404, "web/index.html missing")
    return FileResponse(p, media_type="text/html; charset=utf-8")


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    if not req.messages:
        raise HTTPException(400, "messages 不能为空")

    trimmed = trim_plain_history(req.messages)
    if trimmed[-1].role != "user":
        raise HTTPException(400, "最后一条须为用户消息")

    ds_messages = plain_to_dashscope(trimmed)
    it = iter(iter_chat_deltas(ds_messages))

    async def event_gen():
        while True:
            try:
                delta = await run_in_threadpool(_next_delta_or_end, it)
            except Exception as e:  # noqa: BLE001
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
                break
            if delta is _STREAM_DONE:
                yield "data: [DONE]\n\n"
                break
            line = json.dumps({"delta": delta}, ensure_ascii=False)
            yield f"data: {line}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
