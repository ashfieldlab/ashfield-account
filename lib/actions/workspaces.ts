"use server"

import { randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { auth } from "@/lib/auth/server"
import { requireSession } from "@/lib/auth/session"
import {
  createInviteLink,
  deleteInviteLink,
  getInviteLink,
  getMemberRole,
  incrementInviteAccepted,
  type InviteLink,
} from "@/lib/db/invites"
import { logger } from "@/lib/utils/logger"

import { toActionError, type ActionResult } from "./result"

const MANAGER_ROLES = new Set(["owner", "admin"])

/** 영문·숫자만 남긴 slug + 무작위 접미사 (한글 이름도 충돌 없이). */
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
  const suffix = randomBytes(4).toString("hex")
  return base ? `${base}-${suffix}` : `ws-${suffix}`
}

function validName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 60)
}

export async function createWorkspaceAction(name: string): Promise<ActionResult<{ id: string }>> {
  const n = validName(name)
  if (!n) return { ok: false, error: "워크스페이스 이름을 입력하세요." }
  try {
    const org = await auth.api.createOrganization({
      headers: await headers(),
      body: { name: n, slug: makeSlug(n), keepCurrentActiveOrganization: true },
    })
    if (!org) return { ok: false, error: "워크스페이스를 만들지 못했습니다." }
    revalidatePath("/workspaces")
    logger.info("workspace_created", { category: "biz", id: org.id })
    return { ok: true, data: { id: org.id } }
  } catch (err) {
    return toActionError(err)
  }
}

export async function renameWorkspaceAction(organizationId: string, name: string): Promise<ActionResult> {
  const n = validName(name)
  if (!n) return { ok: false, error: "워크스페이스 이름을 입력하세요." }
  try {
    await auth.api.updateOrganization({ headers: await headers(), body: { organizationId, data: { name: n } } })
    revalidatePath(`/workspaces/${organizationId}`)
    revalidatePath("/workspaces")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

export async function deleteWorkspaceAction(organizationId: string): Promise<ActionResult> {
  try {
    await auth.api.deleteOrganization({ headers: await headers(), body: { organizationId } })
    revalidatePath("/workspaces")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

export async function leaveWorkspaceAction(organizationId: string): Promise<ActionResult> {
  try {
    await auth.api.leaveOrganization({ headers: await headers(), body: { organizationId } })
    revalidatePath("/workspaces")
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

export async function updateMemberRoleAction(
  organizationId: string,
  memberId: string,
  role: "owner" | "admin" | "member",
): Promise<ActionResult> {
  try {
    await auth.api.updateMemberRole({ headers: await headers(), body: { organizationId, memberId, role } })
    revalidatePath(`/workspaces/${organizationId}`)
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

export async function removeMemberAction(organizationId: string, memberId: string): Promise<ActionResult> {
  try {
    await auth.api.removeMember({ headers: await headers(), body: { organizationId, memberIdOrEmail: memberId } })
    revalidatePath(`/workspaces/${organizationId}`)
    return { ok: true }
  } catch (err) {
    return toActionError(err)
  }
}

// ---- 초대 링크 --------------------------------------------------------------

async function requireManager(organizationId: string) {
  const session = await requireSession()
  const role = await getMemberRole(organizationId, session.user.id)
  return { session, allowed: role !== null && MANAGER_ROLES.has(role) }
}

export async function createInviteLinkAction(
  organizationId: string,
  role: "admin" | "member",
): Promise<ActionResult<InviteLink>> {
  const { session, allowed } = await requireManager(organizationId)
  if (!allowed) return { ok: false, error: "초대 링크를 만들 권한이 없습니다." }
  if (role !== "admin" && role !== "member") return { ok: false, error: "잘못된 역할입니다." }
  const invite = await createInviteLink({ organizationId, role, inviterId: session.user.id })
  revalidatePath(`/workspaces/${organizationId}`)
  return { ok: true, data: invite }
}

export async function revokeInviteLinkAction(organizationId: string, inviteId: string): Promise<ActionResult> {
  const { allowed } = await requireManager(organizationId)
  if (!allowed) return { ok: false, error: "초대 링크를 취소할 권한이 없습니다." }
  await deleteInviteLink(inviteId, organizationId)
  revalidatePath(`/workspaces/${organizationId}`)
  return { ok: true }
}

/** 초대 수락: 로그인한 본인을 멤버로 추가. 이미 멤버면 그대로 성공. */
export async function acceptInviteAction(inviteId: string): Promise<ActionResult<{ organizationId: string }>> {
  const session = await requireSession(`/invite/${inviteId}`)
  const invite = await getInviteLink(inviteId)
  if (!invite) return { ok: false, error: "초대 링크를 찾을 수 없습니다. 취소되었을 수 있습니다." }
  if (invite.expired) return { ok: false, error: "만료된 초대 링크입니다. 새 링크를 요청하세요." }
  const existing = await getMemberRole(invite.organizationId, session.user.id)
  if (existing) return { ok: true, data: { organizationId: invite.organizationId } }
  try {
    await auth.api.addMember({
      body: { organizationId: invite.organizationId, userId: session.user.id, role: invite.role },
    })
    await incrementInviteAccepted(inviteId)
    logger.info("invite_accepted", { category: "biz", organizationId: invite.organizationId })
    revalidatePath("/workspaces")
    return { ok: true, data: { organizationId: invite.organizationId } }
  } catch (err) {
    return toActionError(err, "워크스페이스에 참여하지 못했습니다.")
  }
}
