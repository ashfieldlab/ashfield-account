/**
 * 서버 컴포넌트·server action 용 세션 헬퍼.
 */
import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/server"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** 세션이 없으면 /sign-in 으로 (복귀 주소 보존). */
export async function requireSession(returnTo = "/") {
  const session = await getSession()
  if (!session) redirect(`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`)
  return session
}
