/**
 * Better Auth 서버 인스턴스: 계정 서버의 단일 설정 지점.
 *
 *   - 핸들러: app/api/auth/[...all]/route.ts (`/api/auth/*`), 디스커버리: app/.well-known/*.
 *   - 로그인: Google, GitHub (CLIENT_ID/SECRET 둘 다 있을 때만) + DEV 이메일과 비밀번호
 *     (AUTH_DEV_PASSWORD_LOGIN=true 이고 NODE_ENV≠production 일 때만).
 *   - ALLOWED_EMAILS: 비어 있지 않으면 목록 밖 이메일의 가입과 로그인 거부.
 *   - organization 플러그인 = "워크스페이스" (owner/admin/member). 가입 시 개인 워크스페이스 자동 생성.
 *   - oauthProvider(+jwt) = OIDC 제공자. 계약은 docs/adr/0001-account-server-contract.md.
 *
 * Better Auth CLI(`npm run migrate`)가 이 파일을 직접 읽으므로 "server-only"와 경로 별칭(@/)을
 * 쓰지 않는다. 서버 코드에서만 import 할 것.
 */

import { oauthProvider } from "@better-auth/oauth-provider"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { jwt, organization } from "better-auth/plugins"
import { PostgresDialect } from "kysely"

import { env } from "../env"
import { listUserWorkspaces } from "../db/workspaces"
import { pool } from "../db/pool"
import { logger } from "../utils/logger"
import { isEmailAllowed, parseEmailList } from "./allowlist"
import { hashClientSecret, verifyClientSecret } from "./client-secret"
import { FIRST_PARTY_CLIENT_IDS, RESOURCES } from "./clients"
import {
  betterAuthWorkspaceStore,
  ensurePersonalWorkspace,
  isPersonalWorkspaceMetadata,
  type MinimalAdapter,
} from "./personal-workspace"
import { workspaceInvites } from "./workspace-invites-plugin"

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {}
if (env.googleClientId && env.googleClientSecret) {
  socialProviders.google = { clientId: env.googleClientId, clientSecret: env.googleClientSecret }
}
if (env.githubClientId && env.githubClientSecret) {
  socialProviders.github = { clientId: env.githubClientId, clientSecret: env.githubClientSecret }
}

/** 로그인 화면이 버튼을 그릴 제공자 (설정된 것만). */
export const enabledSocialProviders = Object.keys(socialProviders) as ("google" | "github")[]

/** 이메일+비밀번호 DEV 로그인: 명시 플래그 + 비운영일 때만. */
export const devPasswordLoginEnabled = env.devPasswordLoginRequested && !env.isProduction

if (env.devPasswordLoginRequested && env.isProduction && !env.isBuildPhase) {
  logger.error("dev_password_login_refused_in_production", {
    category: "auth",
    detail: "AUTH_DEV_PASSWORD_LOGIN=true 는 NODE_ENV=production 에서 무시됩니다.",
  })
}

const allowlist = parseEmailList(env.allowedEmails)

/** 개인 워크스페이스 보장: 실패해도 로그인은 막지 않는다 (다음 로그인 때 다시 시도). */
async function ensurePersonal(
  adapter: MinimalAdapter,
  user: { id: string; name?: string | null; email: string },
) {
  try {
    const { created, workspace } = await ensurePersonalWorkspace(betterAuthWorkspaceStore(adapter), user)
    if (created) logger.info("personal_workspace_created", { category: "biz", workspaceId: workspace.id })
  } catch (err) {
    logger.error("personal_workspace_failed", { category: "biz", userId: user.id, err: String(err) })
  }
}

