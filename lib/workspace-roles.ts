/** 워크스페이스 역할 표시와 권한: 클라이언트와 서버 공용. 실제 권한 검사는 서버(Better Auth org 플러그인)가 한다. */
export type Role = "owner" | "admin" | "member"

export const ROLE_LABEL: Record<Role, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "모든 권한, 워크스페이스 삭제",
  admin: "이름 변경, 멤버 관리, 초대",
  member: "워크스페이스 사용",
}

export function canManage(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin"
}
