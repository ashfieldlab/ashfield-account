"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { AppWindow, CalendarDays, FolderSync, HardDrive, Unplug } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/section"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useToast } from "@/components/ui-custom/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { disconnectAppAction, revokeGrantAction } from "@/lib/actions/account"
import type { ConnectedApp } from "@/lib/db/account"
import { formatRelative } from "@/lib/utils/format"

function AppIconFor({ clientId }: { clientId: string }) {
  const Icon =
    clientId === "ashfield-calendar"
      ? CalendarDays
      : clientId === "ashfield-drive"
        ? HardDrive
        : clientId === "ashfield-sync"
          ? FolderSync
          : AppWindow
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="size-5" />
    </div>
  )
}

export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function disconnect(app: ConnectedApp) {
    const ok = await confirm({
      title: `${app.name} 연결을 해제할까요?`,
      description: "이 앱의 모든 기기에서 로그아웃됩니다.",
      confirmText: "연결 해제",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await disconnectAppAction(app.clientId)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${app.name} 연결을 해제했습니다.`)
      router.refresh()
    })
  }

  function revoke(grantId: string) {
    startTransition(async () => {
      const res = await revokeGrantAction(grantId)
      if (!res.ok) return void toast.error(res.error)
      toast.success("해당 기기에서 로그아웃했습니다.")
      router.refresh()
    })
  }

  return (
    <Section
      title="연결된 앱"
      testId="connected-apps"
    >
      {apps.length === 0 ? (
        <EmptyState
          icon={<AppWindow />}
          title="아직 연결된 앱이 없습니다"
          testId="connected-apps-empty"
        />
      ) : (
        <ul className="divide-y" data-testid="connected-apps-list">
          {apps.map((app) => (
            <li key={app.clientId} className="py-4 first:pt-1 last:pb-1" data-testid={`connected-app-${app.clientId}`}>
              <div className="flex items-center gap-3">
                <AppIconFor clientId={app.clientId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{app.name}</span>
                    {app.firstParty && (
                      <Badge variant="secondary" className="text-[11px]">
                        Ashfield
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {app.grants.length > 0 ? `${app.grants.length}개 기기에서 로그인됨` : "로그인된 기기 없음"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void disconnect(app)}
                  data-testid={`connected-app-${app.clientId}-disconnect-button`}
                >
                  <Unplug />
                  연결 해제
                </Button>
              </div>
              {app.grants.length > 0 && (
                <ul className="mt-3 space-y-1.5 pl-[52px]">
                  {app.grants.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                      data-testid={`connected-app-grant-${g.id}`}
                    >
                      <span className="text-muted-foreground">
                        {formatRelative(g.createdAt)} 마지막 갱신, {g.scopes.includes("offline_access") ? "로그인 유지" : "세션"}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={pending}
                        onClick={() => revoke(g.id)}
                        data-testid={`connected-app-grant-${g.id}-revoke-button`}
                      >
                        로그아웃
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
