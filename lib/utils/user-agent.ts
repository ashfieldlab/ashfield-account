/** User-Agent → "Chrome · Windows" 같은 짧은 기기 설명. 정확성보다 알아보기 쉬움이 목적. */
export function describeUserAgent(ua: string | null | undefined): { label: string; kind: "desktop" | "mobile" | "unknown" } {
  if (!ua) return { label: "알 수 없는 기기", kind: "unknown" }
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /HeadlessChrome/.test(ua)
              ? "Chrome"
              : null
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua)
  const label = [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40)
  return { label, kind: mobile ? "mobile" : "desktop" }
}
