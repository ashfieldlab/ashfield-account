"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceAction } from "@/lib/actions/workspaces"

export function CreateWorkspaceDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createWorkspaceAction(name)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`‘${name.trim()}’ 워크스페이스를 만들었습니다.`)
      setOpen(false)
      setName("")
      router.push(`/workspaces/${res.data!.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button data-testid="workspaces-create-button">
            <Plus />새 워크스페이스
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="workspaces-create-dialog">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>새 워크스페이스</DialogTitle>
            <DialogDescription>
              팀이나 회사 단위로 일정·파일을 함께 쓰는 공간입니다. 만든 사람이 소유자가 됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">이름</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리 팀"
              maxLength={60}
              autoFocus
              required
              data-testid="workspaces-create-name-input"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="workspaces-create-cancel-button">
              취소
            </Button>
            <Button type="submit" disabled={pending || !name.trim()} data-testid="workspaces-create-submit-button">
              {pending && <Loader2 className="animate-spin" />}
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
