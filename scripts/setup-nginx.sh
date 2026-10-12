#!/usr/bin/env bash
# Подключает приложение к уже установленному nginx. Запуск: bash scripts/setup-nginx.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

if ! command -v nginx >/dev/null 2>&1; then
  $SUDO apt-get update && $SUDO apt-get install -y nginx
fi

$SUDO cp deploy/nginx-ore-stock.conf /etc/nginx/sites-available/ore-stock
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO ln -sf /etc/nginx/sites-available/ore-stock /etc/nginx/sites-enabled/ore-stock
$SUDO nginx -t
$SUDO systemctl reload nginx

if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow 'Nginx Full' || true
fi

echo "==> Проверка приложения напрямую:"
curl -s -o /dev/null -w "  127.0.0.1:3000 -> HTTP %{http_code}\n" http://127.0.0.1:3000/ || echo "  приложение не отвечает на 3000"
echo "==> Проверка через nginx:"
curl -s -o /dev/null -w "  127.0.0.1:80 -> HTTP %{http_code}\n" http://127.0.0.1/ || true
echo "Готово. Откройте http://$(hostname -I | awk '{print $1}')"
