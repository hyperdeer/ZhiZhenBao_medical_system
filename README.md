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

## 部署到阿里云 ECS（推荐）

以下示例基于 Ubuntu 22.04，使用 `systemd + Nginx`。

### 1) 准备服务器

- 在阿里云创建 ECS（建议 2C2G 起步）。
- 安全组放行端口：`22`（SSH）、`80`（HTTP）、`443`（HTTPS）。
- 登录服务器并安装基础软件：

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx git
```

### 2) 拉取代码并安装依赖

```bash
cd /opt
sudo git clone https://github.com/hyperdeer/ZhiZhenBao_medical_system.git
sudo chown -R $USER:$USER /opt/ZhiZhenBao_medical_system
cd /opt/ZhiZhenBao_medical_system
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) 配置环境变量

```bash
echo 'DASHSCOPE_API_KEY=your_key_here' | sudo tee /opt/ZhiZhenBao_medical_system/.env
```

### 4) 配置 systemd 常驻服务

创建文件：`/etc/systemd/system/zhizhenbao.service`

```ini
[Unit]
Description=ZhiZhenBao FastAPI Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/ZhiZhenBao_medical_system
EnvironmentFile=/opt/ZhiZhenBao_medical_system/.env
ExecStart=/opt/ZhiZhenBao_medical_system/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动并开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zhizhenbao
sudo systemctl status zhizhenbao
```

### 5) 配置 Nginx 反向代理

创建文件：`/etc/nginx/sites-available/zhizhenbao`

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并重载：

```bash
sudo ln -s /etc/nginx/sites-available/zhizhenbao /etc/nginx/sites-enabled/zhizhenbao
sudo nginx -t
sudo systemctl reload nginx
```

### 6) （可选）配置 HTTPS

有域名时可使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain
```

### 7) 验证部署

- 打开 `http://your_domain_or_ip/`
- 页面可访问并可正常进行流式问答

## 路由说明

- `GET /`：Web 页面入口
- `POST /api/chat/stream`：SSE 流式对话接口

## 注意事项

- 本项目仅用于临床辅助，不替代执业医师诊疗。
- 不要将任何 API Key 提交到 Git 仓库。
