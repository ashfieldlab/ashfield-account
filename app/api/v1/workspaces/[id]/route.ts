import { notFound, verifyBearer } from "@/lib/api/bearer"
import { getWorkspaceForMember } from "@/lib/db/workspaces"

export const dynamic = "force-dynamic"

/** GET /api/v1/workspaces/{id} — 멤버만. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyBearer(req)
  if (!auth.ok) return auth.response
  const { id } = await ctx.params
  const ws = await getWorkspaceForMember(id, auth.claims.sub)
  if (!ws) return notFound()
  return Response.json({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    personal: ws.personal,
    created_at: ws.created_at,
    member_count: ws.member_count,
    my_role: ws.role,
  })
}
