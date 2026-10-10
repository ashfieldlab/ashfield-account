"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserMinus } from "lucide-react"

import { Section } from "@/components/shared/section"
import { UserAvatar } from "@/components/shared/user-avatar"
import { RoleBadge } from "@/components/workspaces/role-badge"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useToast } from "@/components/ui-custom/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { removeMemberAction, updateMemberRoleAction } from "@/lib/actions/workspaces"
import { formatDate } from "@/lib/utils/format"
import { ROLE_LABEL, type Role } from "@/lib/workspace-roles"

interface Member {
  member_id: string
  user_id: string
  email: string
  name: string
  picture: string | null
  role: string
  joined_at: string
}

export function MembersList({
  workspaceId,
  members,
  currentUserId,
  myRole,
}: {
  workspaceId: string
  members: Member[]
  currentUserId: string
  myRole: string
}) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /** 서버(org 플러그인)가 최종 판단: 여기선 명백히 안 되는 조작만 숨긴다. */
  function canEdit(target: Member): boolean {
    if (target.user_id === currentUserId) return false
    if (myRole === "owner") return true
    if (myRole === "admin") return target.role !== "owner"
    return false
  }
  const assignable: Role[] = myRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"]

  function changeRole(m: Member, role: Role) {
    startTransition(async () => {
      const res = await updateMemberRoleAction(workspaceId, m.member_id, role)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${m.name}님의 역할을 ${ROLE_LABEL[role]}(으)로 바꿨습니다.`)
      router.refresh()
    })
  }

  async function remove(m: Member) {
    const ok = await confirm({
      title: `${m.name}님을 내보낼까요?`,
      description: "이 워크스페이스의 데이터에 더 이상 접근할 수 없습니다. 앱에는 다음 토큰 갱신 때 반영됩니다.",
      confirmText: "내보내기",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await removeMemberAction(workspaceId, m.member_id)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${m.name}님을 내보냈습니다.`)
      router.refresh()
    })
  }

  return (
    <Section
      title="멤버"
      description="소유자: 모든 권한 · 관리자: 이름 변경·멤버 관리·초대 · 멤버: 워크스페이스 사용"
      testId="workspace-members"
    >
      <ul className="divide-y" data-testid="workspace-members-list">
        {members.map((m) => {
          const editable = canEdit(m)
          return (
            <li key={m.member_id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-1" data-testid={`workspace-member-${m.user_id}`}>
              <UserAvatar name={m.name} email={m.email} image={m.picture} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{m.name}</span>
                  {m.user_id === currentUserId && (
                    <Badge variant="outline" className="text-[11px]">
                      나
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.email} · {formatDate(m.joined_at)} 참여
                </div>
              </div>
              {editable ? (
                <div className="flex items-center gap-1">
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as Role)} disabled={pending}>
                    <SelectTrigger size="sm" className="w-[112px]" data-testid={`workspace-member-${m.user_id}-role-select`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {assignable.map((r) => (
                        <SelectItem key={r} value={r} data-testid={`workspace-member-role-option-${r}`}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="내보내기"
                    disabled={pending}
                    onClick={() => void remove(m)}
                    data-testid={`workspace-member-${m.user_id}-remove-button`}
                  >
                    <UserMinus />
                  </Button>
                </div>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
