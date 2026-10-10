"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { auth } from "@/lib/auth/server"
import { requireSession } from "@/lib/auth/session"
import { disconnectApp, revokeGrant } from "@/lib/db/account"

import { toActionError, type ActionResult } from "./result"

/** 계정 서버 세션 하나 종료 (다른 기기 로그아웃). id 로 받고 토큰은 서버에서 찾는다. */
export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  try {
    const h = await headers()
    const sessions = await auth.api.listSessions({ headers: h })
    const target = sessions.find((s) => s.id === sessionId)
    if (!target) return { ok: false, error: "세션을 찾을 수 없습니다." }
    await auth.api.revokeSession({ headers: h, body: { token: target.token } })
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() })
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

/** 연결된 앱의 기기(리프레시 토큰) 하나 로그아웃. */
export async function revokeGrantAction(grantId: string): Promise<ActionResult> {
  const session = await requireSession()
  const ok = await revokeGrant(session.user.id, grantId)
  revalidatePath("/")
  return ok ? { ok: true } : { ok: false, error: "이미 로그아웃된 기기입니다." }
}

/** 앱 연결 해제: 모든 기기 로그아웃 + 동의 철회. */
export async function disconnectAppAction(clientId: string): Promise<ActionResult> {
  const session = await requireSession()
  await disconnectApp(session.user.id, clientId)
  revalidatePath("/")
  return { ok: true }
}

export async function updateNameAction(name: string): Promise<ActionResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "이름을 입력하세요." }
  if (trimmed.length > 60) return { ok: false, error: "이름은 60자 이하로 입력하세요." }
  try {
    await auth.api.updateUser({ headers: await headers(), body: { name: trimmed } })
    revalidatePath("/", "layout")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}
