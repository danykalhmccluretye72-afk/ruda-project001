#!/usr/bin/env bash
# Установка и обслуживание «Рудного склада» на Ubuntu 22/24 и Debian 12.
#
#   bash scripts/setup-server.sh                  — первая установка или меню обслуживания
#   bash scripts/setup-server.sh --update         — пересобрать и перезапустить (данные сохраняются)
#   bash scripts/setup-server.sh --domain sklad.ru — привязать новый домен (пусто/ip — доступ по IP)
#   bash scripts/setup-server.sh --remove-nginx   — удалить системный nginx, перейти на встроенный Caddy
#   bash scripts/setup-server.sh --reinstall      — переустановка с нуля (ВСЕ ДАННЫЕ УДАЛЯЮТСЯ, бэкап делается)
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

say() { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!!  %s\n' "$*" >&2; }

# ---------- .env helpers ----------
env_get() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
env_set() {
  local key="$1" value="$2"
  touch .env
  if grep -qE "^${key}=" .env; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' .env > "$tmp"
    cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
  chmod 600 .env
}

public_ip() {
  curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
    || curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
    || hostname -I | awk '{print $1}'
}

# ---------- системные пакеты и Docker ----------
install_prereqs() {
  local missing=()
  for bin in curl openssl awk; do command -v "$bin" >/dev/null 2>&1 || missing+=("$bin"); done
  if [ ${#missing[@]} -gt 0 ]; then
    say "Устанавливаю: curl openssl ca-certificates"
    $SUDO apt-get update -y && $SUDO apt-get install -y curl openssl ca-certificates gawk
  fi
}

configure_docker_mirrors() {
  # Docker Hub из РФ часто недоступен — проверяем и подключаем зеркала.
  if curl -fsS --max-time 8 -o /dev/null https://registry-1.docker.io/v2/ 2>/dev/null \
     || curl -sS --max-time 8 -o /dev/null -w '%{http_code}' https://registry-1.docker.io/v2/ 2>/dev/null | grep -q 401; then
    return
  fi
  if [ -f /etc/docker/daemon.json ] && grep -q registry-mirrors /etc/docker/daemon.json; then
    return
  fi
  say "Docker Hub недоступен — подключаю зеркала"
  $SUDO mkdir -p /etc/docker
  $SUDO tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://dockerhub.timeweb.cloud",
    "https://huecker.io"
  ]
}
JSON
  $SUDO systemctl restart docker
}

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    say "Устанавливаю Docker"
    curl -fsSL https://get.docker.com | $SUDO sh
    [ -n "${SUDO}" ] && $SUDO usermod -aG docker "$USER" || true
  fi
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || true
  configure_docker_mirrors
}

DOCKER="docker"
pick_docker() { docker info >/dev/null 2>&1 || DOCKER="$SUDO docker"; }
compose() { $DOCKER compose "$@"; }

# ---------- nginx ----------
nginx_installed() { command -v nginx >/dev/null 2>&1 || dpkg -s nginx >/dev/null 2>&1; }
nginx_active() { systemctl is-active --quiet nginx 2>/dev/null; }

remove_nginx() {
  if ! nginx_installed; then
    echo "nginx не установлен — удалять нечего."
  else
    say "Удаляю системный nginx"
    $SUDO systemctl disable --now nginx 2>/dev/null || true
    $SUDO apt-get purge -y 'nginx*' || true
    $SUDO apt-get autoremove -y || true
    $SUDO rm -rf /etc/nginx/sites-enabled/ore-stock /etc/nginx/sites-available/ore-stock
  fi
  env_set COMPOSE_PROFILES caddy
  if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
    $SUDO ufw allow 80/tcp >/dev/null; $SUDO ufw allow 443/tcp >/dev/null
  fi
  start_stack
}

configure_nginx_site() {
  local server_name="$1"
  $SUDO sed "s/server_name _;/server_name ${server_name};/" deploy/nginx-ore-stock.conf \
    | $SUDO tee /etc/nginx/sites-available/ore-stock > /dev/null
  $SUDO rm -f /etc/nginx/sites-enabled/default
  $SUDO ln -sf /etc/nginx/sites-available/ore-stock /etc/nginx/sites-enabled/ore-stock
  $SUDO nginx -t && $SUDO systemctl reload nginx
}

