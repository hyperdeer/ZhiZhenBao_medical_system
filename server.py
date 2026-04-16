# -*- coding: utf-8 -*-
"""Web UI 后端：静态页 + 认证 + 流式对话 API。"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import random
import secrets
import shutil
import sqlite3
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from client import iter_chat_deltas
from config import MAX_USER_TURNS
from messages import assistant_message_from_text, build_user_content, system_role_multimodal

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DB_PATH = ROOT / "app.db"
DEFAULT_AVATAR_REL_PATH = "/assets/picture.webp"
DEFAULT_AVATAR_FILE = WEB / "picture.webp"
FALLBACK_AVATAR_SOURCE = ROOT.parent.parent.parent / "assets" / "picture.webp"

SESSION_COOKIE = "medqa_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600
CAPTCHA_TTL_SECONDS = 5 * 60
DEFAULT_DEMO_USERNAME = "demo_user"
DEFAULT_DEMO_PASSWORD = "Demo@123456"
DEFAULT_DEMO_NICKNAME = "演示用户"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0").strip().lower() in {"1", "true", "yes", "on"}

app = FastAPI(title="Patient Medical QA")
app.mount("/assets", StaticFiles(directory=str(WEB)), name="assets")

_db_lock = threading.Lock()
_session_lock = threading.Lock()
_captcha_lock = threading.Lock()

# run_in_threadpool(next, gen) 在耗尽时会把 StopIteration 传入协程，Python 3.7+ 会报错
# “coroutine raised StopIteration”。在线程内吞掉 StopIteration，用哨标结束流。
_STREAM_DONE = object()
_sessions: Dict[str, Dict[str, int]] = {}
_captchas: Dict[str, Dict[str, str | int]] = {}


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
    session_id: Optional[str] = None


class AuthRegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str
    nickname: str
    captcha_id: str
    captcha_answer: str


class AuthLoginRequest(BaseModel):
    username: str
    password: str
    captcha_id: str
    captcha_answer: str


class StoredMessage(BaseModel):
    role: str
    content: str
    image: Optional[str] = None


class AuthProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_new_password: Optional[str] = None
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None


class AuthDeleteAccountRequest(BaseModel):
    confirm: Optional[bool] = True


def _db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    ensure_default_avatar_asset()
    with _db_lock:
        conn = _db_conn()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    nickname TEXT NOT NULL,
                    avatar_url TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image TEXT,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chat_records_user_session_time
                ON chat_records (user_id, session_id, created_at)
                """
            )
            now = _now_ts()
            existed = conn.execute("SELECT id FROM users WHERE username = ?", (DEFAULT_DEMO_USERNAME,)).fetchone()
            if not existed:
                conn.execute(
                    """
                    INSERT INTO users (username, password_hash, nickname, avatar_url, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        DEFAULT_DEMO_USERNAME,
                        _hash_password(DEFAULT_DEMO_PASSWORD),
                        DEFAULT_DEMO_NICKNAME,
                        DEFAULT_AVATAR_REL_PATH,
                        now,
                        now,
                    ),
                )
            conn.commit()
        finally:
            conn.close()


def _now_ts() -> int:
    return int(time.time())


def ensure_default_avatar_asset() -> None:
    if DEFAULT_AVATAR_FILE.is_file():
        return
    src = FALLBACK_AVATAR_SOURCE
    if src.is_file():
        try:
            shutil.copyfile(src, DEFAULT_AVATAR_FILE)
        except Exception:  # noqa: BLE001
            pass


def _avatar_or_default(value: Optional[str]) -> str:
    v = (value or "").strip()
    return v or DEFAULT_AVATAR_REL_PATH


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except Exception:  # noqa: BLE001
        return False
    got = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return secrets.compare_digest(got, expected)


def _cleanup_stores() -> None:
    now = _now_ts()
    with _session_lock:
        expired_sessions = [sid for sid, v in _sessions.items() if int(v["expires_at"]) < now]
        for sid in expired_sessions:
            _sessions.pop(sid, None)
    with _captcha_lock:
        expired_captcha = [cid for cid, v in _captchas.items() if int(v["expires_at"]) < now]
        for cid in expired_captcha:
            _captchas.pop(cid, None)


def _random_captcha_text(length: int = 4) -> str:
    # 参考常见图形验证码做法：排除 0/O/1/I 等易混淆字符
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"
    return "".join(random.choice(alphabet) for _ in range(length))


def _captcha_png_data(code: str) -> str:
    width, height = 120, 40
    image = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(image)

    for x in range(width):
        for y in range(height):
            if random.random() < 0.02:
                draw.point((x, y), fill=(random.randint(120, 255), random.randint(120, 255), random.randint(120, 255)))

    for _ in range(5):
        x1, y1 = random.randint(0, width - 1), random.randint(0, height - 1)
        x2, y2 = random.randint(0, width - 1), random.randint(0, height - 1)
        draw.line((x1, y1, x2, y2), fill=(random.randint(100, 180), random.randint(100, 180), random.randint(100, 180)), width=1)

    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()

    char_width = width // max(len(code), 1)
    for i, ch in enumerate(code):
        color = (random.randint(30, 120), random.randint(30, 120), random.randint(30, 120))
        offset_x = i * char_width + random.randint(4, 10)
        offset_y = random.randint(4, 12)
        draw.text((offset_x, offset_y), ch, fill=color, font=font)

    image = image.filter(ImageFilter.EDGE_ENHANCE_MORE)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _new_captcha() -> dict:
    cid = secrets.token_urlsafe(16)
    answer = _random_captcha_text(4)
    with _captcha_lock:
        _captchas[cid] = {"answer": answer, "expires_at": _now_ts() + CAPTCHA_TTL_SECONDS}
    return {"captcha_id": cid, "image_data": _captcha_png_data(answer)}


def _verify_captcha(captcha_id: str, user_answer: str) -> bool:
    _cleanup_stores()
    with _captcha_lock:
        row = _captchas.pop(captcha_id, None)
    if not row:
        return False
    answer = str(row["answer"]).strip().lower()
    return answer == user_answer.strip().lower()


def _create_session(user_id: int) -> str:
    _cleanup_stores()
    sid = secrets.token_urlsafe(24)
    with _session_lock:
        _sessions[sid] = {"user_id": user_id, "expires_at": _now_ts() + SESSION_TTL_SECONDS}
    return sid


def _delete_session(session_id: Optional[str]) -> None:
    if not session_id:
        return
    with _session_lock:
        _sessions.pop(session_id, None)


def _resolve_user_id_from_request(request: Request) -> Optional[int]:
    _cleanup_stores()
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        return None
    with _session_lock:
        row = _sessions.get(sid)
        if not row:
            return None
        if int(row["expires_at"]) < _now_ts():
            _sessions.pop(sid, None)
            return None
        return int(row["user_id"])


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


def _insert_chat_record(
    user_id: int,
    session_id: str,
    role: str,
    content: str,
    image: Optional[str] = None,
) -> None:
    with _db_lock:
        conn = _db_conn()
        try:
            conn.execute(
                """
                INSERT INTO chat_records (user_id, session_id, role, content, image, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, session_id, role, content, image, _now_ts()),
            )
            conn.commit()
        finally:
            conn.close()


