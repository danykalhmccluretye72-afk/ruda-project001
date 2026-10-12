#!/usr/bin/env bash
# Переносит все таблицы и данные из Neon в локальную БД сервера (заменяя её содержимое).
# Запуск: bash scripts/import-from-neon.sh   — строку подключения скрипт спросит сам.
set -euo pipefail
cd "$(dirname "$0")/.."

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

NEON_URL="${1:-}"
if [ -z "$NEON_URL" ]; then
  read -r -s -p "Вставьте строку подключения Neon (postgresql://...): " NEON_URL
  echo
fi
if [[ "$NEON_URL" != postgres* ]]; then
  echo "Строка должна начинаться с postgresql://" >&2
  exit 1
fi

BACKUP="backup_before_import_$(date +%F_%H%M%S).sql"
echo "==> Резервная копия текущей локальной БД: $BACKUP"
$DOCKER compose exec -T db pg_dump -U stockyard stockyard > "$BACKUP"

DUMP="$(mktemp)"
trap 'rm -f "$DUMP"' EXIT

echo "==> Выгружаю данные из Neon"
$DOCKER run --rm postgres:18-alpine \
  pg_dump --schema=public --no-owner --no-acl --clean --if-exists "$NEON_URL" > "$DUMP"

echo "==> Загружаю в локальную БД"
$DOCKER compose exec -T db psql -v ON_ERROR_STOP=1 --single-transaction -q -U stockyard stockyard < "$DUMP"

echo "==> Проверка"
$DOCKER compose exec -T db psql -U stockyard stockyard -c \
  "select (select count(*) from stockpiles) as штабели, (select count(*) from loaders) as погрузчики, (select count(*) from ore_receipts) as поступления, (select count(*) from ore_feeds) as подачи, (select count(*) from shift_plans) as планы;"

$DOCKER compose restart app >/dev/null
echo "Готово. Данные перенесены."
