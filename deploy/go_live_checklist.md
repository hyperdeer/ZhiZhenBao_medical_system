# 上线验收与安全加固清单

## 功能验收

- 访问 `https://your-domain/` 页面成功打开。
- 注册、登录、验证码流程正常。
- 新建对话、历史会话、清空会话、删除账号可用。
- 流式对话接口 `/api/chat/stream` 正常持续返回。
- 服务器重启后服务自动恢复。

## 运维验收

- `systemctl status patient-medqa` 状态 `active (running)`。
- `nginx -t` 通过，`systemctl status nginx` 正常。
- `certbot renew --dry-run` 成功。
- 日志可追踪：
  - `journalctl -u patient-medqa -f`
  - `tail -f /var/log/nginx/access.log /var/log/nginx/error.log`

## 安全基线

- SSH 使用密钥登录，禁用 root 直接登录。
- `22` 端口仅允许固定 IP，公网仅开放 `80/443`。
- 开启自动安全更新（建议）。
- 如需要可启用 `fail2ban`。
- 避免将 `.env`、数据库或日志中的敏感信息提交到 Git。