def _list_user_sessions(user_id: int) -> List[dict]:
    with _db_lock:
        conn = _db_conn()
        try:
            rows = conn.execute(
                """
                SELECT session_id, MAX(created_at) AS last_ts
                FROM chat_records
                WHERE user_id = ?
                GROUP BY session_id
                ORDER BY last_ts DESC
                """,
                (user_id,),
            ).fetchall()
            out: List[dict] = []
            for row in rows:
                sid = str(row["session_id"])
                first_user = conn.execute(
                    """
                    SELECT content FROM chat_records
                    WHERE user_id = ? AND session_id = ? AND role = 'user'
                    ORDER BY id ASC
                    LIMIT 1
                    """,
                    (user_id, sid),
                ).fetchone()
                title = "新对话"
                if first_user and first_user["content"]:
                    raw = str(first_user["content"]).strip()
                    title = (raw[:18] + "…") if len(raw) > 18 else (raw or "新对话")
                out.append({"id": sid, "title": title, "last_ts": int(row["last_ts"] or 0)})
            return out
        finally:
            conn.close()


def _get_user_session_messages(user_id: int, session_id: str) -> List[StoredMessage]:
    with _db_lock:
        conn = _db_conn()
        try:
            rows = conn.execute(
                """
                SELECT role, content, image
                FROM chat_records
                WHERE user_id = ? AND session_id = ?
                ORDER BY id ASC
                """,
                (user_id, session_id),
            ).fetchall()
            return [
                StoredMessage(
                    role=str(r["role"]),
                    content=str(r["content"] or ""),
                    image=(str(r["image"]) if r["image"] else None),
                )
                for r in rows
            ]
        finally:
            conn.close()


