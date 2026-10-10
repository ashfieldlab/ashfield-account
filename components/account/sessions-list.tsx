"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Laptop, Smartphone, MonitorSmartphone } from "lucide-react"

import { Section } from "@/components/shared/section"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useToast } from "@/components/ui-custom/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { revokeOtherSessionsAction, revokeSessionAction } from "@/lib/actions/account"
import { formatIp, formatRelative } from "@/lib/utils/format"
import { describeUserAgent } from "@/lib/utils/user-agent"

interface SessionItem {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  updatedAt: string
}

export function SessionsList({ sessions, currentSessionId }: { sessions: SessionItem[]; currentSessionId: string }) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const sorted = [...sessions].sort((a, b) =>
    a.id === currentSessionId ? -1 : b.id === currentSessionId ? 1 : b.updatedAt.localeCompare(a.updatedAt),
  )
  const others = sessions.filter((s) => s.id !== currentSessionId).length

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeSessionAction(id)
      if (!res.ok) return void toast.error(res.error)
      toast.success("기기에서 로그아웃했습니다.")
      router.refresh()
    })
  }

  async function revokeOthers() {
    const ok = await confirm({
      title: "다른 모든 기기에서 로그아웃할까요?",
      description: "이 브라우저를 제외한 모든 기기에서 로그아웃됩니다.",
      confirmText: "모두 로그아웃",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await revokeOtherSessionsAction()
      if (!res.ok) return void toast.error(res.error)
      toast.success("다른 기기에서 모두 로그아웃했습니다.")
      router.refresh()
    })
  }

  return (
    <Section
      title="로그인된 브라우저"
      action={
        others > 0 ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void revokeOthers()} data-testid="sessions-revoke-others-button">
            다른 기기 모두 로그아웃
          </Button>
        ) : null
      }
      testId="sessions-card"
    >
      <ul className="divide-y" data-testid="sessions-list">
        {sorted.map((s) => {
          const ua = describeUserAgent(s.userAgent)
          const Icon = ua.kind === "mobile" ? Smartphone : ua.kind === "desktop" ? Laptop : MonitorSmartphone
          const current = s.id === currentSessionId
          return (
            <li key={s.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1" data-testid={`session-row-${s.id}`}>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{ua.label}</span>
                  {current && (
                    <Badge className="text-[11px]" data-testid="session-current-badge">
                      현재 기기
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatIp(s.ipAddress) ? `${formatIp(s.ipAddress)}, ` : ""}
                  {formatRelative(s.updatedAt)} 활동
                </div>
              </div>
              {!current && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => revoke(s.id)} data-testid={`session-row-${s.id}-revoke-button`}>
                  로그아웃
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
