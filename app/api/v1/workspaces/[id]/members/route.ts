import { notFound, verifyBearer } from "@/lib/api/bearer"
import { getWorkspaceForMember, listWorkspaceMembers } from "@/lib/db/workspaces"

export const dynamic = "force-dynamic"

/** GET /api/v1/workspaces/{id}/members — 멤버만. 앱의 멤버 선택·자동완성용. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyBearer(req)
  if (!auth.ok) return auth.response
  const { id } = await ctx.params
  const ws = await getWorkspaceForMember(id, auth.claims.sub)
  if (!ws) return notFound()
  const members = await listWorkspaceMembers(id)
  return Response.json({
    workspace_id: id,
    members: members.map((m) => ({
      sub: m.user_id,
      email: m.email,
      name: m.name,
      picture: m.picture,
      role: m.role,
      joined_at: new Date(m.joined_at).toISOString(),
    })),
  })
}
