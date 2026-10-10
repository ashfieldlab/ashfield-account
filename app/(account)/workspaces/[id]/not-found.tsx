import Link from "next/link"
import { Building2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"

export default function WorkspaceNotFound() {
  return (
    <EmptyState
      icon={<Building2 />}
      title="워크스페이스를 찾을 수 없습니다"
      description="삭제되었거나 더 이상 멤버가 아닙니다."
      action={
        <Button asChild variant="outline" data-testid="workspace-not-found-back-link">
          <Link href="/workspaces" data-testid="workspace-not-found-back-link">
            워크스페이스 목록으로
          </Link>
        </Button>
      }
      className="bg-card py-16"
      testId="workspace-not-found"
    />
  )
}