def _delete_all_sessions_for_user(user_id: int) -> None:
    with _session_lock:
        dead = [sid for sid, v in _sessions.items() if int(v.get("user_id", 0)) == user_id]
        for sid in dead:
            _sessions.pop(sid, None)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
async def index():
    p = WEB / "index.html"
    if not p.is_file():
        raise HTTPException(404, "web/index.html missing")
    return FileResponse(p, media_type="text/html; charset=utf-8")


@app.get("/settings")
@app.get("/settings/nickname")
@app.get("/settings/password")
@app.get("/settings/clear-history")
@app.get("/settings/delete-account")
async def settings_index():
    p = WEB / "index.html"
    if not p.is_file():
        raise HTTPException(404, "web/index.html missing")
    return FileResponse(p, media_type="text/html; charset=utf-8")


@app.get("/api/auth/captcha")
async def auth_captcha():
    return _new_captcha()


@app.post("/api/auth/register")
async def auth_register(payload: AuthRegisterRequest):
    username = payload.username.strip()
    nickname = payload.nickname.strip()
    if len(username) < 3 or len(payload.password) < 6:
        raise HTTPException(400, "账号至少3位，密码至少6位")
    if payload.password != payload.confirm_password:
        raise HTTPException(400, "两次密码不一致")
    if not nickname:
        raise HTTPException(400, "昵称不能为空")
    if not _verify_captcha(payload.captcha_id, payload.captcha_answer):
        raise HTTPException(400, "验证码错误或已过期")

    now = _now_ts()
    with _db_lock:
        conn = _db_conn()
        try:
            existed = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            if existed:
                raise HTTPException(400, "账号已存在")
            conn.execute(
                """
                INSERT INTO users (username, password_hash, nickname, avatar_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (username, _hash_password(payload.password), nickname, DEFAULT_AVATAR_REL_PATH, now, now),
            )
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


@app.post("/api/auth/login")
async def auth_login(payload: AuthLoginRequest, response: Response):
    if not _verify_captcha(payload.captcha_id, payload.captcha_answer):
        raise HTTPException(400, "验证码错误或已过期")

    username = payload.username.strip()
    with _db_lock:
        conn = _db_conn()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash, nickname, avatar_url FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        finally:
            conn.close()
    if not row or not _verify_password(payload.password, str(row["password_hash"])):
        raise HTTPException(400, "账号或密码错误")

    sid = _create_session(int(row["id"]))
    response.set_cookie(
        SESSION_COOKIE,
        sid,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        secure=COOKIE_SECURE,
        path="/",
    )
    return {
        "ok": True,
        "user": {
            "id": int(row["id"]),
            "username": row["username"],
            "nickname": row["nickname"],
            "avatar_url": _avatar_or_default(row["avatar_url"]),
        },
    }


@app.post("/api/auth/logout")
async def auth_logout(request: Request, response: Response):
    sid = request.cookies.get(SESSION_COOKIE)
    _delete_session(sid)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
async def auth_me(request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        return {"logged_in": False}
    with _db_lock:
        conn = _db_conn()
        try:
            row = conn.execute(
                "SELECT id, username, nickname, avatar_url FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
    if not row:
        return {"logged_in": False}
    return {
        "logged_in": True,
        "user": {
            "id": int(row["id"]),
            "username": row["username"],
            "nickname": row["nickname"],
            "avatar_url": _avatar_or_default(row["avatar_url"]),
        },
    }


@app.post("/api/auth/profile")
async def auth_update_profile(payload: AuthProfileUpdateRequest, request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录")

    with _db_lock:
        conn = _db_conn()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash, nickname, avatar_url FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if not row:
                raise HTTPException(401, "用户不存在")

            nickname = (payload.nickname or str(row["nickname"] or "")).strip()
            avatar_url = (payload.avatar_url if payload.avatar_url is not None else str(row["avatar_url"] or "")).strip()
            if not nickname:
                raise HTTPException(400, "昵称不能为空")
            avatar_url = _avatar_or_default(avatar_url)

            password_hash = str(row["password_hash"])
            need_change_password = bool(payload.new_password or payload.confirm_new_password or payload.old_password)
            if need_change_password:
                old_password = (payload.old_password or "").strip()
                new_password = (payload.new_password or "").strip()
                confirm_new = (payload.confirm_new_password or "").strip()
                captcha_id = (payload.captcha_id or "").strip()
                captcha_answer = (payload.captcha_answer or "").strip()
                if not old_password or not new_password or not confirm_new:
                    raise HTTPException(400, "修改密码请填写旧密码、新密码和确认新密码")
                if not captcha_id or not captcha_answer:
                    raise HTTPException(400, "修改密码请填写验证码")
                if not _verify_captcha(captcha_id, captcha_answer):
                    raise HTTPException(400, "验证码错误或已过期")
                if not _verify_password(old_password, password_hash):
                    raise HTTPException(400, "旧密码错误")
                if new_password != confirm_new:
                    raise HTTPException(400, "两次新密码不一致")
                if old_password == new_password:
                    raise HTTPException(400, "新密码不能与上次相同")
                if len(new_password) < 6:
                    raise HTTPException(400, "新密码至少6位")
                password_hash = _hash_password(new_password)

            now = _now_ts()
            conn.execute(
                """
                UPDATE users
                SET nickname = ?, avatar_url = ?, password_hash = ?, updated_at = ?
                WHERE id = ?
                """,
                (nickname, avatar_url, password_hash, now, user_id),
            )
            conn.commit()
        finally:
            conn.close()

    return {
        "ok": True,
        "user": {
            "id": user_id,
            "username": row["username"],
            "nickname": nickname,
            "avatar_url": avatar_url,
        },
    }


@app.get("/api/chat/sessions")
async def list_chat_sessions(request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录")
    return {"sessions": _list_user_sessions(user_id)}


@app.get("/api/chat/session/{session_id}")
async def get_chat_session(session_id: str, request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录")
    messages = _get_user_session_messages(user_id, session_id)
    if not messages:
        raise HTTPException(404, "会话不存在")
    return {"id": session_id, "messages": [m.model_dump() for m in messages]}


@app.post("/api/chat/clear")
async def clear_chat_sessions(request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录")
    with _db_lock:
        conn = _db_conn()
        try:
            conn.execute("DELETE FROM chat_records WHERE user_id = ?", (user_id,))
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


@app.post("/api/auth/delete-account")
async def delete_account(payload: AuthDeleteAccountRequest, request: Request, response: Response):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录")
    if not payload.confirm:
        raise HTTPException(400, "请确认删除账号")

    with _db_lock:
        conn = _db_conn()
        try:
            conn.execute("DELETE FROM chat_records WHERE user_id = ?", (user_id,))
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
        finally:
            conn.close()

    sid = request.cookies.get(SESSION_COOKIE)
    _delete_session(sid)
    _delete_all_sessions_for_user(user_id)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    user_id = _resolve_user_id_from_request(request)
    if not user_id:
        raise HTTPException(401, "请先登录后再使用对话功能")
    if not req.messages:
        raise HTTPException(400, "messages 不能为空")

    trimmed = trim_plain_history(req.messages)
    if trimmed[-1].role != "user":
        raise HTTPException(400, "最后一条须为用户消息")

    ds_messages = plain_to_dashscope(trimmed)
    it = iter(iter_chat_deltas(ds_messages))
    client_session_id = (req.session_id or "").strip() or "default"
    last_user = trimmed[-1]

    async def event_gen():
        full = ""
        stream_error = ""
        while True:
            try:
                delta = await run_in_threadpool(_next_delta_or_end, it)
            except Exception as e:  # noqa: BLE001
                stream_error = str(e)
                yield f"data: {json.dumps({'error': stream_error}, ensure_ascii=False)}\n\n"
                break
            if delta is _STREAM_DONE:
                yield "data: [DONE]\n\n"
                break
            full += str(delta)
            line = json.dumps({"delta": delta}, ensure_ascii=False)
            yield f"data: {line}\n\n"

        if user_id:
            _insert_chat_record(
                user_id=user_id,
                session_id=client_session_id,
                role="user",
                content=last_user.content or "",
                image=last_user.image,
            )
            assistant_text = full or (f"[请求失败] {stream_error}" if stream_error else "（模型未返回内容）")
            _insert_chat_record(
                user_id=user_id,
                session_id=client_session_id,
                role="assistant",
                content=assistant_text,
                image=None,
            )

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