# ---------- домен ----------
apply_domain() {
  local input="${1:-}"
  input="$(printf '%s' "$input" | sed -E 's#^https?://##; s#/.*$##' | tr 'A-Z' 'a-z')"
  local web; web="$(env_get COMPOSE_PROFILES)"

  if [ -z "$input" ] || [ "$input" = "ip" ]; then
    local ip; ip="$(public_ip)"
    env_set DOMAIN ":80"
    env_set BETTER_AUTH_URL "http://${ip}"
    [ "$web" != "caddy" ] && nginx_installed && configure_nginx_site "_"
    echo "Доступ по IP: http://${ip}"
  else
    if [ "$web" = "caddy" ]; then
      env_set DOMAIN "$input"
      env_set BETTER_AUTH_URL "https://${input}"
      echo "Домен: https://${input} (сертификат Let's Encrypt выпустится автоматически)."
      echo "A-запись домена должна указывать на $(public_ip), порты 80 и 443 открыты."
    else
      env_set DOMAIN ":80"
      env_set BETTER_AUTH_URL "http://${input}"
      configure_nginx_site "$input"
      echo "Домен: http://${input} через nginx."
      echo "Для HTTPS: sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d ${input}"
      echo "После выпуска сертификата: bash scripts/setup-server.sh --domain https://${input} не нужен —"
      echo "просто замените в .env BETTER_AUTH_URL на https://${input} и выполните --update."
    fi
  fi
}

change_domain() {
  local new="${1-__ask__}"
  if [ "$new" = "__ask__" ]; then
    echo "Текущий адрес: $(env_get BETTER_AUTH_URL)"
    read -r -p "Новый домен (например sklad.fabrika.ru). Пусто — доступ по IP: " new
  fi
  apply_domain "$new"
  start_stack
}

# ---------- первичная настройка .env ----------
ensure_env() {
  [ -f .env ] || { say "Создаю .env"; : > .env; chmod 600 .env; }
  [ -n "$(env_get POSTGRES_PASSWORD)" ] || env_set POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  [ -n "$(env_get BETTER_AUTH_SECRET)" ] || env_set BETTER_AUTH_SECRET "$(openssl rand -base64 32 | tr -d '\n=/+' )"

  if ! grep -qE '^COMPOSE_PROFILES=' .env; then
    if nginx_active; then
      echo
      echo "На сервере работает nginx (занимает порт 80)."
      read -r -p "Удалить nginx и использовать встроенный веб-сервер с автоматическим HTTPS? [Y/n]: " ans
      if [[ "${ans:-Y}" =~ ^[YyДд]$ ]]; then
        $SUDO systemctl disable --now nginx 2>/dev/null || true
        $SUDO apt-get purge -y 'nginx*' || true
        $SUDO apt-get autoremove -y || true
        env_set COMPOSE_PROFILES caddy
      else
        env_set COMPOSE_PROFILES ""
      fi
    else
      env_set COMPOSE_PROFILES caddy
    fi
  fi

  if [ -z "$(env_get BETTER_AUTH_URL)" ]; then
    local d; d="$(env_get DOMAIN)"
    if [ -n "$d" ] && [ "$d" != ":80" ]; then
      apply_domain "$d"
    else
      read -r -p "Домен (например sklad.fabrika.ru). Пусто — доступ по IP без HTTPS: " d
      apply_domain "$d"
    fi
  fi
}

# ---------- запуск ----------
wait_db() {
  for _ in $(seq 1 60); do
    compose exec -T db pg_isready -U stockyard -d stockyard >/dev/null 2>&1 && return 0
    sleep 2
  done
  warn "База данных не поднялась. Логи: $DOCKER compose logs db"; exit 1
}

migrate() {
  say "Применяю схему БД (идемпотентно)"
  compose exec -T db psql -v ON_ERROR_STOP=1 -q -U stockyard -d stockyard < db/init.sql
  compose exec -T db psql -v ON_ERROR_STOP=1 -q -U stockyard -d stockyard < db/auth.sql
}

