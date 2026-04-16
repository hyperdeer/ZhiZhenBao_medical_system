# ZhiZhenBao Medical System

基于 FastAPI + DashScope（`qwen3.5-plus`）的医疗问答 Web 应用，支持多轮会话、流式回复与图片输入。

## 本地运行

### 1) 安装依赖

```bash
pip install -r requirements.txt
```

### 2) 配置环境变量

必须配置：

- `DASHSCOPE_API_KEY`

Windows PowerShell:

```powershell
$env:DASHSCOPE_API_KEY="your_key_here"
```

Linux/macOS:

```bash
export DASHSCOPE_API_KEY="your_key_here"
```

### 3) 启动服务

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

浏览器访问：`http://127.0.0.1:8000`

## 云服务器部署（不依赖 Render）

提供了完整的国内云部署资产（阿里云/腾讯云/华为云都可）：

- 主说明：`deploy/README.md`
- 系统初始化脚本：`deploy/bootstrap_ubuntu.sh`
- 生产环境变量模板：`deploy/env.production.example`
- systemd：`deploy/systemd/patient-medqa.service`
- Nginx（含 SSE 配置）：`deploy/nginx/patient-medqa.conf`
- HTTPS 证书：`deploy/https_certbot.md`
- 上线检查：`deploy/go_live_checklist.md`

推荐部署路径：`/srv/patient_medical_qa`，监听地址：`127.0.0.1:8765`。

## 路由说明

- `GET /`：Web 页面入口
- `POST /api/chat/stream`：SSE 流式对话接口

## 注意事项

- 本项目仅用于临床辅助，不替代执业医师诊疗。
- 不要将任何 API Key 提交到 Git 仓库。
