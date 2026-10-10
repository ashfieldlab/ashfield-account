/**
 * /api/v1/* 의 Bearer 인증: 이 서버가 발급한 OAuth 액세스 토큰(JWT)만 받는다.
 *
 *   - 서명: 자기 JWKS (DB 의 jwks 테이블; 60초 캐시)
 *   - iss = ACCOUNT_URL, aud ∋ 1st-party 리소스(CALENDAR_URL | DRIVE_URL) 중 하나, exp
 *
 * 앱 백엔드가 같은 토큰을 받아 이 API 를 그대로 호출하면 된다 (토큰 교환 불필요).
 */
import "server-only"

import { createLocalJWKSet, jwtVerify, type JWTPayload } from "jose"

import { auth } from "@/lib/auth/server"
import { RESOURCES } from "@/lib/auth/clients"
import { env } from "@/lib/env"

let cached: { at: number; jwks: ReturnType<typeof createLocalJWKSet> } | null = null

async function localJwks() {
  if (cached && Date.now() - cached.at < 60_000) return cached.jwks
  const jwks = createLocalJWKSet(await auth.api.getJwks())
  cached = { at: Date.now(), jwks }
  return jwks
}

export interface AccessTokenClaims extends JWTPayload {
  sub: string
  scope?: string
  client_id?: string
  email?: string
  name?: string
}

export type BearerResult = { ok: true; claims: AccessTokenClaims } | { ok: false; response: Response }

function unauthorized(description: string): Response {
  return Response.json(
    { error: "invalid_token", error_description: description },
    {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer error="invalid_token", error_description="${description}"` },
    },
  )
}

export async function verifyBearer(req: Request): Promise<BearerResult> {
  const header = req.headers.get("authorization") ?? ""
  const m = /^Bearer\s+(.+)$/i.exec(header)
  if (!m) {
    return {
      ok: false,
      response: Response.json(
        { error: "unauthorized", error_description: "Authorization: Bearer <access_token> 가 필요합니다." },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      ),
    }
  }
  try {
    const { payload } = await jwtVerify(m[1], await localJwks(), {
      issuer: env.accountURL,
      audience: RESOURCES.map((r) => r.identifier),
    })
    if (!payload.sub) return { ok: false, response: unauthorized("sub 가 없습니다.") }
    return { ok: true, claims: payload as AccessTokenClaims }
  } catch (err) {
    return { ok: false, response: unauthorized(err instanceof Error ? err.message : "invalid token") }
  }
}

export function notFound(description = "워크스페이스를 찾을 수 없거나 멤버가 아닙니다."): Response {
  return Response.json({ error: "not_found", error_description: description }, { status: 404 })
}
