#!/usr/bin/env bash
set -euo pipefail

# Instala Docker, nginx e certbot no host alvo (Ubuntu/Debian).
# Rodar como root na VPS, ou localmente se a máquina for o host.

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "${SUDO_USER:-$USER}" || true
fi

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx git ufw

mkdir -p /opt/temis/apps /etc/nginx/sites-available /etc/nginx/sites-enabled
systemctl enable --now nginx docker

ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

echo "Temis bootstrap ok. Docker $(docker --version). Nginx $(nginx -v 2>&1)."
