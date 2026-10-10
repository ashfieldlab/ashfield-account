# Ashfield Account

Ashfield 앱(Calendar · Drive · Sync)의 **통합 계정 서버**. 하나의 계정으로 모든 앱에 로그인(SSO)하고,
여러 앱이 함께 쓰는 **워크스페이스**(팀·회사 단위)를 관리합니다. 표준 OAuth 2.1 / OpenID Connect 제공자입니다.

- 로그인: Google · GitHub (설정된 것만), 로컬·E2E 용 DEV 이메일+비밀번호
- 계정 홈: 프로필, 연결된 앱(기기별 로그아웃·연결 해제), 로그인된 브라우저
- 워크스페이스: 만들기 · 이름 변경 · 멤버 역할(소유자/관리자/멤버) · **초대 링크** · 나가기 · 삭제. 가입하면 개인 워크스페이스가 자동으로 생깁니다.
- OIDC: 디스커버리, JWKS(RS256), 인가 코드 + PKCE, JWT 액세스 토큰(`workspaces` 클레임), 리프레시 토큰 회전, 1st-party 앱 동의 생략

스택: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Better Auth 1.7
(`@better-auth/oauth-provider`, `jwt`, `organization`) · Postgres (`pg`). 디자인 토큰·컴포넌트는 Ashfield Calendar 와 같습니다.

## 빠른 시작

필요: Node 24+, Docker.

```bash
make setup     # npm install → .env 생성 → Postgres(5632) → 테이블 생성 → OAuth 클라이언트 등록
make dev       # http://localhost:3300
```

`.env.example` 의 기본값은 `AUTH_DEV_PASSWORD_LOGIN=true` 라 OAuth 앱 없이도 아무 이메일+비밀번호(8자+)로 가입·로그인됩니다.
`make seed` 가 출력한 `ashfield-calendar` · `ashfield-drive` client secret 은 `.secrets/clients.local.json` 에도 저장됩니다 (gitignore).

| 명령 | 설명 |
|---|---|
| `make infra` / `make stop` / `make clean` | Postgres 기동 / 정지 / 볼륨까지 삭제 |
| `make migrate` | Better Auth CLI 로 테이블 생성·갱신 |
| `make seed` · `make seed-rotate` | 1st-party 클라이언트 등록·갱신 (멱등) · secret 재발급 |
| `make lint` · `make typecheck` · `make test` | ESLint · tsc · vitest |
| `make browsers` | Playwright Chromium 설치 (Ubuntu 26.04 → `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`) |
| `make e2e` | Playwright E2E (서버 자동 기동/재사용) |
| `make oidc-check` | `ashfield-sync` 로 authorize → PKCE → token → JWKS 검증 → refresh 회전까지 종단 점검 (서버 필요) |
| `make ci-local` | lint + typecheck + test + build |

## Google · GitHub 로그인 설정

콜백 URL 은 `${ACCOUNT_URL}/api/auth/callback/{google|github}` 입니다 (dev: `http://localhost:3300/...`).

**Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기
1. 애플리케이션 유형 "웹 애플리케이션"
2. 승인된 리디렉션 URI: `http://localhost:3300/api/auth/callback/google` (운영 주소도 추가)
3. 처음이면 OAuth 동의 화면(앱 이름·지원 이메일, 범위 `openid email profile`)을 먼저 구성
4. `.env` 에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**GitHub** — [Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → New OAuth App
1. Homepage URL: `http://localhost:3300`
2. Authorization callback URL: `http://localhost:3300/api/auth/callback/github` (GitHub OAuth App 은 콜백이 하나 — 운영용 앱을 따로 만들 것)
3. Generate a new client secret → `.env` 에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

둘 다 ID·SECRET 이 있을 때만 로그인 화면에 버튼이 나타납니다. 같은 이메일이면 Google·GitHub 계정이 하나로 연결됩니다.

**누가 가입할 수 있나** — `ALLOWED_EMAILS`(쉼표 구분)가 비어 있으면 **누구나** 가입합니다(공개 가입).
값이 있으면 그 이메일만 가입·로그인할 수 있습니다. 공개 인터넷에 띄울 때는 반드시 채우세요.
`AUTH_DEV_PASSWORD_LOGIN` 은 `NODE_ENV=production` 에서 `true` 여도 꺼집니다.

## 앱 연결 (OIDC 계약)

정확한 계약은 **[docs/adr/0001-account-server-contract.md](docs/adr/0001-account-server-contract.md)** — 앱은 이 문서대로 구현합니다. 요약:

- **issuer** `ACCOUNT_URL` (dev `http://localhost:3300`), 디스커버리 `/.well-known/openid-configuration`, JWKS `/api/auth/jwks` (RS256)
- **엔드포인트** `/api/auth/oauth2/{authorize,token,userinfo,revoke,introspect,end-session}`
- **클라이언트**

  | client_id | 종류 | redirect_uri (기본) | resource = `aud` |
  |---|---|---|---|
  | `ashfield-calendar` | confidential, `client_secret_basic` + PKCE | `http://localhost:3100/api/auth/callback/ashfield` | `CALENDAR_URL` (`http://localhost:3100`) |
  | `ashfield-drive` | confidential, `client_secret_basic` + PKCE | `http://localhost:3200/api/auth/callback/ashfield` | `DRIVE_URL` (`http://localhost:3200`) |
  | `ashfield-sync` | public, PKCE | `http://localhost:1421/oauth/callback`, `http://127.0.0.1:1421/oauth/callback` | `DRIVE_URL` |

- 인가 요청에 **`resource=<앱 URL>` 필수** (그래야 JWT 액세스 토큰), refresh 를 받으려면 scope 에 **`offline_access`**.
- **액세스 토큰(JWT, 15분)**: `iss`, `sub`(사용자 ID), `aud`(배열 — 자기 resource 포함 여부를 검증), `exp`, `iat`, `azp`/`client_id`, `scope`,
  `email`, `email_verified`, `name`, `picture`, **`workspaces: [{id, name, slug, role}]`** (role = owner|admin|member).
- 워크스페이스 ID 는 안정적인 문자열 — 앱의 회사 ID 로 그대로 사용. 소속 변경은 **다음 토큰 갱신(≤ 15분)** 에 반영, 즉시 값은 `GET /api/v1/workspaces`.
- **리프레시 토큰**: 모든 클라이언트, 회전 + 재사용 감지(패밀리 폐기), 30일.
- **API** (Bearer = 액세스 토큰): `GET /api/v1/me`, `/api/v1/workspaces`, `/api/v1/workspaces/{id}`, `/api/v1/workspaces/{id}/members`.

### Calendar · Drive

각 앱의 Better Auth 에 `genericOAuth` provider `ashfield` 를 추가합니다 (설정 예시는 ADR §앱별 연결 요약).
앱 `.env`: `ACCOUNT_URL`, client id, `make seed` 가 준 secret. 앱 포트는 Calendar 3100 · Drive 3200 을 기본으로 가정합니다 —
다르면 이 서버의 `CALENDAR_URL`/`DRIVE_URL`(및 `*_REDIRECT_URIS`)을 바꾸고 `make seed` 를 다시 실행하세요.
백엔드(FastAPI)는 `AUTH_JWKS_URL=${ACCOUNT_URL}/api/auth/jwks`, `AUTH_ISSUER=${ACCOUNT_URL}`, `AUTH_AUDIENCE=<앱 URL>`.

### Sync (Windows)

`VITE_OAUTH_ISSUER=http://localhost:3300`, `VITE_OAUTH_CLIENT_ID=ashfield-sync`, `VITE_OAUTH_REDIRECT_PORT=1421`.
Keycloak 경로(`/protocol/openid-connect/*`) 대신 디스커버리의 엔드포인트를 쓰고, scope 에 `offline_access`, 요청마다 `resource=${DRIVE_URL}` 를 붙여야 합니다.

## 구조

```
app/
  sign-in/  consent/  invite/[id]/           로그인 · OAuth 동의 · 초대 수락
  (account)/  page.tsx  workspaces/…         계정 홈 · 워크스페이스 (로그인 필요)
  api/auth/[...all]/                         Better Auth (OAuth/OIDC 엔드포인트 포함)
  api/v1/…                                   앱용 조회 API (Bearer)
  .well-known/…                              디스커버리
lib/auth/server.ts                           Better Auth 설정 (단일 지점)
lib/auth/clients.ts                          1st-party 클라이언트·리소스 정의
lib/auth/personal-workspace.ts               개인 워크스페이스 자동 생성 (멱등)
lib/db/…  lib/actions/…                      조회 SQL · server action
scripts/seed-clients.ts  scripts/oidc-flow-check.ts
e2e/                                         Playwright
```

## 라이선스

MIT
