/** 내부 경로만 허용하는 복귀 주소 정리 (open redirect 방지). */
export function safeCallbackUrl(raw: string | undefined | null, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  if (raw.startsWith("/sign-in")) return fallback
  return raw
}
