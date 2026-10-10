import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider"

import { auth } from "@/lib/auth/server"

/** OIDC 디스커버리 — issuer(ACCOUNT_URL) 루트에 둔다. */
export const GET = oauthProviderOpenIdConfigMetadata(auth)
