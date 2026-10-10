/**
 * OIDC 종단 점검: `ashfield-sync`(public, PKCE) 클라이언트로 실제 흐름을 끝까지 돈다.
 *
 *   npm run oidc:check        (= make oidc-check; 서버가 ACCOUNT_URL 에 떠 있어야 함,
 *                              AUTH_DEV_PASSWORD_LOGIN=true, seed:clients 완료)
 *
 *  1. 디스커버리, JWKS
 *  2. /oauth2/authorize (세션 없음) → /sign-in?…&sig=… 로 보내지는지
 *  3. 그 서명된 쿼리를 붙여 DEV 비밀번호 로그인 → 앱 redirect_uri(loopback)로 code 가 오는지
 *    : 127.0.0.1:1421 에 실제 loopback 리스너를 띄워 브라우저처럼 따라가 code 를 받는다
 *  4. code + PKCE verifier + resource → 토큰 (JWT access, id_token, refresh)
 *  5. JWKS 로 서명, iss, aud, exp 검증, `workspaces` 클레임(개인 워크스페이스 owner) 확인
 *  6. /oauth2/userinfo, /api/v1/me, /api/v1/workspaces/{id}/members
 *  7. refresh_token 회전: 새 refresh 발급 + 옛 refresh 재사용 거부
 *  8. confidential 클라이언트(ashfield-calendar): 같은 브라우저 세션으로 SSO(로그인 화면 없이 code),
 *     client_secret_basic + PKCE 로 교환, aud = CALENDAR_URL  (.secrets/clients.local.json 필요)
 *
 * 성공 시 exit 0. 실패한 단계가 있으면 exit 1.
 */
import "dotenv/config"

import { createHash, randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"

import { createRemoteJWKSet, jwtVerify } from "jose"

const ISSUER = (process.env.ACCOUNT_URL || "http://localhost:3300").replace(/\/$/, "")
const CALENDAR = (process.env.CALENDAR_URL || "http://localhost:3100").replace(/\/$/, "")
const RESOURCE = (process.env.DRIVE_URL || "http://localhost:3200").replace(/\/$/, "")
const CLIENT_ID = "ashfield-sync"
const LOOPBACK_PORT = 1421
const REDIRECT_URI = `http://127.0.0.1:${LOOPBACK_PORT}/oauth/callback`

let failures = 0
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.log(`  ✗ ${name}`, detail ?? "")
  }
}
function step(title: string) {
  console.log(`\n▶ ${title}`)
}

const b64url = (buf: Buffer) => buf.toString("base64url")

async function waitForLoopbackCode(): Promise<{ url: Promise<URL>; close: () => void }> {
  let resolve!: (u: URL) => void
  const url = new Promise<URL>((r) => (resolve = r))
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", `http://127.0.0.1:${LOOPBACK_PORT}`)
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end("<h2>로그인 완료</h2>")
    resolve(u)
  })
  await new Promise<void>((r) => server.listen(LOOPBACK_PORT, "127.0.0.1", r))
  return { url, close: () => server.close() }
}

