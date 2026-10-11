# =============================================================================
# Ashfield Account 운영 이미지: Next.js standalone, 비root (docs/deploy.md)
#
#   runtime : 앱 서버 (node server.js, 포트 3000)
#   builder : 전체 node_modules + 소스. 일회성 작업(Better Auth 마이그레이션, 클라이언트 등록)에 쓴다.
# =============================================================================

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 비밀값 없이 빌드한다: lib/env.ts 가 빌드 단계(NEXT_PHASE)에서만 자리표시 secret 을 쓴다.
RUN npm run build


FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/api/auth/ok || exit 1

CMD ["node", "server.js"]
