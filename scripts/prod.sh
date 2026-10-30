#!/bin/sh
# 운영 서버에서 실행한다 (로컬 make deploy-init, make deploy 가 ssh 로 부른다). docs/deploy.md
#
#   sh scripts/prod.sh init-env   .env.prod 생성, __GENERATE__ 자리를 openssl 로 채움 (값은 출력하지 않음)
#   sh scripts/prod.sh up         빌드, Better Auth 마이그레이션, 클라이언트 등록, 기동
#   sh scripts/prod.sh ps | logs | backup
set -eu
cd "$(dirname "$0")/.."

dc() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }

# KEY=__GENERATE__ 인 줄만 새 값으로 바꾼다 (이미 채운 값은 그대로).
fill() {
  if grep -q "^$1=__GENERATE__\$" .env.prod; then
    sed -i "s|^$1=__GENERATE__\$|$1=$2|" .env.prod
    echo "  $1 생성"
  fi
}

# KEY= (빈 값) 인 줄만 채운다.
fill_empty() {
  if [ -n "$2" ] && grep -q "^$1=\$" .env.prod; then
    sed -i "s|^$1=\$|$1=$2|" .env.prod
    echo "  $1=$2"
  fi
}

value() { grep "^$1=" .env.prod | tail -n 1 | cut -d= -f2-; }

check_env() {
  missing=$(grep -E '^[A-Z_]+=__[A-Z_]+__$' .env.prod | cut -d= -f1 || true)
  [ -z "$missing" ] || { echo "! .env.prod 에 채울 값: $missing"; return 1; }
  if [ -z "$(value GITHUB_CLIENT_ID)" ] && [ -z "$(value GOOGLE_CLIENT_ID)" ]; then
    echo "! 로그인 수단이 없습니다: .env.prod 에 GITHUB_* 또는 GOOGLE_* 를 채우세요"
  fi
  [ -n "$(value ALLOWED_EMAILS)" ] || echo "! ALLOWED_EMAILS 가 비어 있어 누구나 가입할 수 있습니다"
}

init_env() {
  if [ ! -f .env.prod ]; then
    cp .env.prod.example .env.prod
    chmod 600 .env.prod
    echo ".env.prod 생성"
  fi
  fill POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  fill BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
  fill_empty ALLOWED_EMAILS "${ADMIN_EMAIL:-}"
  mkdir -p .secrets && chmod 700 .secrets
  check_env || true
}

up() {
  [ -f .env.prod ] || { echo "! .env.prod 없음: make deploy-init 먼저"; exit 1; }
  check_env
  dc --profile tools build --pull
  dc up -d --wait postgres
  echo "→ Better Auth 마이그레이션"
  dc run --rm migrate
  echo "→ OAuth 클라이언트 등록 (secret 은 .secrets/clients.local.json)"
  mkdir -p .secrets && chmod 700 .secrets
  dc run --rm --user "$(id -u):$(id -g)" seed
  dc up -d --wait --remove-orphans
  dc ps
}

backup() {
  mkdir -p backups
  f="backups/ashfield-account-$(date +%Y%m%d-%H%M).sql.gz"
  dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$f"
  echo "백업: $f"
}

case "${1:-}" in
  init-env) init_env ;;
  up) up ;;
  ps) dc ps ;;
  logs) dc logs -f --tail=100 ;;
  backup) backup ;;
  *) echo "usage: $0 init-env|up|ps|logs|backup"; exit 2 ;;
esac
