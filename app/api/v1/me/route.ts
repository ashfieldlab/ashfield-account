import { verifyBearer } from "@/lib/api/bearer"
import { pool } from "@/lib/db/pool"
import { listUserWorkspaces } from "@/lib/db/workspaces"

export const dynamic = "force-dynamic"

/** GET /api/v1/me: 토큰 주인의 최신 프로필 + 워크스페이스 (토큰 클레임보다 최신). */
export async function GET(req: Request) {
  const auth = await verifyBearer(req)
  if (!auth.ok) return auth.response
  const { rows } = await pool.query(
    `select "id", "email", "name", "image", "emailVerified" from "user" where "id" = $1`,
    [auth.claims.sub],
  )
  const u = rows[0]
  if (!u) return Response.json({ error: "not_found", error_description: "사용자가 없습니다." }, { status: 404 })
  return Response.json({
    sub: u.id,
    email: u.email,
    email_verified: u.emailVerified,
    name: u.name,
    picture: u.image ?? null,
    workspaces: await listUserWorkspaces(u.id),
  })
}
