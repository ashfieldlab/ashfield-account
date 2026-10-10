# Ashfield Account — Claude Code 규칙

Ashfield 앱들의 계정 서버(OIDC 제공자) + 워크스페이스. 앱과의 계약은 [docs/adr/0001-account-server-contract.md](docs/adr/0001-account-server-contract.md) —
토큰 클레임·엔드포인트·클라이언트를 바꾸면 **반드시 이 ADR 을 먼저 개정**한다 (Calendar·Drive·Sync 가 이걸 보고 구현한다).

## 절대 규칙

- **Better Auth 설정은 `lib/auth/server.ts` 한 곳.** Better Auth CLI(`make migrate`)가 이 파일을 직접 읽으므로
  여기서 import 하는 파일(`lib/env.ts`, `lib/db/pool.ts`, `lib/db/workspaces.ts`, `lib/auth/*`)은 경로 별칭(`@/`)·`server-only` 를 쓰지 않는다.
- 테이블은 Better Auth CLI 가 만든다 (`make migrate`). 손으로 DDL 쓰지 말 것. 새 테이블이 필요하면 `workspace-invites-plugin.ts` 처럼 스키마만 선언하는 플러그인으로.
- 1st-party 클라이언트·리소스는 `lib/auth/clients.ts` + `make seed` (멱등). DB 를 직접 고치지 말 것.
- 액세스 토큰은 JWT(`resource` 필수). 클레임 추가는 `customAccessTokenClaims` — 예약 클레임(iss/sub/aud/exp…)은 플러그인이 덮어쓴다.
- `AUTH_DEV_PASSWORD_LOGIN` 은 운영에서 꺼져야 한다 (`devPasswordLoginEnabled`). 인증 우회 경로를 만들지 말 것.
- 권한 판단은 서버에서: 워크스페이스 변경은 `auth.api.*`(org 플러그인이 역할 검사), 초대 링크는 `lib/actions/workspaces.ts` 의 `requireManager`.

## 프론트 규칙 (Calendar 와 같음)

- `process.env` 는 `lib/env.ts` 에서만. 새 변수는 `.env.example` 에 주석과 함께.
- `console.log` 금지 → `lib/utils/logger.ts` (`auth | api | biz | ui`). 스크립트(`scripts/`)는 예외.
- 모든 interactive 요소에 `data-testid` (`{feature}-{element}[-{action|id}]`) — ESLint 가 검사.
- 토스트 `useToast()`, 확인창 `useConfirm()` (`components/ui-custom/`). 테마 토큰은 `app/theme.css` (Calendar 와 바이트 동일 유지).
- shadcn 추가: `npx shadcn@latest add <name>` (style `radix-nova`). `components/ui/*` 중 Calendar 에서 온 파일은 Calendar 와 같게 유지.
- UI 문구는 한국어.

## 검증

`make ci-local` (lint · typecheck · test · build) + 서버 띄운 상태에서 `make e2e`, `make oidc-check`.

@AGENTS.md
