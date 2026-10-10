import { APIError } from "better-auth/api"

import { logger } from "@/lib/utils/logger"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const MESSAGES: Record<string, string> = {
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: "이 워크스페이스를 수정할 권한이 없습니다.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: "이 워크스페이스를 삭제할 권한이 없습니다.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "유일한 소유자는 나갈 수 없습니다. 먼저 다른 멤버를 소유자로 지정하세요.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "소유자가 없는 워크스페이스가 될 수 없습니다.",
  ORGANIZATION_ALREADY_EXISTS: "이미 같은 주소(slug)의 워크스페이스가 있습니다.",
  PERSONAL_WORKSPACE: "개인 워크스페이스는 삭제할 수 없습니다.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: "이 멤버의 역할을 바꿀 권한이 없습니다.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "이 멤버를 내보낼 권한이 없습니다.",
}

/** server action 공통 에러 → 사용자에게 보일 한국어 메시지. */
export function toActionError(err: unknown, fallback = "요청을 처리하지 못했습니다."): { ok: false; error: string } {
  if (err instanceof APIError) {
    const body = err.body as { code?: string; message?: string } | undefined
    const msg = (body?.code && MESSAGES[body.code]) || body?.message || fallback
    return { ok: false, error: msg }
  }
  logger.error("action_failed", { category: "biz", err: String(err) })
  return { ok: false, error: fallback }
}
