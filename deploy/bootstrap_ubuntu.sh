#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash deploy/bootstrap_ubuntu.sh
# Optional env:
#   APP_DIR=/srv/patient_medical_qa
#   APP_USER=www-data

APP_DIR="${APP_DIR:-/srv/patient_medical_qa}"
APP_USER="${APP_USER:-www-data}"

echo "[1/6] apt update"
apt update -y

echo "[2/6] install system packages"
apt install -y python3 python3-venv python3-pip nginx git curl ufw

echo "[3/6] create app directory"
mkdir -p "${APP_DIR}"

echo "[4/6] adjust ownership"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

if [[ ! -f "${APP_DIR}/requirements.txt" ]]; then
  echo "[WARN] requirements.txt not found in ${APP_DIR}"
  echo "       upload or clone project into this path, then rerun dependency step."
  exit 0
fi

echo "[5/6] create virtualenv and install requirements"
sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/.venv"
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

echo "[6/6] done"
echo "Next steps:"
echo "  1) cp ${APP_DIR}/deploy/env.production.example ${APP_DIR}/.env"
echo "  2) edit .env and set DASHSCOPE_API_KEY"
echo "  3) install systemd and nginx configs from deploy/"
