# 0001. 계정 서버(OIDC 제공자) ↔ Ashfield 앱 계약

상태: 채택 (2026-10). Calendar·Drive·Sync 가 이 문서대로 구현한다. 바꾸려면 이 ADR 을 개정한다.

## 배경

Keycloak 이 하던 일(앱 간 SSO, 워크스페이스 소속)을 외부 시스템 없이 자체 서버로 옮긴다.
각 앱은 지금 앱 안에 Better Auth 를 두고 FastAPI 가 JWKS 로 JWT 를 검증한다(Calendar ADR-0023).
그 구조를 유지한 채 **로그인 제공자만 이 계정 서버(OIDC)로 바꾸고**, 소속의 원천을 계정 서버로 모은다.

구현: Better Auth 1.7 + `@better-auth/oauth-provider`(OAuth 2.1/OIDC) + `jwt`(JWKS) + `organization`(= 워크스페이스).

## 결정

### 1. Issuer · 엔드포인트

| 항목 | 값 (dev 기본 `ACCOUNT_URL=http://localhost:3300`) |
|---|---|
| issuer (`iss`) | `${ACCOUNT_URL}`: 끝 슬래시 없음 |
| 디스커버리 | `${ACCOUNT_URL}/.well-known/openid-configuration` (RFC 8414: `/.well-known/oauth-authorization-server`) |
| authorize | `${ACCOUNT_URL}/api/auth/oauth2/authorize` |
| token | `${ACCOUNT_URL}/api/auth/oauth2/token` |
| userinfo | `${ACCOUNT_URL}/api/auth/oauth2/userinfo` |
| JWKS | `${ACCOUNT_URL}/api/auth/jwks` (RS256, `kid` 있음) |
| revoke / introspect | `${ACCOUNT_URL}/api/auth/oauth2/revoke` · `/oauth2/introspect` |
| end-session (RP 로그아웃) | `${ACCOUNT_URL}/api/auth/oauth2/end-session` |

앱은 **디스커버리 문서에서 엔드포인트를 읽는다** (하드코딩 금지: 경로가 Keycloak 과 다르다).

### 2. 클라이언트 (`npm run seed:clients`, 멱등)

| client_id | 종류 | 토큰 엔드포인트 인증 | redirect_uri (env 로 변경) | resource (= `aud`) |
|---|---|---|---|---|
| `ashfield-calendar` | confidential web | `client_secret_basic` **만** | `CALENDAR_REDIRECT_URIS` (기본 `${CALENDAR_URL}/api/auth/callback/ashfield`) | `CALENDAR_URL` (기본 `http://localhost:3100`) |
| `ashfield-drive` | confidential web | `client_secret_basic` **만** | `DRIVE_REDIRECT_URIS` (기본 `${DRIVE_URL}/api/auth/callback/ashfield`) | `DRIVE_URL` (기본 `http://localhost:3200`) |
| `ashfield-sync` | public native | `none` (secret 없음) | `SYNC_REDIRECT_URIS` (기본 `http://localhost:1421/oauth/callback`, `http://127.0.0.1:1421/oauth/callback`) | `DRIVE_URL` |

- 세 클라이언트 모두 **PKCE(S256) 필수**, `grant_types = authorization_code, refresh_token`,
  허용 scope `openid profile email offline_access`, **동의 화면 생략**(1st-party, `skipConsent`).
- redirect_uri 는 **정확히 일치**해야 한다 (포트 포함). 와일드카드 없음.
- confidential secret 은 생성(또는 `--rotate`) 때만 평문으로 출력되고 `.secrets/clients.local.json`(gitignore)에 저장된다. DB 엔 SHA-256 해시만.
- `client_secret_post` 로 보내면 `invalid_client` 다 (등록된 방식만 허용).
- 3rd-party 클라이언트는 동의 화면(`/consent`)을 거친다. 동적 등록(DCR)은 꺼져 있다.

### 3. 인가 요청

