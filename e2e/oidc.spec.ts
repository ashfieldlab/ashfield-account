/**
 * 브라우저로 도는 OIDC: 로그인 화면이 OAuth 흐름을 이어 가는지(서명된 쿼리), 1st-party 는 동의 생략,
 * 3rd-party 는 동의 화면을 거치는지, 계정 홈 '연결된 앱'에 나타나고 해제되는지.
 * 토큰, 클레임, 회전의 세부 검증은 scripts/oidc-flow-check.ts (make oidc-check).
 */
import { createHash, randomBytes } from "node:crypto"
import { createServer, type Server } from "node:http"

import { expect, test } from "@playwright/test"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { Pool } from "pg"

import { devSignIn, uniqueEmail } from "./helpers"

const ISSUER = (process.env.ACCOUNT_URL || "http://localhost:3300").replace(/\/$/, "")
const DRIVE = (process.env.DRIVE_URL || "http://localhost:3200").replace(/\/$/, "")

function loopback(port: number): Promise<{ server: Server; next: () => Promise<URL> }> {
  const waiters: ((u: URL) => void)[] = []
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end("<h2 id='done'>로그인 완료</h2>")
    waiters.shift()?.(new URL(req.url ?? "/", `http://127.0.0.1:${port}`))
  })
  return new Promise((r) =>
    server.listen(port, "127.0.0.1", () => r({ server, next: () => new Promise((res) => waiters.push(res)) })),
  )
}

function pkce() {
  const verifier = randomBytes(48).toString("base64url")
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") }
}

function authorizeUrl(params: Record<string, string>) {
  return `${ISSUER}/api/auth/oauth2/authorize?${new URLSearchParams({ response_type: "code", ...params })}`
}

test.describe.configure({ mode: "serial" })

test("ashfield-sync: 브라우저 로그인 → loopback code → 토큰 (동의 화면 없음)", async ({ page }) => {
  const lb = await loopback(1421)
  try {
    const { verifier, challenge } = pkce()
    const redirectUri = "http://127.0.0.1:1421/oauth/callback"
    const got = lb.next()
    await page.goto(
      authorizeUrl({
        client_id: "ashfield-sync",
        redirect_uri: redirectUri,
        scope: "openid profile email offline_access",
        state: "s1",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: DRIVE,
      }),
    )
    await expect(page).toHaveURL(/\/sign-in\?.*sig=/)
    await expect(page.getByTestId("sign-in-subtitle")).toContainText("Ashfield Sync")
    await devSignIn(page, uniqueEmail("sync"), "최싱크")
    const cb = await got
    await expect(page.locator("#done")).toBeVisible()
    expect(cb.searchParams.get("state")).toBe("s1")
    const code = cb.searchParams.get("code")!

    const res = await fetch(`${ISSUER}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "ashfield-sync",
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        resource: DRIVE,
      }),
    })
    const tokens = await res.json()
    expect(res.ok).toBe(true)
    const { payload } = await jwtVerify(tokens.access_token, createRemoteJWKSet(new URL(`${ISSUER}/api/auth/jwks`)), {
      issuer: ISSUER,
      audience: DRIVE,
    })
    expect(payload.name).toBe("최싱크")
    expect(payload.workspaces).toEqual([
      expect.objectContaining({ name: "최싱크의 워크스페이스", role: "owner" }),
    ])

    // 계정 홈: 연결된 앱에 Sync 가 기기 1대로 보인다
    await page.goto("/")
    await expect(page.getByTestId("connected-app-ashfield-sync")).toContainText("1개 기기에서 로그인됨")
  } finally {
    lb.server.close()
  }
})

test("3rd-party 클라이언트: 동의 화면 → 허용 → code, 그리고 연결 해제", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const clientId = `e2e-third-party-${Date.now()}`
  const redirectUri = "http://127.0.0.1:1422/cb"
  await pool.query(
    `insert into "oauthClient" ("id","clientId","name","uri","redirectUris","tokenEndpointAuthMethod","applicationType",
       "grantTypes","responseTypes","scopes","skipConsent","requirePKCE","disabled","createdAt","updatedAt")
     values ($1,$1,'E2E 외부 앱','https://example.com',$2,'none','native',
       '["authorization_code","refresh_token"]','["code"]','["openid","profile","email","offline_access"]',
       false,true,false,now(),now())`,
    [clientId, JSON.stringify([redirectUri])],
  )
  const lb = await loopback(1422)
  try {
    const { challenge } = pkce()
    await page.goto("/sign-in")
    await devSignIn(page, uniqueEmail("consent"), "정동의")

    const got = lb.next()
    await page.goto(
      authorizeUrl({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid profile email",
        state: "s2",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    )
    await expect(page).toHaveURL(/\/consent\?/)
    await expect(page.getByTestId("consent-client-name")).toHaveText("E2E 외부 앱")
    await expect(page.getByTestId("consent-scope-list")).toContainText("이메일 주소 보기")
    await page.getByTestId("consent-accept-button").click()
    const cb = await got
    await expect(page.locator("#done")).toBeVisible()
    expect(cb.searchParams.get("code")).toBeTruthy()
    expect(cb.searchParams.get("state")).toBe("s2")

    // 동의 기록 → 연결된 앱에 표시, 해제하면 사라짐
    await page.goto("/")
    const row = page.getByTestId(`connected-app-${clientId}`)
    await expect(row).toBeVisible()
    await page.getByTestId(`connected-app-${clientId}-disconnect-button`).click()
    await page.getByRole("button", { name: "연결 해제" }).last().click()
    await expect(row).toHaveCount(0)
  } finally {
    lb.server.close()
    await pool.query(`delete from "oauthConsent" where "clientId" = $1`, [clientId])
    await pool.query(`delete from "oauthClient" where "clientId" = $1`, [clientId])
    await pool.end()
  }
})
