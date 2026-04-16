# HTTPS 证书配置（Certbot + Nginx）

以下步骤在 Ubuntu 22.04 测试通过。

## 1) 前置条件

- 域名已解析到服务器公网 IP（如 `qa.example.com`）。
- 已完成 Nginx 80 端口配置并 `nginx -t` 通过。
- 安全组/防火墙已放行 `80`、`443`。

## 2) 安装 Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

## 3) 申请证书并自动改写 Nginx

```bash
sudo certbot --nginx -d qa.example.com
```

若有多个域名可追加 `-d`：

```bash
sudo certbot --nginx -d qa.example.com -d www.qa.example.com
```

## 4) 自动续签验证

```bash
sudo certbot renew --dry-run
```

系统通常会自动安装续签定时任务。可用以下命令检查：

```bash
systemctl list-timers | grep certbot
```

## 5) 生产建议

- 证书生效后在 `.env` 启用 `COOKIE_SECURE=1`。
- 重新加载应用服务：

```bash
sudo systemctl restart patient-medqa
```
