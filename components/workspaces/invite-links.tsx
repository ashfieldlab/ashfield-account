"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2, Loader2, Trash2 } from "lucide-react"

import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/section"
import { RoleBadge } from "@/components/workspaces/role-badge"
import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createInviteLinkAction, revokeInviteLinkAction } from "@/lib/actions/workspaces"
import type { InviteLink } from "@/lib/db/invites"
import { formatRemaining } from "@/lib/utils/format"

export function InviteLinks({
  workspaceId,
  invites,
  accountURL,
}: {
  workspaceId: string
  invites: InviteLink[]
  accountURL: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [role, setRole] = useState<"member" | "admin">("member")
  const [pending, startTransition] = useTransition()
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const linkFor = (id: string) => `${accountURL}/invite/${id}`

  function create() {
    startTransition(async () => {
      const res = await createInviteLinkAction(workspaceId, role)
      if (!res.ok) return void toast.error(res.error)
      setJustCreated(res.data!.id)
      try {
        await navigator.clipboard.writeText(linkFor(res.data!.id))
        toast.success("초대 링크를 만들고 클립보드에 복사했습니다.")
      } catch {
        toast.success("초대 링크를 만들었습니다.")
      }
      router.refresh()
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInviteLinkAction(workspaceId, id)
      if (!res.ok) return void toast.error(res.error)
      toast.success("초대 링크를 취소했습니다.")
      router.refresh()
    })
  }

  return (
    <Section
      title="초대 링크"
      description="링크를 받은 사람은 Ashfield 계정으로 로그인해 바로 참여합니다. 링크는 7일 동안 여러 번 쓸 수 있습니다."
      action={
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
            <SelectTrigger size="sm" className="w-[100px]" aria-label="초대 역할" data-testid="invite-role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="member" data-testid="invite-role-option-member">
                멤버
              </SelectItem>
              <SelectItem value="admin" data-testid="invite-role-option-admin">
                관리자
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" disabled={pending} onClick={create} data-testid="invite-create-button">
            {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
            링크 만들기
          </Button>
        </div>
      }
      testId="invite-links"
    >
      {invites.length === 0 ? (
        <EmptyState
          icon={<Link2 />}
          title="활성 초대 링크가 없습니다"
          description="‘링크 만들기’로 링크를 만들어 메신저 등으로 보내세요."
          testId="invite-links-empty"
        />
      ) : (
        <ul className="space-y-2" data-testid="invite-links-list">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                justCreated === inv.id ? "border-primary/40 bg-primary/[0.04]" : ""
              }`}
              data-testid={`invite-link-${inv.id}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  readOnly
                  value={linkFor(inv.id)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full truncate rounded-md bg-muted/60 px-2 py-1 font-mono text-xs text-foreground outline-none"
                  aria-label="초대 링크"
                  data-testid={`invite-link-${inv.id}-url-input`}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <RoleBadge role={inv.role} />
                  <span>{formatRemaining(inv.expiresAt)}</span>
                  <span>· {inv.acceptedCount}명 참여</span>
                  {inv.inviterName && <span>· {inv.inviterName} 생성</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <CopyButton value={linkFor(inv.id)} toastMessage="초대 링크를 복사했습니다." testId={`invite-link-${inv.id}-copy-button`} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => revoke(inv.id)}
                  aria-label="링크 취소"
                  data-testid={`invite-link-${inv.id}-revoke-button`}
                >
                  <Trash2 />
                  취소
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
