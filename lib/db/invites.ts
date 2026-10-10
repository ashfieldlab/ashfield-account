/**
 * 워크스페이스 초대 링크 (workspaceInvite 테이블 — lib/auth/workspace-invites-plugin.ts).
 * 서버 전용. 권한 검사는 호출부(lib/actions/workspaces.ts)가 한다.
 */
import "server-only"

import { randomBytes } from "node:crypto"

import { pool } from "./pool"

export const INVITE_TTL_DAYS = 7

export interface InviteLink {
  id: string
  organizationId: string
  role: "admin" | "member"
  inviterId: string
  inviterName: string | null
  expiresAt: string
  createdAt: string
  acceptedCount: number
}

function toInvite(r: Record<string, unknown>): InviteLink {
  return {
    id: r.id as string,
    organizationId: r.organizationId as string,
    role: r.role as InviteLink["role"],
    inviterId: r.inviterId as string,
    inviterName: (r.inviterName as string | null) ?? null,
    expiresAt: (r.expiresAt as Date).toISOString(),
    createdAt: (r.createdAt as Date).toISOString(),
    acceptedCount: Number(r.acceptedCount ?? 0),
  }
}

export async function createInviteLink(input: {
  organizationId: string
  role: "admin" | "member"
  inviterId: string
}): Promise<InviteLink> {
  // 링크 토큰 = 행 id. 추측 불가능하도록 192비트 무작위.
  const id = randomBytes(24).toString("base64url")
  const { rows } = await pool.query(
    `insert into "workspaceInvite" ("id","organizationId","role","inviterId","expiresAt","createdAt","acceptedCount")
     values ($1,$2,$3,$4, now() + ($5 || ' days')::interval, now(), 0)
     returning *`,
    [id, input.organizationId, input.role, input.inviterId, String(INVITE_TTL_DAYS)],
  )
  return toInvite(rows[0])
}

export async function listActiveInviteLinks(organizationId: string): Promise<InviteLink[]> {
  const { rows } = await pool.query(
    `select i.*, u."name" as "inviterName" from "workspaceInvite" i
       left join "user" u on u."id" = i."inviterId"
      where i."organizationId" = $1 and i."expiresAt" > now()
      order by i."createdAt" desc`,
    [organizationId],
  )
  return rows.map(toInvite)
}

/** 초대 + 워크스페이스 이름 (만료 포함 — 화면에서 만료 안내). */
export async function getInviteLink(
  id: string,
): Promise<(InviteLink & { organizationName: string; expired: boolean }) | null> {
  const { rows } = await pool.query(
    `select i.*, u."name" as "inviterName", o."name" as "organizationName", (i."expiresAt" <= now()) as expired
       from "workspaceInvite" i
       join "organization" o on o."id" = i."organizationId"
       left join "user" u on u."id" = i."inviterId"
      where i."id" = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) return null
  return { ...toInvite(r), organizationName: r.organizationName as string, expired: r.expired as boolean }
}

export async function deleteInviteLink(id: string, organizationId: string): Promise<boolean> {
  const res = await pool.query(`delete from "workspaceInvite" where "id" = $1 and "organizationId" = $2`, [
    id,
    organizationId,
  ])
  return (res.rowCount ?? 0) > 0
}

export async function incrementInviteAccepted(id: string): Promise<void> {
  await pool.query(`update "workspaceInvite" set "acceptedCount" = "acceptedCount" + 1 where "id" = $1`, [id])
}

export async function getMemberRole(organizationId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `select "role" from "member" where "organizationId" = $1 and "userId" = $2`,
    [organizationId, userId],
  )
  return (rows[0]?.role as string | undefined) ?? null
}
