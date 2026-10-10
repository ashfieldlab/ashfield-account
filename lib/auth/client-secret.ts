/**
 * OAuth confidential client secret 저장 형식 — SHA-256 → base64url(패딩 없음).
 * oauthProvider({ storeClientSecret }) 와 seed 스크립트가 같은 함수를 쓴다.
 */
import { createHash, timingSafeEqual } from "node:crypto"

export async function hashClientSecret(secret: string): Promise<string> {
  return createHash("sha256").update(secret).digest("base64url")
}

export async function verifyClientSecret(secret: string, stored: string): Promise<boolean> {
  const a = Buffer.from(await hashClientSecret(secret))
  const b = Buffer.from(stored)
  return a.length === b.length && timingSafeEqual(a, b)
}
