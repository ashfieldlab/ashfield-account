import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DangerZone } from "@/components/workspaces/danger-zone"
import { InviteLinks } from "@/components/workspaces/invite-links"
import { MembersList } from "@/components/workspaces/members-list"
import { RoleBadge } from "@/components/workspaces/role-badge"
import { WorkspaceGeneral } from "@/components/workspaces/workspace-general"
import { Badge } from "@/components/ui/badge"
import { env } from "@/lib/env"
import { requireSession } from "@/lib/auth/session"
import { listActiveInviteLinks } from "@/lib/db/invites"
import { getWorkspaceForMember, listWorkspaceMembers } from "@/lib/db/workspaces"
import { canManage } from "@/lib/workspace-roles"

export const metadata: Metadata = { title: "워크스페이스" }

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/workspaces/${id}`)
  const workspace = await getWorkspaceForMember(id, session.user.id)
  if (!workspace) notFound()

  const manager = canManage(workspace.role)
  const [members, invites] = await Promise.all([
    listWorkspaceMembers(id),
    manager ? listActiveInviteLinks(id) : Promise.resolve([]),
  ])
  const ownerCount = members.filter((m) => m.role === "owner").length

  return (
    <div className="space-y-6">
      <Link
        href="/workspaces"
        className="-mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        data-testid="workspace-back-link"
      >
        <ChevronLeft className="size-4" />
        워크스페이스
      </Link>
      <PageHeader
        title={<span data-testid="workspace-title">{workspace.name}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <RoleBadge role={workspace.role} />
            {workspace.personal && (
              <Badge variant="outline" className="text-[11px]">
                개인
              </Badge>
            )}
            <span>멤버 {workspace.member_count}명</span>
          </span>
        }
      />

      <WorkspaceGeneral
        workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
        canEdit={manager}
      />

      <MembersList
        workspaceId={workspace.id}
        members={members.map((m) => ({ ...m, joined_at: new Date(m.joined_at).toISOString() }))}
        currentUserId={session.user.id}
        myRole={workspace.role}
      />

      {manager && <InviteLinks workspaceId={workspace.id} invites={invites} accountURL={env.accountURL} />}

      <DangerZone
        workspace={{ id: workspace.id, name: workspace.name, personal: workspace.personal }}
        myRole={workspace.role}
        soleOwner={workspace.role === "owner" && ownerCount <= 1}
      />
    </div>
  )
}
