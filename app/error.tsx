"use client"

import { ErrorPage } from "@/components/ui-custom/error-page"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="bg-auth-backdrop min-h-dvh">
      <ErrorPage type="unknown-error" onClickPrimary={reset} secondaryLabel="내 계정으로" />
    </main>
  )
}