async function main() {
  console.log(`issuer=${ISSUER} client=${CLIENT_ID} resource=${RESOURCE}`)

  step("1. 디스커버리")
  const disco = await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json()
  check("issuer = ACCOUNT_URL", disco.issuer === ISSUER, disco.issuer)
  check("authorization_endpoint", typeof disco.authorization_endpoint === "string")
  check("token_endpoint", typeof disco.token_endpoint === "string")
  check("jwks_uri", typeof disco.jwks_uri === "string")
  check("S256 PKCE", disco.code_challenge_methods_supported?.includes("S256"))
  const jwks = createRemoteJWKSet(new URL(disco.jwks_uri))

  step("2. authorize (세션 없음) → 로그인 화면")
  const verifier = b64url(randomBytes(48))
  const challenge = b64url(createHash("sha256").update(verifier).digest())
  const state = b64url(randomBytes(16))
  const nonce = b64url(randomBytes(16))
  const authorizeUrl = new URL(disco.authorization_endpoint)
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email offline_access",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  }).toString()
  // 브라우저 내비게이션이면 302, fetch(sec-fetch-mode: cors)면 200 {redirect, url}: 둘 다 받는다.
  const r1 = await fetch(authorizeUrl, { redirect: "manual", headers: { accept: "text/html" } })
  const loginLocation =
    r1.headers.get("location") ?? ((await r1.json().catch(() => ({}))) as { url?: string }).url ?? ""
  const loginUrl = new URL(loginLocation, ISSUER)
  check("→ /sign-in (로그인 페이지)", loginUrl.pathname === "/sign-in", `${r1.status} ${loginLocation}`)
  check("서명된 쿼리(sig) 포함", loginUrl.searchParams.has("sig"))

  step("3. DEV 비밀번호 로그인 + OAuth 계속 → loopback 으로 code")
  const email = `oidc-check-${Date.now()}@example.com`
  const password = "oidc-check-password"
  const oauthQuery = loginUrl.search.slice(1)
  const loopback = await waitForLoopbackCode()
  let signUp: Response
  try {
    signUp = await fetch(`${ISSUER}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ISSUER },
      body: JSON.stringify({ email, password, name: "OIDC 점검", oauth_query: oauthQuery }),
    })
  } catch (e) {
    loopback.close()
    throw e
  }
  const sessionCookie = signUp.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  const signUpBody = (await signUp.json()) as { url?: string; redirect?: boolean }
  check("가입과 로그인 200", signUp.ok, signUp.status)
  check("응답에 앱으로 갈 url", typeof signUpBody.url === "string", signUpBody)
  const cbUrl = new URL(signUpBody.url ?? "http://invalid")
  check("redirect_uri 로 향함", `${cbUrl.origin}${cbUrl.pathname}` === REDIRECT_URI, cbUrl.toString())
  // 브라우저처럼 따라간다 → loopback 리스너가 받는다
  await fetch(cbUrl).catch(() => undefined)
  const received = await Promise.race([
    loopback.url,
    new Promise<URL>((_, rej) => setTimeout(() => rej(new Error("loopback timeout")), 5000)),
  ]).finally(() => loopback.close())
  const code = received.searchParams.get("code")
  check("code 수신", !!code, received.toString())
  check("state 일치", received.searchParams.get("state") === state)
  check("iss 파라미터 (RFC 9207)", received.searchParams.get("iss") === ISSUER, received.searchParams.get("iss"))

  step("4. 토큰 교환 (public client + PKCE + resource)")
  const tokenRes = await fetch(disco.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: code ?? "",
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      resource: RESOURCE,
    }),
  })
  const tokens = (await tokenRes.json()) as Record<string, unknown>
  check("200", tokenRes.ok, tokens)
  check("token_type Bearer", String(tokens.token_type).toLowerCase() === "bearer", tokens.token_type)
  check("access_token 은 JWT", typeof tokens.access_token === "string" && (tokens.access_token as string).split(".").length === 3)
  check("refresh_token 발급", typeof tokens.refresh_token === "string")
  check("id_token 발급", typeof tokens.id_token === "string")
  check("expires_in ≈ 900", Number(tokens.expires_in) > 0 && Number(tokens.expires_in) <= 900, tokens.expires_in)

  step("5. JWKS 로 액세스 토큰 검증 + 클레임")
  const { payload: at, protectedHeader } = await jwtVerify(tokens.access_token as string, jwks, {
    issuer: ISSUER,
    audience: RESOURCE,
  })
  console.log("    access token claims:", JSON.stringify({ ...at, workspaces: at.workspaces }, null, 0))
  check("alg RS256", protectedHeader.alg === "RS256", protectedHeader.alg)
  check("kid 있음", !!protectedHeader.kid)
  check("sub = 사용자 id", typeof at.sub === "string" && at.sub.length > 0)
  check("aud ∋ resource", (Array.isArray(at.aud) ? at.aud : [at.aud]).includes(RESOURCE), at.aud)
  check("azp/client_id = ashfield-sync", at.client_id === CLIENT_ID && at.azp === CLIENT_ID)
  check("email", at.email === email, at.email)
  check("name", at.name === "OIDC 점검", at.name)
  check("picture 키 존재", "picture" in at)
  check("수명 ≤ 15분", (at.exp ?? 0) - (at.iat ?? 0) <= 900, (at.exp ?? 0) - (at.iat ?? 0))
  const ws = at.workspaces as { id: string; name: string; slug: string; role: string }[] | undefined
  check("workspaces 클레임 배열", Array.isArray(ws) && ws.length >= 1, ws)
  const personal = ws?.find((w) => w.slug === `personal-${at.sub}`)
  check("개인 워크스페이스 owner", personal?.role === "owner" && personal.name === "OIDC 점검의 워크스페이스", personal)

  const { payload: idt } = await jwtVerify(tokens.id_token as string, jwks, { issuer: ISSUER, audience: CLIENT_ID })
  check("id_token aud = client_id, nonce", idt.aud === CLIENT_ID && idt.nonce === nonce, { aud: idt.aud, nonce: idt.nonce })
  check("id_token sub = access sub", idt.sub === at.sub)

  step("6. userinfo, /api/v1")
  const auth = { authorization: `Bearer ${tokens.access_token}` }
  const ui = await fetch(disco.userinfo_endpoint, { headers: auth })
  const uiBody = await ui.json()
  check("userinfo 200 + sub", ui.ok && uiBody.sub === at.sub, uiBody)
  check("userinfo workspaces", Array.isArray(uiBody.workspaces), uiBody.workspaces)
  const me = await fetch(`${ISSUER}/api/v1/me`, { headers: auth })
  const meBody = await me.json()
  check("/api/v1/me 200", me.ok && meBody.sub === at.sub, meBody)
  const mem = await fetch(`${ISSUER}/api/v1/workspaces/${personal?.id}/members`, { headers: auth })
  const memBody = await mem.json()
  check("/api/v1/workspaces/{id}/members 200", mem.ok && memBody.members?.[0]?.sub === at.sub, memBody)
  const noAuth = await fetch(`${ISSUER}/api/v1/me`)
  check("/api/v1/me 토큰 없으면 401", noAuth.status === 401, noAuth.status)
  const other = await fetch(`${ISSUER}/api/v1/workspaces/does-not-exist/members`, { headers: auth })
  check("남의/없는 워크스페이스 404", other.status === 404, other.status)

  step("7. refresh_token 회전")
  const refresh = (rt: string) =>
    fetch(disco.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, refresh_token: rt, resource: RESOURCE }),
    })
  const rr = await refresh(tokens.refresh_token as string)
  const refreshed = (await rr.json()) as Record<string, unknown>
  check("refresh 200", rr.ok, refreshed)
  check("새 refresh_token (회전)", typeof refreshed.refresh_token === "string" && refreshed.refresh_token !== tokens.refresh_token)
  const { payload: at2 } = await jwtVerify(refreshed.access_token as string, jwks, { issuer: ISSUER, audience: RESOURCE })
  check("새 access token 검증 + workspaces", at2.sub === at.sub && Array.isArray(at2.workspaces))
  if (process.argv.includes("--keep")) {
    // 재사용 점검은 토큰 패밀리를 통째로 폐기하므로, 계정 홈의 '연결된 앱'을 눈으로 보려면 건너뛴다.
    console.log(`    --keep: 재사용 점검 생략. 로그인해서 확인: ${email} / ${password}`)
  } else {
    const replay = await refresh(tokens.refresh_token as string)
    check("옛 refresh_token 재사용 거부", !replay.ok, replay.status)
    const afterReplay = await refresh(refreshed.refresh_token as string)
    check("재사용 감지 시 토큰 패밀리 폐기 (최신 refresh 도 거부)", !afterReplay.ok, afterReplay.status)
  }

  step("8. confidential 클라이언트 SSO (ashfield-calendar, client_secret_basic + PKCE)")
  const secrets = JSON.parse(await readFile(".secrets/clients.local.json", "utf8").catch(() => "{}"))
  const calSecret = secrets["ashfield-calendar"]?.client_secret as string | undefined
  if (!calSecret) {
    console.log("    .secrets/clients.local.json 에 ashfield-calendar secret 이 없어 건너뜀 (npm run seed:clients -- --rotate)")
  } else {
    const calRedirect = (process.env.CALENDAR_REDIRECT_URIS || `${CALENDAR}/api/auth/callback/ashfield`).split(",")[0].trim()
    const p2 = (() => {
      const v = b64url(randomBytes(48))
      return { v, c: b64url(createHash("sha256").update(v).digest()) }
    })()
    const u = new URL(disco.authorization_endpoint)
    u.search = new URLSearchParams({
      response_type: "code",
      client_id: "ashfield-calendar",
      redirect_uri: calRedirect,
      scope: "openid profile email offline_access",
      state: "cal",
      code_challenge: p2.c,
      code_challenge_method: "S256",
      resource: CALENDAR,
    }).toString()
    const ar = await fetch(u, { redirect: "manual", headers: { cookie: sessionCookie, accept: "text/html" } })
    const loc = ar.headers.get("location") ?? ((await ar.json().catch(() => ({}))) as { url?: string }).url ?? ""
    const cal = new URL(loc, ISSUER)
    check("이미 로그인 → 로그인과 동의 화면 없이 redirect_uri 로", `${cal.origin}${cal.pathname}` === calRedirect, loc)
    const calCode = cal.searchParams.get("code") ?? ""
    const tr = await fetch(disco.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`ashfield-calendar:${calSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: calCode,
        code_verifier: p2.v,
        redirect_uri: calRedirect,
        resource: CALENDAR,
      }),
    })
    const calTokens = (await tr.json()) as Record<string, unknown>
    check("토큰 200", tr.ok, calTokens)
    if (tr.ok) {
      const { payload: cat } = await jwtVerify(calTokens.access_token as string, jwks, { issuer: ISSUER, audience: CALENDAR })
      check("aud ∋ CALENDAR_URL, 같은 sub", cat.sub === at.sub && cat.client_id === "ashfield-calendar")
      const wrongAud = await jwtVerify(calTokens.access_token as string, jwks, { issuer: ISSUER, audience: RESOURCE }).then(
        () => true,
        () => false,
      )
      check("Calendar 토큰은 Drive aud 검증에 실패", !wrongAud)
    }
    // 잘못된 secret: 유효한 code 를 새로 받아 틀린 secret 으로 교환 → invalid_client
    const ar2 = await fetch(u, { redirect: "manual", headers: { cookie: sessionCookie, accept: "text/html" } })
    const loc2 = ar2.headers.get("location") ?? ((await ar2.json().catch(() => ({}))) as { url?: string }).url ?? ""
    const bad = await fetch(disco.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from("ashfield-calendar:wrong-secret").toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: new URL(loc2, ISSUER).searchParams.get("code") ?? "",
        code_verifier: p2.v,
        redirect_uri: calRedirect,
        resource: CALENDAR,
      }),
    })
    const badBody = (await bad.json()) as { error?: string }
    check("잘못된 client_secret 거부 (invalid_client)", !bad.ok && badBody.error === "invalid_client", { status: bad.status, ...badBody })
  }

  console.log(failures === 0 ? "\n✅ OIDC 흐름 점검 통과" : `\n❌ 실패 ${failures}건`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
