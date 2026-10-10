import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// 페이지 가드(낙관적): 세션 쿠키 존재만 보고 없으면 /sign-in 으로 (복귀 주소 보존).
// 세션 유효성은 (account) 레이아웃·각 페이지가 서버에서 다시 확인한다.
export function proxy(req: NextRequest) {
  const { nextUrl } = req
  if (getSessionCookie(req, { cookiePrefix: "ashfield-account" })) return NextResponse.next()
  const url = new URL("/sign-in", nextUrl)
  url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
  return NextResponse.redirect(url)
}

// 보호 대상: 계정 홈·워크스페이스·초대 수락. 로그인·동의·API·디스커버리·정적 파일은 제외.
export const config = {
  matcher: ["/", "/workspaces/:path*", "/invite/:path*"],
}
