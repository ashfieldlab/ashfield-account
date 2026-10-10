import { verifyBearer } from "@/lib/api/bearer"
import { listUserWorkspaces } from "@/lib/db/workspaces"

export const dynamic = "force-dynamic"

/** GET /api/v1/workspaces — 토큰 주인이 속한 워크스페이스 (= 토큰 `workspaces` 클레임의 최신판). */
export async function GET(req: Request) {
  const auth = await verifyBearer(req)
  if (!auth.ok) return auth.response
  return Response.json({ workspaces: await listUserWorkspaces(auth.claims.sub) })
}
