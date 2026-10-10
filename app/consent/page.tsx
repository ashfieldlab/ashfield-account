import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ConsentForm } from "@/components/auth/consent-form"
import { getSession } from "@/lib/auth/session"
import { getClientDisplay } from "@/lib/db/account"

export const metadata: Metadata = { title: "앱 권한 요청" }
export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * OAuth 동의 화면: 3rd-party 클라이언트만 온다 (1st-party 는 skipConsent).
 * /api/auth/oauth2/authorize 가 `?client_id&scope&…&sig` 로 보낸다. 수락/거부는 서명된 쿼리와
 * 함께 /api/auth/oauth2/consent 로 (oauthProviderClient 가 자동 첨부).
 */
export default async function ConsentPage({ searchParams }: Props) {
  const params = await searchParams
  const clientId = typeof params.client_id === "string" ? params.client_id : null
  const scope = typeof params.scope === "string" ? params.scope : ""

  const session = await getSession()
  if (!session) redirect("/sign-in")
  const client = clientId ? await getClientDisplay(clientId) : null

  return (
    <ConsentForm
      client={client ? { id: clientId!, name: client.name, uri: client.uri, icon: client.icon } : null}
      scopes={scope.split(" ").filter(Boolean)}
      user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
    />
  )
}
