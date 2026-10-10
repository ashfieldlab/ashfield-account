import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function initials(name?: string | null, email?: string | null): string {
  const n = name?.trim() || email?.split("@")[0] || "?"
  const parts = n.split(/\s+/).filter(Boolean)
  // 영문 두 단어면 머리글자 2개 (Jane Doe → JD), 그 외(한글 포함)는 첫 글자 하나
  if (parts.length > 1 && /^[A-Za-z]/.test(parts[0]) && /^[A-Za-z]/.test(parts[1])) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return n.slice(0, 1).toUpperCase()
}

export function UserAvatar({
  name,
  email,
  image,
  size = "default",
  className,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      {image && <AvatarImage src={image} alt={name ?? ""} referrerPolicy="no-referrer" />}
      <AvatarFallback className={cn("bg-primary/10 font-medium text-primary")}>{initials(name, email)}</AvatarFallback>
    </Avatar>
  )
}
