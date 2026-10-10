/**
 * Postgres 커넥션 풀: Better Auth 와 앱 쿼리(lib/db/queries.ts)가 같이 쓴다.
 * dev HMR 로 모듈이 다시 평가돼도 풀은 하나만. 경로 별칭(@/) 금지 (Better Auth CLI 가 읽음).
 */
import { Pool } from "pg"

import { env } from "../env"

const g = globalThis as unknown as { __ashfieldAccountPool?: Pool }

export const pool: Pool = g.__ashfieldAccountPool ?? new Pool({ connectionString: env.databaseURL, max: 10 })
if (!env.isProduction) g.__ashfieldAccountPool = pool
