"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { UserAvatar } from "@/components/shared/user-avatar"
import { RoleBadge } from "@/components/workspaces/role-badge"
import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"
import { acceptInviteAction } from "@/lib/actions/workspaces"
import { authClient } from "@/lib/auth/client"

export function AcceptInvite({
  inviteId,
  workspace,
  role,
  inviterName,
  user,
  alreadyMember,
}: {
  inviteId: string
  workspace: { id: string; name: string }
  role: string
  inviterName: string | null
  user: { name: string; email: string; image: string | null }
  alreadyMember: boolean
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function accept() {
    startTransition(async () => {
      const res = await acceptInviteAction(inviteId)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`‘${workspace.name}’에 참여했습니다.`)
      router.push(`/workspaces/${res.data!.organizationId}`)
    })
  }

  async function switchAccount() {
    await authClient.signOut()
    router.push(`/sign-in?callbackUrl=${encodeURIComponent(`/invite/${inviteId}`)}`)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
        {workspace.name.slice(0, 1)}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        {inviterName ? `${inviterName}님이 초대했습니다` : "워크스페이스 초대"}
      </p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight" data-testid="invite-workspace-name">
        {workspace.name}
      </h1>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <RoleBadge role={role} />
        <span>(으)로 참여</span>
      </div>

      <div className="mt-6 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left">
        <UserAvatar name={user.name} email={user.email} image={user.image} size="sm" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>
        <Button variant="ghost" size="xs" onClick={() => void switchAccount()} data-testid="invite-switch-account-button">
          다른 계정
        </Button>
      </div>

      {alreadyMember ? (
        <>
          <p className="mt-6 text-sm text-muted-foreground" data-testid="invite-already-member">
            이미 이 워크스페이스의 멤버입니다.
          </p>
          <Button asChild size="lg" className="mt-3 h-10 w-full" data-testid="invite-open-workspace-link">
            <Link href={`/workspaces/${workspace.id}`} data-testid="invite-open-workspace-link">
              워크스페이스 열기
            </Link>
          </Button>
        </>
      ) : (
        <Button size="lg" className="mt-6 h-10 w-full" disabled={pending} onClick={accept} data-testid="invite-accept-button">
          {pending && <Loader2 className="animate-spin" />}
          참여하기
        </Button>
      )}
    </div>
  )
}