export const auth = betterAuth({
  appName: "Ashfield 계정",
  baseURL: env.accountURL,
  secret: env.secret,
  database: { dialect: new PostgresDialect({ pool }), type: "postgres" },
  // jwt 플러그인의 세션→JWT 엔드포인트는 쓰지 않는다 (토큰은 OAuth 토큰 엔드포인트로만).
  disabledPaths: ["/token"],
  socialProviders,
  emailAndPassword: { enabled: devPasswordLoginEnabled, autoSignIn: true },
  account: { accountLinking: { enabled: true, trustedProviders: ["google", "github"] } },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  user: {
    // 가입, 계정 연결, OAuth 재로그인 시점의 이메일 검사.
    validateUserInfo: ({ user }) => {
      if (!isEmailAllowed(user.email, allowlist)) {
        return { error: "email_not_allowed", errorDescription: "허용되지 않은 이메일입니다." }
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          const adapter = (ctx?.context.adapter ?? (await auth.$context).adapter) as unknown as MinimalAdapter
          await ensurePersonal(adapter, user)
        },
      },
    },
    session: {
      create: {
        // 비밀번호 재로그인처럼 validateUserInfo 를 안 타는 경로까지: 세션 발급 직전에 한 번 더.
        before: async (session, ctx) => {
          if (allowlist.size === 0) return
          const user = await ctx?.context.internalAdapter.findUserById(session.userId)
          if (!user || !isEmailAllowed(user.email, allowlist)) {
            throw new APIError("FORBIDDEN", { code: "EMAIL_NOT_ALLOWED", message: "허용되지 않은 이메일입니다." })
          }
        },
        // 기능 도입 전 가입자와 이전 실패 복구용 (멱등, slug 조회 1회).
        after: async (session, ctx) => {
          const c = ctx?.context ?? (await auth.$context)
          const user = await c.internalAdapter.findUserById(session.userId)
          if (user) await ensurePersonal(c.adapter as unknown as MinimalAdapter, user)
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "ashfield-account",
    // 스키마 검증(누락 시 "npm run migrate" 안내)은 런타임에만: 빌드와 마이그레이션 중엔 끈다.
    database: { validateSchema: !env.isBuildPhase && !env.skipSchemaCheck },
  },
  plugins: [
    // 액세스와 ID 토큰 서명 키 (JWKS: /api/auth/jwks). 앱 백엔드(Python)가 검증하기 쉽게 RS256.
    jwt({
      jwks: { keyPairConfig: { alg: "RS256", modulusLength: 2048 } },
      jwt: { issuer: env.accountURL },
      disableSettingJwtHeader: true,
    }),
    organization({
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      organizationHooks: {
        beforeDeleteOrganization: async ({ organization }) => {
          if (isPersonalWorkspaceMetadata(organization.metadata)) {
            throw new APIError("BAD_REQUEST", {
              code: "PERSONAL_WORKSPACE",
              message: "개인 워크스페이스는 삭제할 수 없습니다.",
            })
          }
        },
      },
    }),
    workspaceInvites(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: ["openid", "profile", "email", "offline_access"],
      accessTokenExpiresIn: env.accessTokenTtlSeconds,
      refreshTokenExpiresIn: env.refreshTokenTtlSeconds,
      // 1st-party 앱 API = OAuth 리소스. 토큰 요청에 `resource` 가 있어야 JWT 액세스 토큰이 나온다.
      resources: RESOURCES.map((r) => ({ identifier: r.identifier, name: r.name })),
      resourceSeedMode: "merge",
      enforcePerClientResources: true,
      cachedTrustedClients: new Set(FIRST_PARTY_CLIENT_IDS),
      allowDynamicClientRegistration: false,
      grantTypes: ["authorization_code", "refresh_token"],
      storeClientSecret: { hash: hashClientSecret, verify: verifyClientSecret },
      // 앱이 별도 호출 없이 신원과 소속을 알도록 액세스 토큰에 싣는다. 소속 변경은 다음 갱신(≤ TTL)에 반영.
      customAccessTokenClaims: async ({ user, scopes }) => {
        if (!user) return {}
        return {
          ...(scopes.includes("email") ? { email: user.email, email_verified: user.emailVerified } : {}),
          ...(scopes.includes("profile") ? { name: user.name, picture: user.image ?? null } : {}),
          workspaces: await listUserWorkspaces(user.id),
        }
      },
      customUserInfoClaims: async ({ user }) => ({
        workspaces: await listUserWorkspaces(user.id),
      }),
      advertisedMetadata: {
        claims_supported: [
          "sub",
          "iss",
          "aud",
          "exp",
          "iat",
          "name",
          "picture",
          "email",
          "email_verified",
          "workspaces",
        ],
      },
    }),
    // server action 에서 auth.api.* 가 심는 쿠키를 Next 응답에 반영 (반드시 마지막).
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
