import { AccountHeader } from "@/components/layout/account-header"
import { requireSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return (
    <div className="min-h-dvh bg-muted/40">
      <AccountHeader
        user={{ name: session.user.name, email: session.user.email, image: session.user.image ?? null }}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}
