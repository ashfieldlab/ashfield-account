"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Building2, LogOut, UserRound } from "lucide-react"

import { Logo } from "@/components/shared/logo"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "내 계정", icon: UserRound, match: (p: string) => p === "/" },
  { href: "/workspaces", label: "워크스페이스", icon: Building2, match: (p: string) => p.startsWith("/workspaces") },
]

export function AccountHeader({ user }: { user: { name: string; email: string; image: string | null } }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" data-testid="header-home-link">
          <Logo />
        </Link>
        <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="주 메뉴">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                n.match(pathname) && "bg-muted text-foreground",
              )}
              data-testid={`nav-${n.href === "/" ? "account" : "workspaces"}-link`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="사용자 메뉴"
                data-testid="user-menu-trigger"
              >
                <UserAvatar name={user.name} email={user.email} image={user.image} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-0.5 font-normal">
                <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void signOut()} data-testid="user-menu-sign-out">
                <LogOut />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* 좁은 화면: 탭형 내비게이션 */}
      <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2 sm:hidden" aria-label="주 메뉴">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground",
              n.match(pathname) && "bg-muted text-foreground",
            )}
            data-testid={`nav-mobile-${n.href === "/" ? "account" : "workspaces"}-link`}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
