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

## 部署到 Render（推荐）

1. 将本仓库推送到 GitHub。
2. 在 Render 新建 **Web Service**，连接该 GitHub 仓库。
3. 配置命令：
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. 在 Render 的 Environment 中新增：
   - `DASHSCOPE_API_KEY=你的密钥`
5. 部署成功后访问 Render 分配的 URL。

## 路由说明

- `GET /`：Web 页面入口
- `POST /api/chat/stream`：SSE 流式对话接口

## 注意事项

- 本项目仅用于临床辅助，不替代执业医师诊疗。
- 不要将任何 API Key 提交到 Git 仓库。
