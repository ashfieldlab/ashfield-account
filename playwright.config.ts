import "dotenv/config"

import { defineConfig, devices } from "@playwright/test"

/**
 * E2E — `make e2e` (전제: make infra · make migrate · make seed, .env 에 AUTH_DEV_PASSWORD_LOGIN=true).
 * 서버가 이미 3300 에 떠 있으면 재사용, 아니면 `npm run dev` 를 띄운다.
 *
 * 최신 Ubuntu 처럼 Playwright 가 OS 를 모를 때 브라우저 설치:
 *   PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium
 */
const PORT = Number(process.env.PORT ?? 3300)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: true,
    timeout: 90_000,
  },
})