```
GET /api/auth/oauth2/authorize
  ?response_type=code
  &client_id=ashfield-drive
  &redirect_uri=<등록된 값 그대로>
  &scope=openid profile email offline_access
  &state=<무작위>
  &nonce=<무작위>                    # 권장 (id_token.nonce 로 돌아온다)
  &code_challenge=<S256(verifier)>
  &code_challenge_method=S256
  &resource=<그 앱의 resource>       # 필수, 아래 참고
```

- **`resource` 는 필수다.** 이 값이 있어야 액세스 토큰이 **JWT** 로 나온다 (없으면 introspection 전용 opaque 토큰: 앱 백엔드가 JWKS 로 검증할 수 없다). 클라이언트에 연결된 resource 만 요청 가능 (`invalid_target`).
- **`offline_access` 가 있어야 refresh_token 이 나온다.**
- 세션이 없으면 `/sign-in` 으로 갔다가 로그인 직후 원래 요청으로 돌아온다. 이미 로그인돼 있으면 화면 없이 바로 redirect_uri 로 (SSO).
- 응답: `redirect_uri?code=…&state=…&iss=${ACCOUNT_URL}` (RFC 9207: `iss` 를 확인할 것).
- 오류: `redirect_uri?error=…&error_description=…&state=…` (예: `access_denied`).

### 4. 토큰 요청 · 응답

```
POST /api/auth/oauth2/token   (application/x-www-form-urlencoded)
  # confidential: Authorization: Basic base64(client_id:client_secret)
  # public:       body 에 client_id
  grant_type=authorization_code&code=…&code_verifier=…&redirect_uri=…&resource=<같은 resource>

  grant_type=refresh_token&refresh_token=…&resource=<같은 resource>
```

응답: `{ access_token, token_type: "Bearer", expires_in: 900, refresh_token, id_token, scope }`

### 5. 액세스 토큰 (JWT): 앱 백엔드가 검증할 것

헤더: `{ "alg": "RS256", "typ": "at+jwt", "kid": "…" }` · 수명 `ACCESS_TOKEN_TTL_SECONDS`(기본 900초 = 15분).

```json
{
  "iss": "http://localhost:3300",
  "sub": "ojhtJvv7zDkfGa6O9H5vgKbN0z0aBmb9",
  "aud": ["http://localhost:3200", "http://localhost:3300/api/auth/oauth2/userinfo"],
  "azp": "ashfield-sync",
  "client_id": "ashfield-sync",
  "scope": "openid profile email offline_access",
  "iat": 1791601971, "exp": 1791602871, "jti": "…", "sid": "…",
  "email": "user@example.com", "email_verified": true,
  "name": "홍길동", "picture": "https://…" ,
  "workspaces": [
    { "id": "chLR47v383utKkudN6zF9xNtpuUj65Ye", "name": "홍길동의 워크스페이스", "slug": "personal-ojht…", "role": "owner" }
  ]
}
```

**검증 규칙 (반드시 전부):**

1. 서명: `jwks_uri` 의 키, `alg` 는 RS256 만 허용. 모르는 `kid` 면 JWKS 를 다시 받는다(빈도 제한).
2. `iss == ACCOUNT_URL` (정확히 일치).
3. **`aud` 는 배열일 수 있다. 자기 resource(`CALENDAR_URL` 또는 `DRIVE_URL`)가 포함돼 있어야 한다.**
   `openid` scope 면 userinfo URL 이 함께 들어 있다: 무시. 다른 앱용 토큰(aud 불일치)은 401.
   (python-jose/PyJWT 의 `audience=` 옵션은 배열 `aud` 에서 포함 여부로 검사한다.)
4. `exp` (시계 오차 ≤ 60초 권장).
5. `sub` = 사용자 ID (계정 서버의 안정적 문자열 ID). 앱 로컬 `users.id` 로 쓴다.
6. `azp`/`client_id` 는 정보용. 필요하면 허용 목록(`ashfield-calendar`, `ashfield-drive`, `ashfield-sync`)으로 제한.

