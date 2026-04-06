# -*- coding: utf-8 -*-
"""
会话状态：最多 MAX_USER_TURNS 轮用户提问。
完整多轮（含用户原文）保留在 _messages；调用模型时用 api_messages() 再截断上下文。
"""

from __future__ import annotations

from typing import List, Optional

from config import MAX_USER_TURNS
from messages import (
    assistant_message_from_text,
    build_user_content,
    system_role_multimodal,
    trim_history,
)


class PatientQASession:
    def __init__(self) -> None:
        self._messages: List[dict] = [system_role_multimodal()]
        self._user_turns = 0

    @property
    def user_turns(self) -> int:
        return self._user_turns

    @property
    def messages(self) -> List[dict]:
        return self._messages

    def can_accept_user_message(self) -> bool:
        return self._user_turns < MAX_USER_TURNS

    def append_user(self, text: str, image: Optional[str] = None) -> None:
        if not self.can_accept_user_message():
            raise RuntimeError(
                f"已达到连续对话上限（{MAX_USER_TURNS} 次用户提问），请开启新会话。"
            )
        self._messages.append(
            {"role": "user", "content": build_user_content(text, image)}
        )
        self._user_turns += 1

    def append_assistant(self, text: str) -> None:
        self._messages.append(assistant_message_from_text(text))

    def api_messages(self) -> List[dict]:
        """调用大模型时使用：在完整保留的会话上按轮次裁剪，控制上下文长度。"""
        return trim_history(self._messages, MAX_USER_TURNS)
