@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 医疗助手 Web  http://127.0.0.1:8765
echo 依赖: pip install -r requirements.txt
echo 停止: Ctrl+C
echo.

python -m uvicorn server:app --host 127.0.0.1 --port 8765

if errorlevel 1 (
  echo.
  echo 若缺少模块，请先执行 pip install -r requirements.txt 后重试。
  pause
)
