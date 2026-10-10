import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"

import { auth } from "@/lib/auth/server"

/** RFC 8414 메타데이터 (issuer 에 경로가 없으므로 루트). */
export const GET = oauthProviderAuthServerMetadata(auth)
