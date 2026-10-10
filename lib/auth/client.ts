/**
 * Better Auth 브라우저 클라이언트: 로그인, 동의, 조직 API (same-origin `/api/auth/*`).
 * oauthProviderClient: OAuth 진행 중(/sign-in?…&sig=…) 로그인 요청에 서명된 쿼리를 붙여
 * 로그인 직후 원래 /oauth2/authorize 흐름으로 돌아가게 한다.
 */
import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [oauthProviderClient(), organizationClient()],
})