`email`·`email_verified` 는 `email` scope, `name`·`picture` 는 `profile` scope 일 때만 들어간다.
`picture` 는 IdP(Google/GitHub) 이미지 URL 또는 `null`.

### 6. 워크스페이스

- `workspaces` 클레임 = 토큰 발급 시점의 사용자 소속 전체. 항목: `id`, `name`, `slug`, `role ∈ owner|admin|member`.
- **워크스페이스 ID** = Better Auth organization ID (무작위 32자 영숫자, 바뀌지 않음). 앱의 `workspaces.id`(String(128))에 그대로 쓴다.
  개인 워크스페이스의 slug 는 `personal-{sub}` 이고 `metadata.personal = true` (삭제 불가).
- 가입 시 개인 워크스페이스 "`{이름}`의 워크스페이스" 를 자동으로 만들고 owner 로 넣는다 (멱등). 그러므로 `workspaces` 는 항상 1개 이상.
- 앱의 활성 워크스페이스 헤더(`X-Active-Workspace-Id`)는 **토큰의 `workspaces[].id` 중 하나여야** 한다. 아니면 403.
- 역할 매핑 (앱의 `admin | member` 모델): `owner`·`admin` → 앱 `admin`, `member` → 앱 `member`.
- 앱은 소속을 **캐시로만** 저장한다 (원천은 계정 서버). 토큰을 받을 때마다 `workspaces` 로 로컬 멤버십을 동기화(upsert + 빠진 것 삭제)한다.
  앱 쪽 "멤버 추가/제거" UI 는 없애고 계정 서버 링크(`${ACCOUNT_URL}/workspaces/{id}`)로 보낸다.

**변경 전파:** 멤버 추가·제거·역할 변경·이름 변경은 **다음 토큰 갱신 때** 반영된다: 최대 액세스 토큰 수명(15분).
즉시 반영이 필요한 판단(예: 멤버 제거 직후 접근 차단)은 `GET /api/v1/workspaces` 로 최신 값을 조회한다.
JWT 액세스 토큰은 폐기할 수 없으므로 앱 연결 해제·기기 로그아웃도 최대 15분 뒤 완전히 반영된다.

### 7. 리프레시 토큰

- 모든 클라이언트에 발급 (`offline_access` 필요). 수명 `REFRESH_TOKEN_TTL_SECONDS`(기본 30일).
- **회전(rotation)**: 갱신할 때마다 새 refresh_token 이 오고 옛 것은 즉시 무효. 응답의 새 값을 저장할 것.
- **재사용 감지**: 이미 쓴 refresh_token 이 다시 오면 그 토큰 패밀리 전체를 폐기한다 (탈취 의심). 앱은 400 `invalid_grant` 를 받으면 재로그인시킨다.
  동시 갱신 경쟁을 피하려면 앱 안에서 갱신을 직렬화한다.
- 사용자는 계정 홈 → "연결된 앱" 에서 기기별 로그아웃·앱 연결 해제를 할 수 있다 (해당 refresh_token 폐기).

### 8. ID 토큰

`iss`, `sub`(= 액세스 토큰과 같음), `aud = client_id`, `nonce`(요청했으면), `exp`, `auth_time`, `sid`, profile/email 클레임.
로그인 확인용. API 호출엔 쓰지 않는다. RP 로그아웃 시 `id_token_hint` 로 쓴다.

### 9. 계정 서버 API (`/api/v1/*`, Bearer = 위 액세스 토큰)

`aud` 가 1st-party resource(Calendar·Drive) 중 하나인 토큰이면 된다: 앱 백엔드가 받은 토큰을 그대로 전달.
응답은 snake_case JSON. 실패: 401 `{error:"invalid_token"|"unauthorized", error_description}` (+ `WWW-Authenticate`), 404 `{error:"not_found"}`.

