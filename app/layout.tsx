import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

import { ConfirmProvider } from "@/components/ui-custom/use-confirm"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
})

export const metadata: Metadata = {
  title: { default: "Ashfield 계정", template: "%s · Ashfield 계정" },
  description: "Ashfield 앱(일정·드라이브·동기화)의 통합 로그인과 워크스페이스.",
  icons: {
    icon: [
      { url: "/icons/ashfield/favicon.ico", sizes: "any" },
      { url: "/icons/ashfield/favicon_32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/ashfield/favicon_16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/ashfield/favicon_192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/ashfield/favicon_512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/ashfield/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#252525" },
  ],
}

// 시스템 다크 모드면 첫 페인트 전에 .dark 를 붙인다 (theme.css 의 다크 토큰).
const themeScript = `(()=>{try{const m=matchMedia('(prefers-color-scheme: dark)');const a=()=>document.documentElement.classList.toggle('dark',m.matches);a();m.addEventListener('change',a)}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster theme="system" />
      </body>
    </html>
  )
}
