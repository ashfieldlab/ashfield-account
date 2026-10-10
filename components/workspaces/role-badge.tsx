import { Badge } from "@/components/ui/badge"
import { ROLE_LABEL, type Role } from "@/lib/workspace-roles"
import { cn } from "@/lib/utils"

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const r = (role in ROLE_LABEL ? role : "member") as Role
  return (
    <Badge
      variant={r === "member" ? "outline" : "secondary"}
      className={cn("text-[11px]", r === "owner" && "bg-primary/10 text-primary", className)}
    >
      {ROLE_LABEL[r]}
    </Badge>
  )
}
