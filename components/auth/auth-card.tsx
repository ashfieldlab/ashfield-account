import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

/** 로그인·동의·초대 화면 공통: 은은한 배경 위 가운데 카드. */
export function AuthCard({
  children,
  className,
  testId,
}: {
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <main className="bg-auth-backdrop flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        className={cn(
          "w-full max-w-[400px] rounded-2xl border bg-card p-7 text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] sm:p-8",
          className,
        )}
        data-testid={testId}
      >
        {children}
      </div>
      <footer className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Logo size={14} withText={false} />
        <span>Ashfield · 하나의 계정으로 모든 Ashfield 앱</span>
      </footer>
    </main>
  )
}
