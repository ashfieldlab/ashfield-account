import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/auth/sign-in-form"
import { devPasswordLoginEnabled, enabledSocialProviders } from "@/lib/auth/server"
import { getSession } from "@/lib/auth/session"
import { getClientDisplay } from "@/lib/db/account"
import { safeCallbackUrl } from "@/lib/utils/callback-url"

export const metadata: Metadata = { title: "로그인" }
export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * 로그인. 두 경로로 온다:
 *  1) 직접 방문 / 보호 페이지에서 튕김 → `?callbackUrl=/…`
 *  2) OAuth 진행 중 (/api/auth/oauth2/authorize 가 세션 없음으로 보냄) → `?client_id=…&sig=…`
 *     이때 로그인 요청에 서명된 쿼리가 자동으로 붙고(oauthProviderClient), 로그인 직후 앱으로 돌아간다.
 */
export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined)
  const oauthClientId = str("sig") ? str("client_id") : undefined
  const callbackUrl = safeCallbackUrl(str("callbackUrl"))

  const session = await getSession()
  if (session && !oauthClientId) redirect(callbackUrl)

  const client = oauthClientId ? await getClientDisplay(oauthClientId) : null
  const inviteFlow = callbackUrl.startsWith("/invite/")

  return (
    <SignInForm
      callbackUrl={callbackUrl}
      error={str("error")}
      providers={enabledSocialProviders}
      devPasswordLogin={devPasswordLoginEnabled}
      clientName={client?.name ?? null}
      context={oauthClientId ? "oauth" : inviteFlow ? "invite" : "direct"}
    />
  )
}
