# 云服务器部署手册（国内云）

本目录提供一套不依赖 Render 的部署资产，适用于阿里云 ECS、腾讯云 CVM、华为云 ECS 等 Linux 云主机。

## 1. 推荐机器与网络

- 系统：Ubuntu 22.04 LTS
- 规格：2C4G（最低 2C2G）
- 磁盘：>= 40GB
- 安全组：
  - `22/tcp`（建议限制为你的固定出口 IP）
  - `80/tcp`
  - `443/tcp`

## 2. 目录与服务命名

- 代码目录：`/srv/patient_medical_qa`
- 进程服务名：`patient-medqa`
- 回环监听：`127.0.0.1:8765`

## 3. 快速执行顺序

1. 参考 `bootstrap_ubuntu.sh` 初始化系统与 Python 环境。
2. 复制并修改 `env.production.example` 为 `.env`，填入 `DASHSCOPE_API_KEY`。
3. 按 `systemd/patient-medqa.service` 安装并启动应用服务。
4. 按 `nginx/patient-medqa.conf` 安装 Nginx 站点并验证反向代理。
5. 按 `https_certbot.md` 申请 HTTPS 证书并启用自动续签。
6. 按 `go_live_checklist.md` 完成上线验收与安全加固。

可参考命令：

```bash
# 在服务器项目目录执行
sudo cp deploy/systemd/patient-medqa.service /etc/systemd/system/patient-medqa.service
sudo systemctl daemon-reload
sudo systemctl enable --now patient-medqa

sudo cp deploy/nginx/patient-medqa.conf /etc/nginx/sites-available/patient-medqa
sudo ln -sf /etc/nginx/sites-available/patient-medqa /etc/nginx/sites-enabled/patient-medqa
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 关键说明

- 生产 HTTPS 场景下，建议启用 `COOKIE_SECURE=1`（已在后端支持环境变量控制）。
- 本项目目前使用 SQLite（`app.db`），适合单机轻中并发。
- `/api/chat/stream` 为 SSE 流接口，Nginx 必须关闭代理缓冲。
