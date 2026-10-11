# 운영 배포

앞단 리버스 프록시(다른 기계)가 TLS 를 받고 앱 서버의 LAN 포트로 넘긴다. 앱 서버는 자기 ssh 키(`~/.ssh/id_ed25519`, ashfieldlab 계정에 등록)로 GitHub `origin/main` 을 직접 받고, 서버의 `scripts/prod.sh` 가 docker compose(`docker-compose.prod.yml`)로 빌드하고 띄운다. 로컬 `make deploy` 는 ssh 로 이 과정을 실행할 뿐이라, 배포되는 것은 로컬 `HEAD` 가 아니라 push 된 `main` 이다.

| 항목 | 값 |
|---|---|
| 서버 | ssh 별칭 `ovm` (`DEPLOY_HOST`), 디렉터리 `~/ashfield/account` (`DEPLOY_DIR`) |
| 공개 주소 | `https://account.ashfieldlab.dev` (= `ACCOUNT_URL`, OIDC issuer) |
| 포트 | `3300` → app. Postgres 는 내부 네트워크만 |
| 서버에만 있는 것 | `.env.prod`, `.secrets/clients.local.json`, `backups/` (git 이 추적하지 않아 배포 때 그대로 남음) |
| 서버 준비 | docker, 서버 사용자가 `docker` 그룹, `openssl` |

## 명령 (로컬)

| 명령 | 하는 일 |
|---|---|
| `make deploy-git-init` | 처음 한 번 (서버마다). 배포 디렉터리를 GitHub 체크아웃으로 바꾼다. 서버 키가 GitHub 에 없으면 공개 키를 출력한다: ashfieldlab 계정 Settings > SSH keys 에 등록하고 다시 실행 (한 번 등록하면 세 레포 모두) |
| `make deploy-init ADMIN_EMAIL=me@example.com` | 처음 한 번. GitHub 에서 받고 `.env.prod` 생성. 비밀값은 서버에서 openssl 로 만들고 출력하지 않는다. `ADMIN_EMAIL` 은 `ALLOWED_EMAILS` 로 |
| `make deploy` | GitHub `origin/main` 받기, 이미지 빌드, Better Auth 마이그레이션, 클라이언트 등록(seed), 재시작 |
| `make deploy-ps`, `deploy-logs`, `deploy-backup` | 상태, 로그, Postgres 덤프(서버 `backups/`) |

push 하지 않은 커밋은 배포되지 않는다 (`make deploy` 가 경고). 서버에서 추적 파일을 직접 고치면 다음 배포가 덮어쓴다.

## 처음 배포

1. `make deploy-git-init` (키 등록 후 다시 실행)
2. `make deploy-init ADMIN_EMAIL=...`
3. 서버 `~/ashfield/account/.env.prod` 에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (또는 `GOOGLE_*`) 를 채운다 ([setup-oauth.md](setup-oauth.md))
4. `make deploy`
5. 그다음 Calendar, Drive 의 `make deploy-git-init`, `make deploy-init`: 이 서버의 `.secrets/clients.local.json` 에서 client secret 을 읽는다

| 제공자 | 콜백 URL |
|---|---|
| GitHub | `https://account.ashfieldlab.dev/api/auth/callback/github` |
| Google | `https://account.ashfieldlab.dev/api/auth/callback/google` |

운영(`NODE_ENV=production`)에서는 DEV 비밀번호 로그인이 꺼진다.

## 클라이언트 등록

seed 는 매 배포 실행된다 (멱등). redirect URI, resource 는 `.env.prod` 의 `CALENDAR_URL`, `DRIVE_URL` 로 갱신하고, Calendar, Drive 의 secret 은 처음 한 번만 만들어 `.secrets/clients.local.json` 에 쓴다 (출력하지 않음).

secret 재발급 (서버에서):

```
cd ~/ashfield/account
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --user "$(id -u):$(id -g)" \
  seed node_modules/.bin/tsx scripts/seed-clients.ts --rotate --no-print
```

그다음 Calendar, Drive 의 `.env.prod` 에서 `ASHFIELD_CLIENT_SECRET=__FROM_ACCOUNT__` 로 되돌리고 각각 `make deploy-init`, `make deploy`.
