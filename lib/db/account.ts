/**
 * 계정 홈 조회 — OAuth 로 연결된 앱과 그 기기(리프레시 토큰) 목록.
 * 테이블은 @better-auth/oauth-provider 기본 이름. 서버 전용.
 */
import "server-only"

import { pool } from "./pool"

export interface AppGrant {
  /** oauthRefreshToken.id — 연결 해제 대상 */
  id: string
  createdAt: string
  expiresAt: string
  scopes: string[]
}

export interface ConnectedApp {
  clientId: string
  name: string
  uri: string | null
  icon: string | null
  firstParty: boolean
  /** 활성 리프레시 토큰 = 로그인돼 있는 기기·세션 */
  grants: AppGrant[]
  consentedAt: string | null
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback
  if (typeof v !== "string") return v as T
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

/**
 * 활성 리프레시 토큰(회전·폐기·만료 안 된 것)이나 동의 기록이 있는 클라이언트.
 * 1st-party 앱은 동의를 건너뛰므로 리프레시 토큰으로만 나타난다.
 */
export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const [tokens, consents] = await Promise.all([
    pool.query(
      `select t."id", t."clientId", t."createdAt", t."expiresAt", t."scopes"
         from "oauthRefreshToken" t
        where t."userId" = $1 and t."revoked" is null and t."rotatedAt" is null
          and t."expiresAt" > now()
        order by t."createdAt" desc`,
      [userId],
    ),
    pool.query(`select "clientId", "updatedAt" from "oauthConsent" where "userId" = $1`, [userId]),
  ])
  const clientIds = [
    ...new Set([...tokens.rows.map((r) => r.clientId as string), ...consents.rows.map((r) => r.clientId as string)]),
  ]
  if (clientIds.length === 0) return []
  const clients = await pool.query(
    `select "clientId", "name", "uri", "icon", "metadata" from "oauthClient" where "clientId" = any($1)`,
    [clientIds],
  )
  const consentBy = new Map(consents.rows.map((r) => [r.clientId as string, r.updatedAt as Date]))
  return clients.rows
    .map((c) => ({
      clientId: c.clientId as string,
      name: (c.name as string | null) ?? (c.clientId as string),
      uri: c.uri as string | null,
      icon: c.icon as string | null,
      firstParty: parseJson<{ firstParty?: boolean }>(c.metadata, {}).firstParty === true,
      consentedAt: consentBy.get(c.clientId)?.toISOString() ?? null,
      grants: tokens.rows
        .filter((t) => t.clientId === c.clientId)
        .map((t) => ({
          id: t.id as string,
          createdAt: (t.createdAt as Date).toISOString(),
          expiresAt: (t.expiresAt as Date).toISOString(),
          scopes: parseJson<string[]>(t.scopes, []),
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 리프레시 토큰 하나 폐기 (본인 것만). 회전 체인의 다음 토큰은 아직 없으므로 이 행만 막으면 된다. */
export async function revokeGrant(userId: string, grantId: string): Promise<boolean> {
  const res = await pool.query(
    `update "oauthRefreshToken" set "revoked" = now()
      where "id" = $1 and "userId" = $2 and "revoked" is null`,
    [grantId, userId],
  )
  return (res.rowCount ?? 0) > 0
}

/** 앱 연결 해제 — 그 앱의 모든 리프레시 토큰 폐기 + 동의 삭제. 이미 발급된 액세스 토큰은 만료(≤ TTL)까지 유효. */
export async function disconnectApp(userId: string, clientId: string): Promise<void> {
  await pool.query(
    `update "oauthRefreshToken" set "revoked" = now()
      where "userId" = $1 and "clientId" = $2 and "revoked" is null`,
    [userId, clientId],
  )
  await pool.query(`delete from "oauthConsent" where "userId" = $1 and "clientId" = $2`, [userId, clientId])
}

export async function getClientDisplay(
  clientId: string,
): Promise<{ name: string; uri: string | null; icon: string | null; firstParty: boolean } | null> {
  const { rows } = await pool.query(
    `select "name", "uri", "icon", "metadata" from "oauthClient" where "clientId" = $1`,
    [clientId],
  )
  const c = rows[0]
  if (!c) return null
  return {
    name: (c.name as string | null) ?? clientId,
    uri: c.uri,
    icon: c.icon,
    firstParty: parseJson<{ firstParty?: boolean }>(c.metadata, {}).firstParty === true,
  }
}
