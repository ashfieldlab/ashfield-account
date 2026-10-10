import { ErrorPage } from "@/components/ui-custom/error-page"

export default function NotFound() {
  return (
    <main className="bg-auth-backdrop min-h-dvh">
      <ErrorPage type="404" secondaryLabel="내 계정으로" />
    </main>
  )
}
