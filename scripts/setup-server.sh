#!/usr/bin/env bash
# Установка и запуск на чистом Ubuntu 24.04. Запускать из папки проекта: bash scripts/setup-server.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Устанавливаю Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

if [ ! -f .env ]; then
  echo "==> Создаю .env"
  PASSWORD="$(openssl rand -hex 24)"
  read -r -p "Домен для HTTPS (например sklad.fabrika.ru). Пусто — доступ по IP без HTTPS: " DOMAIN_INPUT
  DOMAIN_VALUE="${DOMAIN_INPUT:-:80}"
  cat > .env <<EOF
POSTGRES_PASSWORD=${PASSWORD}
DOMAIN=${DOMAIN_VALUE}
EOF
  chmod 600 .env
  echo "    Пароль БД сгенерирован и сохранён в .env"
fi

echo "==> Собираю и запускаю (первый раз 3–5 минут)"
$DOCKER compose up -d --build

echo "==> Жду готовности базы"
for _ in $(seq 1 30); do
  if $DOCKER compose exec -T db pg_isready -U stockyard -d stockyard >/dev/null 2>&1; then break; fi
  sleep 2
done

IP="$(curl -fsS https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "Готово. Откройте: http://${IP}"
echo "Чтобы перенести данные из Neon: bash scripts/import-from-neon.sh"