| 메서드 · 경로 | 응답 |
|---|---|
| `GET /api/v1/me` | `{ sub, email, email_verified, name, picture, workspaces: [{id,name,slug,role}] }` (최신값) |
| `GET /api/v1/workspaces` | `{ workspaces: [{id,name,slug,role}] }` |
| `GET /api/v1/workspaces/{id}` | `{ id, name, slug, personal, created_at, member_count, my_role }`: 멤버가 아니면 404 |
| `GET /api/v1/workspaces/{id}/members` | `{ workspace_id, members: [{ sub, email, name, picture, role, joined_at }] }`: 멤버가 아니면 404 |

쓰기 API 는 없다: 워크스페이스·멤버 관리는 계정 서버 UI 에서만.

### 10. 로그아웃

- 앱 로그아웃: 앱 세션을 지우고 자기 refresh_token 을 `revocation_endpoint` 로 폐기한다. 계정 서버 세션까지 끝내려면 `end_session_endpoint` 로 `id_token_hint` + `post_logout_redirect_uri`(`${APP_URL}` 또는 `${APP_URL}/login`; Sync 는 등록 없음) 를 보낸다 (플러그인의 RP-initiated logout: 자동 테스트 범위 밖).
- 계정 서버 로그아웃은 앱의 refresh_token 을 폐기하지 **않는다** (검증함: 로그아웃 뒤에도 갱신 200). 앱 접근까지 끊으려면 계정 홈 "연결된 앱" 에서 해제한다.

## 앱별 연결 요약

- **Calendar / Drive (Next.js + Better Auth)**: `genericOAuth` 플러그인에 provider `ashfield` (better-auth 1.7 옵션 이름):

  ```ts
  genericOAuth({ config: [{
    providerId: "ashfield",
    discoveryUrl: `${ACCOUNT_URL}/.well-known/openid-configuration`,
    clientId: "ashfield-calendar", clientSecret: process.env.ASHFIELD_CLIENT_SECRET,
    authentication: "basic", pkce: true,
    scopes: ["openid", "profile", "email", "offline_access"],
    authorizationUrlParams: { resource: APP_URL },
    tokenUrlParams: { resource: APP_URL },
    refreshTokenParams: { resource: APP_URL },
  }] })
  ```

  콜백은 `${APP_URL}/api/auth/callback/ashfield`. BFF 는 계정 서버 **액세스 토큰**(Better Auth `account` 테이블에 저장, 만료 시 refresh)을
  백엔드에 Bearer 로 넘기고, FastAPI 는 `AUTH_JWKS_URL=${ACCOUNT_URL}/api/auth/jwks`, `AUTH_ISSUER=${ACCOUNT_URL}`, `AUTH_AUDIENCE=${APP_URL}` 로 검증한다.
- **Sync (Tauri)**: `VITE_OAUTH_ISSUER=${ACCOUNT_URL}`, `VITE_OAUTH_CLIENT_ID=ashfield-sync`, 포트 1421 유지.
  변경점: 엔드포인트를 디스커버리에서 읽기(현재 Keycloak 경로 하드코딩), scope 에 `offline_access`, authorize·token·refresh 에 `resource=${DRIVE_URL}`,
  로그아웃은 `end_session_endpoint`. redirect `http://localhost:1421/oauth/callback` 은 이미 등록돼 있다.

## 대안

- **opaque 액세스 토큰 + introspection**: 즉시 폐기가 되지만 모든 API 요청이 계정 서버를 부른다. 앱 백엔드가 지금처럼 JWKS 로 자체 검증하는 구조를 유지하려고 JWT 를 택했다(대가: 폐기 지연 ≤ 15분).
- **소속을 토큰에 안 싣고 `/api/v1/workspaces` 만 제공**: 매 요청 네트워크 호출. 클레임 + 조회 API 를 둘 다 두고, 클레임은 캐시·조회는 최신값으로 쓴다.
- **앱 하나의 resource 로 통일(공용 aud)**: 한 앱용 토큰이 다른 앱에서도 통한다. 앱별 resource 로 토큰을 격리했다 (Sync 는 Drive resource).
- **Better Auth organization 초대(이메일 기반)**: 수락자가 초대 이메일과 같아야 하고 메일 발송이 필요하다. 링크 초대는 별도 테이블(`workspaceInvite`)로 구현했다.
