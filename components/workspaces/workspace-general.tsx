"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { CopyButton } from "@/components/shared/copy-button"
import { Section } from "@/components/shared/section"
import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { renameWorkspaceAction } from "@/lib/actions/workspaces"

export function WorkspaceGeneral({
  workspace,
  canEdit,
}: {
  workspace: { id: string; name: string; slug: string }
  canEdit: boolean
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [name, setName] = useState(workspace.name)
  const [pending, startTransition] = useTransition()
  const dirty = name.trim() !== workspace.name && name.trim().length > 0

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await renameWorkspaceAction(workspace.id, name)
      if (!res.ok) return void toast.error(res.error)
      toast.success("이름을 바꿨습니다.")
      router.refresh()
    })
  }

  return (
    <Section title="일반" testId="workspace-general">
      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={save} className="space-y-1.5">
          <Label htmlFor="ws-rename">이름</Label>
          <div className="flex gap-2">
            <Input
              id="ws-rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              disabled={!canEdit}
              data-testid="workspace-rename-input"
            />
            {canEdit && (
              <Button type="submit" disabled={!dirty || pending} data-testid="workspace-rename-save-button">
                {pending && <Loader2 className="animate-spin" />}
                저장
              </Button>
            )}
          </div>
        </form>
        <div className="space-y-1.5">
          <Label>워크스페이스 ID</Label>
          <div className="flex gap-2">
            <code
              className="flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border bg-muted/60 px-2.5 font-mono text-xs text-muted-foreground"
              data-testid="workspace-id"
            >
              {workspace.id}
            </code>
            <CopyButton value={workspace.id} toastMessage="ID 를 복사했습니다." testId="workspace-id-copy-button" />
          </div>
        </div>
      </div>
    </Section>
  )
}
