"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, X } from "lucide-react"

import { ProviderIcon } from "@/components/shared/provider-icon"
import { Section } from "@/components/shared/section"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useToast } from "@/components/ui-custom/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateNameAction } from "@/lib/actions/account"
import { formatDate } from "@/lib/utils/format"

const PROVIDER_NAME: Record<string, string> = { google: "Google", github: "GitHub", credential: "이메일(DEV)" }

export function ProfileCard({
  user,
  providers,
}: {
  user: { name: string; email: string; image: string | null; createdAt: string }
  providers: string[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateNameAction(name)
      if (!res.ok) return void toast.error(res.error)
      toast.success("이름을 바꿨습니다.")
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Section title="프로필" testId="profile-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar name={user.name} email={user.email} image={user.image} className="size-16 text-lg" />
        <div className="min-w-0 flex-1 space-y-1">
          {editing ? (
            <form onSubmit={save} className="flex max-w-sm items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                aria-label="이름"
                data-testid="profile-name-input"
              />
              <Button type="submit" size="icon" disabled={pending} aria-label="저장" data-testid="profile-name-save-button">
                <Check />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="취소"
                onClick={() => {
                  setEditing(false)
                  setName(user.name)
                }}
                data-testid="profile-name-cancel-button"
              >
                <X />
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="truncate text-lg font-semibold tracking-tight" data-testid="profile-name">
                {user.name}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="이름 바꾸기" onClick={() => setEditing(true)} data-testid="profile-name-edit-button">
                <Pencil />
              </Button>
            </div>
          )}
          <div className="truncate text-sm text-muted-foreground" data-testid="profile-email">
            {user.email}
          </div>
          <div className="text-xs text-muted-foreground">{formatDate(user.createdAt)} 가입</div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {[...new Set(providers)].map((p) => (
            <Badge key={p} variant="outline" className="gap-1.5 py-1" data-testid={`profile-provider-${p}`}>
              <ProviderIcon provider={p} className="size-3.5" />
              {PROVIDER_NAME[p] ?? p}
            </Badge>
          ))}
        </div>
      </div>
    </Section>
  )
}
