/**
 * 1st-party OAuth 클라이언트와 리소스 정의: `npm run seed:clients` 와 server.ts 가 같이 쓴다.
 * 값은 env(.env)에서 온다. 계약: docs/adr/0001-account-server-contract.md.
 * 경로 별칭(@/) 금지 (Better Auth CLI와 tsx 가 읽음).
 */
import { env } from "../env"

export const OIDC_SCOPES = ["openid", "profile", "email", "offline_access"] as const

/** 액세스 토큰 `aud` 가 되는 리소스 식별자 (RFC 8707). = 각 앱의 공개 주소. */
export const RESOURCES = [
  { key: "calendar", identifier: env.calendarURL, name: "Ashfield Calendar" },
  { key: "drive", identifier: env.driveURL, name: "Ashfield Drive" },
] as const

export interface FirstPartyClient {
  clientId: string
  name: string
  uri: string
  /** confidential = client_secret_basic/post + PKCE, public = none + PKCE */
  type: "confidential" | "public"
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  /** 요청 가능한 resource (aud) */
  resources: string[]
}

export function firstPartyClients(): FirstPartyClient[] {
  return [
    {
      clientId: "ashfield-calendar",
      name: "Ashfield Calendar",
      uri: env.calendarURL,
      type: "confidential",
      redirectUris: env.calendarRedirectURIs,
      postLogoutRedirectUris: [env.calendarURL, `${env.calendarURL}/login`],
      resources: [env.calendarURL],
    },
    {
      clientId: "ashfield-drive",
      name: "Ashfield Drive",
      uri: env.driveURL,
      type: "confidential",
      redirectUris: env.driveRedirectURIs,
      postLogoutRedirectUris: [env.driveURL, `${env.driveURL}/login`],
      resources: [env.driveURL],
    },
    {
      // Windows 데스크톱 클라이언트 (Drive 동기화): 공개 클라이언트, loopback redirect, PKCE.
      clientId: "ashfield-sync",
      name: "Ashfield Sync",
      uri: env.driveURL,
      type: "public",
      redirectUris: env.syncRedirectURIs,
      postLogoutRedirectUris: [],
      resources: [env.driveURL],
    },
  ]
}

export const FIRST_PARTY_CLIENT_IDS = ["ashfield-calendar", "ashfield-drive", "ashfield-sync"]
