import type { Metadata } from "next"
import Link from "next/link"
import { CircleAlert } from "lucide-react"

import { AuthCard } from "@/components/auth/auth-card"
import { AcceptInvite } from "@/components/workspaces/accept-invite"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth/session"
import { getInviteLink, getMemberRole } from "@/lib/db/invites"

export const metadata: Metadata = { title: "워크스페이스 초대" }
export const dynamic = "force-dynamic"

/** 초대 링크 수락 — 로그인 필수 (없으면 /sign-in 으로 갔다가 돌아온다). */
export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/invite/${id}`)
  const invite = await getInviteLink(id)

  if (!invite || invite.expired) {
    return (
      <AuthCard testId="invite-page">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </div>
          <h1 className="text-lg font-semibold" data-testid="invite-invalid-title">
            {invite ? "만료된 초대 링크입니다" : "유효하지 않은 초대 링크입니다"}
          </h1>
          <p className="text-sm text-muted-foreground">초대한 분께 새 링크를 요청하세요.</p>
          <Button asChild variant="outline" className="mt-2" data-testid="invite-home-link">
            <Link href="/" data-testid="invite-home-link">
              내 계정으로
            </Link>
          </Button>
        </div>
      </AuthCard>
    )
  }

  const already = (await getMemberRole(invite.organizationId, session.user.id)) !== null

  return (
    <AuthCard testId="invite-page">
      <AcceptInvite
        inviteId={invite.id}
        workspace={{ id: invite.organizationId, name: invite.organizationName }}
        role={invite.role}
        inviterName={invite.inviterName}
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
        alreadyMember={already}
      />
    </AuthCard>
  )
}
