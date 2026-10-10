"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"

import { AuthCard } from "@/components/auth/auth-card"
import { ProviderIcon } from "@/components/shared/provider-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth/client"

type Provider = "google" | "github"

interface Props {
  callbackUrl: string
  error?: string
  providers: Provider[]
  devPasswordLogin: boolean
  /** OAuth 진행 중이면 그 앱 이름 */
  clientName: string | null
  context: "direct" | "oauth" | "invite"
}

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google로 계속하기",
  github: "GitHub로 계속하기",
}

const ERROR_MESSAGE: Record<string, string> = {
  email_not_allowed: "허용되지 않은 이메일입니다. 관리자에게 문의하세요.",
  EMAIL_NOT_ALLOWED: "허용되지 않은 이메일입니다. 관리자에게 문의하세요.",
  access_denied: "로그인이 취소되었습니다.",
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 올바르지 않습니다.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일입니다. 비밀번호를 확인하세요.",
  PASSWORD_TOO_SHORT: "비밀번호는 8자 이상이어야 합니다.",
  invalid_signature: "로그인 요청이 만료되었습니다. 앱에서 다시 시도하세요.",
}

function errorText(code?: string): string | null {
  if (!code) return null
  return ERROR_MESSAGE[code] ?? "로그인 중 오류가 발생했습니다. 다시 시도해 주세요."
}

/** 로그인 응답이 OAuth 흐름의 다음 주소를 주면 그리로, 아니면 복귀 주소로. */
function follow(data: unknown, fallback: string) {
  const url = (data as { url?: unknown } | null)?.url
  window.location.assign(typeof url === "string" && url ? url : fallback)
}

export function SignInForm({ callbackUrl, error, providers, devPasswordLogin, clientName, context }: Props) {
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(errorText(error))

  async function social(provider: Provider) {
    setPending(provider)
    setMessage(null)
    const { error: err } = await authClient.signIn.social({
      provider,
      callbackURL: callbackUrl,
      errorCallbackURL: "/sign-in",
    })
    // 성공하면 제공자 페이지로 이동하므로 여기 오는 건 실패뿐.
    if (err) {
      setMessage(errorText(err.code ?? "unknown"))
      setPending(null)
    }
  }

  const nothingConfigured = providers.length === 0 && !devPasswordLogin
  const subtitle =
    context === "oauth" && clientName
      ? `${clientName}에 로그인`
      : context === "invite"
        ? "워크스페이스 초대"
        : null

  return (
    <AuthCard testId="sign-in-page">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/icons/ashfield/mark.svg" alt="Ashfield" width={48} height={48} unoptimized className="size-12 rounded-xl shadow-sm" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Ashfield 계정으로 로그인</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="sign-in-subtitle">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {message && (
        <div
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="sign-in-error-alert"
          role="alert"
        >
          {message}
        </div>
      )}

      {providers.length > 0 && (
        <div className="mt-6 space-y-2.5">
          {providers.map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full gap-2.5 text-[15px]"
              disabled={pending !== null}
              onClick={() => void social(p)}
              data-testid={`sign-in-${p}-button`}
            >
              {pending === p ? <Loader2 className="animate-spin" /> : <ProviderIcon provider={p} className="size-[18px]" />}
              {PROVIDER_LABEL[p]}
            </Button>
          ))}
        </div>
      )}

      {devPasswordLogin && (
        <DevPasswordLogin
          callbackUrl={callbackUrl}
          pending={pending}
          onPending={setPending}
          onError={(code) => setMessage(errorText(code ?? undefined))}
          separated={providers.length > 0}
        />
      )}

      {nothingConfigured && (
        <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground" data-testid="sign-in-not-configured">
          설정된 로그인 수단이 없습니다. 서버의 <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code>/
          <code className="font-mono text-xs">SECRET</code> 또는 <code className="font-mono text-xs">GITHUB_CLIENT_ID</code>/
          <code className="font-mono text-xs">SECRET</code> 을 설정하세요.
        </p>
      )}

    </AuthCard>
  )
}

/** 로컬, E2E 전용 (AUTH_DEV_PASSWORD_LOGIN=true, 비운영). 처음 쓰는 이메일이면 가입 후 로그인. */
function DevPasswordLogin({
  callbackUrl,
  pending,
  onPending,
  onError,
  separated,
}: {
  callbackUrl: string
  pending: string | null
  onPending: (v: string | null) => void
  onError: (code: string | null) => void
  separated: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    onPending("dev")
    onError(null)
    let res = await authClient.signIn.email({ email, password })
    if (res.error && res.error.status === 401) {
      const signUp = await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
      // 가입 실패가 "이미 있음" 이면 원래 오류(비밀번호 틀림)를 보여 준다.
      res = signUp.error?.code === "USER_ALREADY_EXISTS" ? res : (signUp as typeof res)
    }
    if (res.error) {
      onError(res.error.code ?? "unknown")
      onPending(null)
      return
    }
    follow(res.data, callbackUrl)
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3" data-testid="sign-in-dev-form">
      {separated && (
        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
          <span className="relative bg-card px-2">또는</span>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        DEV: 이메일과 비밀번호 로그인
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-email">이메일</Label>
        <Input
          id="dev-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10"
          data-testid="sign-in-dev-email-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-password">비밀번호</Label>
        <Input
          id="dev-password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="8자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10"
          data-testid="sign-in-dev-password-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-name">
          이름 <span className="font-normal text-muted-foreground">(가입 시)</span>
        </Label>
        <Input
          id="dev-name"
          type="text"
          autoComplete="name"
          placeholder="홍길동"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
          data-testid="sign-in-dev-name-input"
        />
      </div>
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending !== null} data-testid="sign-in-dev-submit-button">
        {pending === "dev" && <Loader2 className="animate-spin" />}
        로그인
      </Button>
    </form>
  )
}
