/**
 * 1st-party OAuth 클라이언트 등록 (멱등) — `npm run seed:clients` (= make seed).
 *
 *   ashfield-calendar · ashfield-drive : confidential(web), PKCE 필수, 동의 화면 생략
 *   ashfield-sync                      : public(native), PKCE 필수, loopback redirect
 *
 * 다시 실행하면 redirect URI·이름 등을 .env 값으로 갱신하고 secret 은 유지한다.
 * confidential secret 은 처음 만들 때(또는 --rotate) 한 번만 평문으로 알 수 있으므로
 * 콘솔에 출력하고 .secrets/clients.local.json (gitignore) 에 저장한다.
 *
 *   npm run seed:clients               # 생성·갱신
 *   npm run seed:clients -- --rotate   # confidential secret 재발급
 */
import "dotenv/config"

import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { auth } from "../lib/auth/server"
import { hashClientSecret } from "../lib/auth/client-secret"
import { firstPartyClients, OIDC_SCOPES, RESOURCES } from "../lib/auth/clients"
import { pool } from "../lib/db/pool"
import { env } from "../lib/env"

const SECRETS_FILE = path.resolve(process.cwd(), ".secrets/clients.local.json")
const rotate = process.argv.includes("--rotate")

type SecretsFile = Record<string, { client_secret: string; created_at: string }>

async function readSecrets(): Promise<SecretsFile> {
  try {
    return JSON.parse(await readFile(SECRETS_FILE, "utf8")) as SecretsFile
  } catch {
    return {}
  }
}

interface ClientRow {
  id: string
  clientId: string
}

async function main() {
  const ctx = await auth.$context // 플러그인 init → oauthResource 행도 이 시점에 시드된다.
  const adapter = ctx.adapter
  const secrets = await readSecrets()
  const issued: Record<string, string> = {}

  for (const c of firstPartyClients()) {
    const now = new Date()
    const data = {
      name: c.name,
      uri: c.uri,
      redirectUris: c.redirectUris,
      postLogoutRedirectUris: c.postLogoutRedirectUris,
      tokenEndpointAuthMethod: c.type === "public" ? "none" : "client_secret_basic",
      applicationType: c.type === "public" ? "native" : "web",
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      scopes: [...OIDC_SCOPES],
      skipConsent: true, // 1st-party — 동의 화면 생략
      enableEndSession: true,
      requirePKCE: true,
      disabled: false,
      metadata: JSON.stringify({ firstParty: true }),
      updatedAt: now,
    }
    const existing = await adapter.findOne<ClientRow>({
      model: "oauthClient",
      where: [{ field: "clientId", value: c.clientId }],
    })

    let secret: string | undefined
    if (c.type === "confidential" && (!existing || rotate)) {
      secret = randomBytes(32).toString("base64url")
      issued[c.clientId] = secret
    }

    if (!existing) {
      await adapter.create({
        model: "oauthClient",
        data: {
          ...data,
          clientId: c.clientId,
          clientSecret: secret ? await hashClientSecret(secret) : null,
          createdAt: now,
        },
      })
      console.log(`+ ${c.clientId} 생성 (${c.type})`)
    } else {
      await adapter.update({
        model: "oauthClient",
        where: [{ field: "clientId", value: c.clientId }],
        update: { ...data, ...(secret ? { clientSecret: await hashClientSecret(secret) } : {}) },
      })
      console.log(`~ ${c.clientId} 갱신${secret ? " (secret 재발급)" : ""}`)
    }

    for (const resourceId of c.resources) {
      const link = await adapter.findOne({
        model: "oauthClientResource",
        where: [
          { field: "clientId", value: c.clientId },
          { field: "resourceId", value: resourceId },
        ],
      })
      if (!link) {
        await adapter.create({
          model: "oauthClientResource",
          data: { clientId: c.clientId, resourceId, createdAt: now },
        })
      }
    }
    console.log(`    redirect: ${c.redirectUris.join(", ")}`)
    console.log(`    resource: ${c.resources.join(", ")}`)
  }

  if (Object.keys(issued).length > 0) {
    const createdAt = new Date().toISOString()
    for (const [id, s] of Object.entries(issued)) secrets[id] = { client_secret: s, created_at: createdAt }
    await mkdir(path.dirname(SECRETS_FILE), { recursive: true })
    await writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2) + "\n", { mode: 0o600 })
    console.log("\n새 client secret (각 앱 .env 의 client secret 으로):")
    for (const [id, s] of Object.entries(issued)) console.log(`  ${id}: ${s}`)
    console.log(`→ ${path.relative(process.cwd(), SECRETS_FILE)} 에도 저장했습니다 (gitignore).`)
  } else {
    console.log(`\nsecret 변경 없음. 기존 값: ${path.relative(process.cwd(), SECRETS_FILE)} (재발급: --rotate)`)
  }
  console.log(`\nissuer: ${env.accountURL}`)
  console.log(`resources: ${RESOURCES.map((r) => r.identifier).join(", ")}`)
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err)
    await pool.end()
    process.exit(1)
  })
