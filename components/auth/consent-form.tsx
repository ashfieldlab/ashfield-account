"use client"

import { useState } from "react"
import { ArrowLeftRight, Building2, KeyRound, Loader2, Mail, UserRound } from "lucide-react"

import { AuthCard } from "@/components/auth/auth-card"
import { Logo } from "@/components/shared/logo"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

const SCOPE_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  openid: { label: "Ashfield 계정으로 본인 확인", icon: <KeyRound /> },
  profile: { label: "이름과 프로필 사진, 소속 워크스페이스 보기", icon: <UserRound /> },
  email: { label: "이메일 주소 보기", icon: <Mail /> },
  offline_access: { label: "로그인 상태 유지", icon: <ArrowLeftRight /> },
}

interface Props {
  client: { id: string; name: string; uri: string | null; icon: string | null } | null
  scopes: string[]
  user: { name: string; email: string; image: string | null }
}

export function ConsentForm({ client, scopes, user }: Props) {
  const [pending, setPending] = useState<"accept" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(accept: boolean) {
    setPending(accept ? "accept" : "deny")
    setError(null)
    const { data, error: err } = await authClient.oauth2.consent({ accept, scope: scopes.join(" ") })
    const url = (data as { url?: string } | null)?.url
    if (err || !url) {
      setError("요청을 처리하지 못했습니다. 앱에서 다시 시도해 주세요.")
      setPending(null)
      return
    }
    window.location.assign(url)
  }

  if (!client) {
    return (
      <AuthCard testId="consent-page">
        <p className="text-center text-sm text-muted-foreground" data-testid="consent-invalid">
          알 수 없는 앱의 요청입니다. 앱에서 다시 시도해 주세요.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard testId="consent-page">
      <div className="flex items-center justify-center gap-3">
        <Logo size={40} withText={false} />
        <span className="h-px w-6 bg-border" aria-hidden />
        <div className="flex size-10 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
          <Building2 className="size-5" />
        </div>
      </div>
      <h1 className="mt-5 text-center text-lg font-semibold tracking-tight">
        <span data-testid="consent-client-name">{client.name}</span>에서
        <br />
        Ashfield 계정 접근을 요청합니다
      </h1>
      {client.uri && <p className="mt-1 text-center text-xs text-muted-foreground">{client.uri}</p>}

      <div className="mt-5 flex items-center gap-3 rounded-xl border px-3 py-2.5">
        <UserAvatar name={user.name} email={user.email} image={user.image} size="sm" />
        <div className="min-w-0 text-sm">
          <div className="truncate font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5" data-testid="consent-scope-list">
        {scopes.map((s) => (
          <li key={s} className="flex items-start gap-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary">
            {SCOPE_INFO[s]?.icon ?? <KeyRound />}
            <span>{SCOPE_INFO[s]?.label ?? s}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="h-10" disabled={pending !== null} onClick={() => void decide(false)} data-testid="consent-deny-button">
          {pending === "deny" && <Loader2 className="animate-spin" />}
          거부
        </Button>
        <Button size="lg" className="h-10" disabled={pending !== null} onClick={() => void decide(true)} data-testid="consent-accept-button">
          {pending === "accept" && <Loader2 className="animate-spin" />}
          허용
        </Button>
      </div>
    </AuthCard>
  )
}
