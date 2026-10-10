"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Trash2 } from "lucide-react"

import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"
import { deleteWorkspaceAction, leaveWorkspaceAction } from "@/lib/actions/workspaces"

export function DangerZone({
  workspace,
  myRole,
  soleOwner,
}: {
  workspace: { id: string; name: string; personal: boolean }
  myRole: string
  soleOwner: boolean
}) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canDelete = myRole === "owner" && !workspace.personal

  async function leave() {
    const ok = await confirm({
      title: `‘${workspace.name}’에서 나갈까요?`,
      description: "다시 참여하려면 새 초대 링크가 필요합니다.",
      confirmText: "나가기",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await leaveWorkspaceAction(workspace.id)
      if (!res.ok) return void toast.error(res.error)
      toast.success("워크스페이스에서 나왔습니다.")
      router.push("/workspaces")
    })
  }

  async function remove() {
    const ok = await confirm({
      title: `‘${workspace.name}’을(를) 삭제할까요?`,
      description: "모든 멤버가 접근을 잃으며 되돌릴 수 없습니다.",
      confirmText: "삭제",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteWorkspaceAction(workspace.id)
      if (!res.ok) return void toast.error(res.error)
      toast.success("워크스페이스를 삭제했습니다.")
      router.push("/workspaces")
    })
  }

  return (
    <section className="rounded-2xl border border-destructive/25 bg-card shadow-xs" data-testid="workspace-danger-zone">
      <header className="border-b border-destructive/15 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-destructive">위험 구역</h2>
      </header>
      <div className="divide-y">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">워크스페이스 나가기</div>
            {soleOwner && (
              <div className="text-sm text-muted-foreground">
                {workspace.personal
                  ? "개인 워크스페이스에서는 나갈 수 없습니다."
                  : "유일한 소유자는 나갈 수 없습니다. 먼저 다른 멤버를 소유자로 지정하세요."}
              </div>
            )}
          </div>
          <Button variant="outline" disabled={pending || soleOwner} onClick={() => void leave()} data-testid="workspace-leave-button">
            <LogOut />
            나가기
          </Button>
        </div>
        {myRole === "owner" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">워크스페이스 삭제</div>
              <div className="text-sm text-muted-foreground">
                {workspace.personal ? "개인 워크스페이스는 삭제할 수 없습니다." : "모든 멤버와 초대 링크가 함께 삭제됩니다."}
              </div>
            </div>
            <Button variant="destructive" disabled={pending || !canDelete} onClick={() => void remove()} data-testid="workspace-delete-button">
              <Trash2 />
              삭제
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
