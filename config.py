# -*- coding: utf-8 -*-
"""百炼 DashScope 多模态对话参数（与官方文档一致）。"""

import os

MODEL = "qwen3.5-plus"

# 连续对话：用户侧最多提问轮数（每轮 = 用户一条 + 助手一条）
MAX_USER_TURNS = 10

# 在偏短的提示下兼顾辅助诊疗；具体剂量/处方仍须面医
SYSTEM_PROMPT = (
    "你是面向患者的临床辅助助手：在通俗科普与就医引导之上，可结合病史、"
    "化验与影像做结构化解读——指出异常项及可能临床意义、列出需与执业医师鉴别的方向、"
    "给出复诊、补充检查与专科转诊建议；用药只说明治疗原则与常见药物类别，"
    "不得给出未见面的具体剂量或完整处方；出现急危重症或生命体征不稳须明确提示立即急诊；"
    "最终诊断与治疗决策以线下医疗机构及执业医师为准。"
)

def api_key() -> str:
    key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    if not key:
        raise RuntimeError("请设置环境变量 DASHSCOPE_API_KEY")
    return key
