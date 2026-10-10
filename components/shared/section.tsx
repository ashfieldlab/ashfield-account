import { cn } from "@/lib/utils"

/** 계정 화면의 카드형 섹션: 제목·설명·우측 액션 + 본문. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  testId,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <section className={cn("rounded-2xl border bg-card text-card-foreground shadow-xs", className)} data-testid={testId}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="px-5 py-4 sm:px-6">{children}</div>
    </section>
  )
}