start_stack() {
  say "Собираю и запускаю (первый раз 3–5 минут)"
  compose up -d db
  wait_db
  migrate
  compose up -d --build --remove-orphans
  if [ "$(env_get COMPOSE_PROFILES)" != "caddy" ] && nginx_installed; then
    configure_nginx_site "$(env_get BETTER_AUTH_URL | sed -E 's#^https?://##; s#/.*$##')" || true
  fi
  sleep 3
  compose ps
  local users
  users="$(compose exec -T db psql -tA -U stockyard -d stockyard -c 'select count(*) from "user"' 2>/dev/null || echo 0)"
  echo
  echo "Готово. Откройте: $(env_get BETTER_AUTH_URL)"
  if [ "${users//[[:space:]]/}" = "0" ]; then
    echo "Пользователей ещё нет — при первом входе создайте учётную запись администратора."
  fi
}

backup_db() {
  mkdir -p backups
  local file="backups/stockyard-$(date +%Y%m%d-%H%M%S).sql"
  if compose ps --status running db 2>/dev/null | grep -q db; then
    compose exec -T db pg_dump -U stockyard -d stockyard --no-owner > "$file" && echo "Резервная копия: $file"
  else
    echo "База не запущена — резервная копия не создана."
  fi
}

reinstall() {
  echo
  warn "Переустановка с нуля удалит ВСЕ данные: штабели, поступления, подачи, планы, пользователей."
  read -r -p "Для подтверждения введите УДАЛИТЬ: " confirm
  [ "$confirm" = "УДАЛИТЬ" ] || { echo "Отменено."; return; }
  backup_db
  say "Останавливаю и удаляю контейнеры, тома и образы"
  compose --profile caddy down -v --rmi local --remove-orphans || true
  local keep_domain; keep_domain="$(env_get DOMAIN)"
  rm -f .env
  [ -n "$keep_domain" ] && [ "$keep_domain" != ":80" ] && read -r -p "Оставить домен ${keep_domain}? [Y/n]: " k
  ensure_env_fresh_domain "${k:-Y}" "$keep_domain"
  start_stack
}

ensure_env_fresh_domain() {
  local keep="$1" domain="$2"
  : > .env; chmod 600 .env
  env_set POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  env_set BETTER_AUTH_SECRET "$(openssl rand -base64 32 | tr -d '\n=/+')"
  if nginx_active; then env_set COMPOSE_PROFILES ""; else env_set COMPOSE_PROFILES caddy; fi
  if [[ "$keep" =~ ^[YyДд]$ ]] && [ -n "$domain" ] && [ "$domain" != ":80" ]; then
    apply_domain "$domain"
  else
    ensure_env
  fi
}

menu() {
  echo
  echo "Рудный склад уже установлен. Адрес: $(env_get BETTER_AUTH_URL)"
  nginx_installed && echo "Системный nginx: установлен$(nginx_active && echo ', работает')"
  echo
  echo "  1) Обновить и перезапустить (данные сохраняются)"
  echo "  2) Привязать новый домен"
  echo "  3) Удалить nginx и перейти на встроенный веб-сервер (HTTPS автоматически)"
  echo "  4) Резервная копия базы"
  echo "  5) Переустановить с нуля (все данные будут удалены)"
  echo "  0) Выход"
  read -r -p "Выберите действие: " choice
  case "$choice" in
    1) ensure_env; start_stack ;;
    2) ensure_env; change_domain ;;
    3) ensure_env; remove_nginx ;;
    4) backup_db ;;
    5) reinstall ;;
    *) echo "Выход." ;;
  esac
}

# ---------- main ----------
install_prereqs
install_docker
pick_docker

case "${1:-}" in
  --update) ensure_env; start_stack ;;
  --domain) ensure_env; change_domain "${2:-}" ;;
  --remove-nginx) ensure_env; remove_nginx ;;
  --backup) backup_db ;;
  --reinstall) reinstall ;;
  "")
    if [ -f .env ] && [ -n "$(env_get POSTGRES_PASSWORD)" ]; then
      menu
    else
      ensure_env
      start_stack
    fi
    ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
