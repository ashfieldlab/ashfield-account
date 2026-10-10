import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { ArrowRight, Building2 } from "lucide-react"

import { ConnectedApps } from "@/components/account/connected-apps"
import { ProfileCard } from "@/components/account/profile-card"
import { SessionsList } from "@/components/account/sessions-list"
import { PageHeader } from "@/components/shared/page-header"
import { auth } from "@/lib/auth/server"
import { requireSession } from "@/lib/auth/session"
import { listConnectedApps } from "@/lib/db/account"
import { listUserWorkspaces } from "@/lib/db/workspaces"

export const metadata: Metadata = { title: "내 계정" }

export default async function AccountHomePage() {
  const session = await requireSession()
  const h = await headers()
  const [accounts, sessions, apps, workspaces] = await Promise.all([
    auth.api.listUserAccounts({ headers: h }),
    auth.api.listSessions({ headers: h }),
    listConnectedApps(session.user.id),
    listUserWorkspaces(session.user.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`안녕하세요, ${session.user.name}님`}
        description="Ashfield 앱 전체에서 쓰는 계정 정보와 로그인 상태를 관리합니다."
      />

      <ProfileCard
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
          createdAt: new Date(session.user.createdAt).toISOString(),
        }}
        providers={accounts.map((a) => a.providerId)}
      />

      <Link
        href="/workspaces"
        className="group flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-xs transition-colors hover:border-primary/30 hover:bg-primary/[0.03] sm:px-6"
        data-testid="home-workspaces-link"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight">워크스페이스</div>
          <div className="truncate text-sm text-muted-foreground">
            {workspaces.length}개 소속 · {workspaces.slice(0, 3).map((w) => w.name).join(", ")}
            {workspaces.length > 3 ? " 외" : ""}
          </div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <ConnectedApps apps={apps} />

      <SessionsList
        currentSessionId={session.session.id}
        sessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent ?? null,
          ipAddress: s.ipAddress ?? null,
          createdAt: new Date(s.createdAt).toISOString(),
          updatedAt: new Date(s.updatedAt).toISOString(),
        }))}
      />
    </div>
  )
}
