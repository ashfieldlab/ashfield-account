# Google · GitHub 로그인 설정

Ashfield Account 는 로그인을 Google · GitHub 에 맡깁니다. 둘 중 필요한 것만 설정하면 되고,
ID·SECRET 이 설정된 제공자만 로그인 화면에 나타납니다. 같은 이메일이면 하나의 계정으로 연결됩니다.

콜백 URL 은 `${ACCOUNT_URL}/api/auth/callback/{google|github}` 입니다 (로컬: `http://localhost:3300/...`).

## Google

[Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기

1. 처음이면 OAuth 동의 화면(앱 이름·지원 이메일, 범위 `openid email profile`)을 먼저 구성합니다.
   게시 상태가 "테스트"면 테스트 사용자로 등록한 계정만 로그인할 수 있습니다.
2. 애플리케이션 유형: 웹 애플리케이션
3. 승인된 리디렉션 URI: `http://localhost:3300/api/auth/callback/google` (운영 주소도 함께 추가)
4. `.env` 에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## GitHub

[Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → New OAuth App

1. Homepage URL: `http://localhost:3300`
2. Authorization callback URL: `http://localhost:3300/api/auth/callback/github`
3. Generate a new client secret → `.env` 에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

GitHub OAuth App 은 콜백 URL 을 하나만 가질 수 있으므로 운영용 앱을 따로 만드세요.

## 가입 제한

`ALLOWED_EMAILS`(쉼표 구분)가 비어 있으면 누구나 가입할 수 있습니다.
공개 인터넷에 띄울 때는 반드시 허용할 이메일을 채우세요.

`AUTH_DEV_PASSWORD_LOGIN=true` 는 로컬·E2E 용 이메일+비밀번호 로그인이며, `NODE_ENV=production` 에서는 항상 꺼집니다.

## 앱 클라이언트

`make seed` 가 Calendar · Drive · Sync 클라이언트를 등록하고, Calendar · Drive 의 client secret 을
`.secrets/clients.local.json` 에 저장합니다 (gitignore). 앱 주소가 기본값(3100 · 3200)과 다르면
`CALENDAR_URL` · `DRIVE_URL` 등을 바꾼 뒤 `make seed` 를 다시 실행하세요.
