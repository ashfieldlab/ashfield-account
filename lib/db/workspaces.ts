/**
 * 워크스페이스 조회 SQL: 토큰 클레임(`workspaces`)과 /api/v1/* 가 같은 함수를 쓴다.
 * 테이블과 컬럼은 Better Auth organization 플러그인 기본 이름 (camelCase, 따옴표 필요).
 * 경로 별칭(@/) 금지 (server.ts 경유로 Better Auth CLI 가 읽음).
 */
import { pool } from "./pool"

export type WorkspaceRole = "owner" | "admin" | "member"

export interface WorkspaceClaim {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
}

export interface WorkspaceMemberRow {
  member_id: string
  user_id: string
  email: string
  name: string
  picture: string | null
  role: WorkspaceRole
  joined_at: string
}

/** 사용자가 속한 워크스페이스 (가입 순). 액세스 토큰 `workspaces` 클레임의 원천. */
export async function listUserWorkspaces(userId: string): Promise<WorkspaceClaim[]> {
  const { rows } = await pool.query<WorkspaceClaim>(
    `select o."id" as id, o."name" as name, o."slug" as slug, m."role" as role
       from "member" m join "organization" o on o."id" = m."organizationId"
      where m."userId" = $1
      order by m."createdAt" asc, o."id" asc`,
    [userId],
  )
  return rows
}

export async function getWorkspaceForMember(
  workspaceId: string,
  userId: string,
): Promise<(WorkspaceClaim & { created_at: string; member_count: number; personal: boolean }) | null> {
  const { rows } = await pool.query(
    `select o."id" as id, o."name" as name, o."slug" as slug, m."role" as role,
            o."createdAt" as created_at, o."metadata" as metadata,
            (select count(*)::int from "member" mm where mm."organizationId" = o."id") as member_count
       from "organization" o join "member" m on m."organizationId" = o."id" and m."userId" = $2
      where o."id" = $1`,
    [workspaceId, userId],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    member_count: r.member_count,
    created_at: new Date(r.created_at).toISOString(),
    personal: isPersonalMetadata(r.metadata),
  }
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
  const { rows } = await pool.query<WorkspaceMemberRow>(
    `select m."id" as member_id, u."id" as user_id, u."email" as email, u."name" as name, u."image" as picture,
            m."role" as role, m."createdAt" as joined_at
       from "member" m join "user" u on u."id" = m."userId"
      where m."organizationId" = $1
      order by case m."role" when 'owner' then 0 when 'admin' then 1 else 2 end, m."createdAt" asc`,
    [workspaceId],
  )
  return rows
}

export interface WorkspaceSummary extends WorkspaceClaim {
  member_count: number
  personal: boolean
  created_at: string
}

/** 워크스페이스 목록 화면용: 멤버 수와 개인 여부 포함. */
export async function listUserWorkspaceSummaries(userId: string): Promise<WorkspaceSummary[]> {
  const { rows } = await pool.query(
    `select o."id" as id, o."name" as name, o."slug" as slug, m."role" as role,
            o."createdAt" as created_at, o."metadata" as metadata,
            (select count(*)::int from "member" mm where mm."organizationId" = o."id") as member_count
       from "member" m join "organization" o on o."id" = m."organizationId"
      where m."userId" = $1
      order by m."createdAt" asc, o."id" asc`,
    [userId],
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    member_count: r.member_count,
    created_at: new Date(r.created_at).toISOString(),
    personal: isPersonalMetadata(r.metadata),
  }))
}

function isPersonalMetadata(v: unknown): boolean {
  try {
    const o = typeof v === "string" ? JSON.parse(v) : v
    return !!o && typeof o === "object" && (o as { personal?: unknown }).personal === true
  } catch {
    return false
  }
}
