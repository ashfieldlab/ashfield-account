import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // pg 는 네이티브 의존이 섞인 서버 전용 패키지 — 번들 대신 require.
  serverExternalPackages: ["pg"],
}

export default nextConfig
