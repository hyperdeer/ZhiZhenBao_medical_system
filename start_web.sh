#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "启动医疗助手 Web: http://127.0.0.1:8765"
echo "按 Ctrl+C 停止服务"
echo
exec python -m uvicorn server:app --host 127.0.0.1 --port 8765
