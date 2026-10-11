import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // 운영 이미지(Dockerfile)는 node_modules 없이 .next/standalone 만 담는다.
  output: "standalone",
  // pg 는 네이티브 의존이 섞인 서버 전용 패키지: 번들 대신 require.
  serverExternalPackages: ["pg"],
}

export default nextConfig
