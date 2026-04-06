# -*- coding: utf-8 -*-
"""
简易 CLI：支持文本与可选图像（路径 / URL / data URI），流式打印。
依赖环境变量：DASHSCOPE_API_KEY

用法示例：
  python main.py
  python main.py --one-shot -i https://example.com/x.png
"""

from __future__ import annotations

import argparse
import sys

from client import stream_chat
from config import MAX_USER_TURNS
from session import PatientQASession


def main() -> None:
    parser = argparse.ArgumentParser(
        description="患者医疗问答（百炼 qwen3.5-plus，多模态 + 流式）"
    )
    parser.add_argument(
        "--image",
        "-i",
        default=None,
        help="可选默认图：首轮在未手动填图时使用；本地路径、URL 或 data URI",
    )
    parser.add_argument(
        "--one-shot",
        action="store_true",
        help="单轮问答后退出",
    )
    args = parser.parse_args()

    session = PatientQASession()

    def run_turn(text: str, image: str | None) -> None:
        session.append_user(text, image)
        print("\n助手: ", end="", flush=True)

        def on_delta(s: str) -> None:
            print(s, end="", flush=True)

        try:
            full = stream_chat(session.api_messages(), on_delta)
        except RuntimeError as e:
            print(f"\n请求失败: {e}", file=sys.stderr)
            session.append_assistant(f"[本次回复失败] {e}")
            return
        print()
        session.append_assistant(full or "（模型未返回内容）")

    if args.one_shot:
        text = input("您的问题: ").strip()
        if not text:
            print("未输入问题。")
            return
        run_turn(text, args.image)
        return

    print(
        f"交互模式：最多 {MAX_USER_TURNS} 次提问；问题为空行则退出。\n"
        "每轮可先指定图片（可选），再输入问题；首轮也可依赖启动参数 -i。"
    )
    first_round = True
    while session.can_accept_user_message():
        raw_img = input("\n图片路径或 URL（可选，直接回车跳过）: ").strip()
        image = raw_img or None
        if first_round and image is None and args.image:
            image = args.image
        first_round = False

        text = input("您的问题: ").strip()
        if not text:
            print("再见。")
            break

        run_turn(text, image)

    if not session.can_accept_user_message():
        print(f"\n已达 {MAX_USER_TURNS} 次提问上限。")


if __name__ == "__main__":
    main()
