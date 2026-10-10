import type { Metadata } from "next"
import Link from "next/link"
import { Building2, ChevronRight, UserRound, Users } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog"
import { RoleBadge } from "@/components/workspaces/role-badge"
import { Badge } from "@/components/ui/badge"
import { requireSession } from "@/lib/auth/session"
import { listUserWorkspaceSummaries } from "@/lib/db/workspaces"
import { formatDate } from "@/lib/utils/format"

export const metadata: Metadata = { title: "워크스페이스" }

export default async function WorkspacesPage() {
  const session = await requireSession("/workspaces")
  const workspaces = await listUserWorkspaceSummaries(session.user.id)

  return (
    <div>
      <PageHeader
        title="워크스페이스"
        action={<CreateWorkspaceDialog />}
      />
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="workspaces-list">
        {workspaces.map((w) => (
          <li key={w.id}>
            <Link
              href={`/workspaces/${w.id}`}
              className="group flex h-full items-start gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-sm"
              data-testid={`workspaces-row-${w.id}`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary">
                {w.personal ? <UserRound className="size-5" /> : w.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold tracking-tight" data-testid={`workspaces-row-${w.id}-name`}>
                    {w.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={w.role} />
                  {w.personal && (
                    <Badge variant="outline" className="text-[11px]">
                      개인
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    멤버 {w.member_count}명
                  </span>
                  <span>{formatDate(w.created_at)} 생성</span>
                </div>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
        <li>
          <CreateWorkspaceDialog
            trigger={
              <button
                type="button"
                className="flex h-full min-h-[118px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground"
                data-testid="workspaces-create-tile"
              >
                <Building2 className="size-5" />새 워크스페이스 만들기
              </button>
            }
          />
        </li>
      </ul>
    </div>
  )
}
