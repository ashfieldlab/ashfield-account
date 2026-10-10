/**
 * 환경 변수 접근 통일: `process.env.*` 는 이 파일에서만 읽는다.
 *
 * 모든 값은 서버 전용이다 (NEXT_PUBLIC_* 없음). 클라이언트 컴포넌트는 서버 컴포넌트가 props 로
 * 넘긴 값만 쓴다. 키 설명은 `.env.example` 참조.
 *
 * Better Auth CLI(`auth migrate`)와 seed 스크립트(tsx)도 이 파일을 import 하므로 경로 별칭(@/)과
 * "server-only" 를 쓰지 않는다.
 */

function trimSlash(v: string): string {
  return v.replace(/\/+$/, "")
}

/** 쉼표 구분 목록 → 공백 제거, 빈 값 제거. */
export function parseList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export const env = {
  /** 계정 서버 공개 주소 = OIDC issuer. 끝 슬래시 없음. */
  get accountURL(): string {
    return trimSlash(process.env.ACCOUNT_URL || "http://localhost:3300")
  },
  /** Better Auth 엔드포인트 base (`/api/auth`). OAuth 엔드포인트는 그 아래 `/oauth2/*`. */
  get authBaseURL(): string {
    return `${env.accountURL}/api/auth`
  },
  get databaseURL(): string {
    return process.env.DATABASE_URL || "postgres://ashfield:ashfield_dev@localhost:5632/ashfield_account"
  },
  /**
   * BETTER_AUTH_SECRET. `next build` 단계에서만 자리표시 값을 쓴다 (빌드 이미지엔 비밀값이 없음).
   * 런타임에 비어 있으면 Better Auth 가 운영에서 거부한다.
   */
  get secret(): string | undefined {
    if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET
    if (env.isBuildPhase) return "build-phase-placeholder-secret-not-used-at-runtime"
    return undefined
  },
  get isBuildPhase(): boolean {
    return process.env.NEXT_PHASE === "phase-production-build"
  },
  /** `npm run migrate` 가 켠다: 테이블이 아직 없을 때 시작 시 스키마 검사 오류를 띄우지 않게. */
  get skipSchemaCheck(): boolean {
    return process.env.AUTH_SKIP_SCHEMA_CHECK === "true"
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production"
  },

  // ---- 로그인 수단 ----
  get googleClientId(): string {
    return process.env.GOOGLE_CLIENT_ID || ""
  },
  get googleClientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || ""
  },
  get githubClientId(): string {
    return process.env.GITHUB_CLIENT_ID || ""
  },
  get githubClientSecret(): string {
    return process.env.GITHUB_CLIENT_SECRET || ""
  },
  /** 쉼표 구분 허용 이메일. 비면 누구나 가입 가능 (공개 가입). */
  get allowedEmails(): string {
    return process.env.ALLOWED_EMAILS || ""
  },
  /** 로컬, E2E 전용 이메일+비밀번호 로그인 요청 여부. 운영에선 무시된다 (lib/auth/server.ts). */
  get devPasswordLoginRequested(): boolean {
    return process.env.AUTH_DEV_PASSWORD_LOGIN === "true"
  },

  // ---- 토큰 ----
  /** OAuth 액세스 토큰(JWT) 수명(초). 기본 15분. */
  get accessTokenTtlSeconds(): number {
    return Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900)
  },
  /** 리프레시 토큰 수명(초). 기본 30일. 회전(rotation)마다 새로 시작. */
  get refreshTokenTtlSeconds(): number {
    return Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30)
  },

  // ---- 1st-party 앱 (seed:clients, 리소스(aud)) ----
  /** 일정 앱 공개 주소. 액세스 토큰 `aud`(resource) 로도 쓰인다. */
  get calendarURL(): string {
    return trimSlash(process.env.CALENDAR_URL || "http://localhost:3100")
  },
  get driveURL(): string {
    return trimSlash(process.env.DRIVE_URL || "http://localhost:3200")
  },
  get calendarRedirectURIs(): string[] {
    const v = parseList(process.env.CALENDAR_REDIRECT_URIS)
    return v.length ? v : [`${env.calendarURL}/api/auth/callback/ashfield`]
  },
  get driveRedirectURIs(): string[] {
    const v = parseList(process.env.DRIVE_REDIRECT_URIS)
    return v.length ? v : [`${env.driveURL}/api/auth/callback/ashfield`]
  },
  /** ashfield-sync 는 `http://localhost:{port}/oauth/callback` 을 쓴다 (127.0.0.1 바인드). 둘 다 등록. */
  get syncRedirectURIs(): string[] {
    const v = parseList(process.env.SYNC_REDIRECT_URIS)
    return v.length
      ? v
      : ["http://localhost:1421/oauth/callback", "http://127.0.0.1:1421/oauth/callback"]
  },
}
