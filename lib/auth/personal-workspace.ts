/**
 * 개인 워크스페이스 — 사용자마다 하나, 가입 직후 자동 생성 (owner).
 *
 * 멱등: 결정적 slug(`personal-{userId}`) 로 먼저 찾고, 없을 때만 만든다. 동시 요청이 겹쳐
 * slug 유니크 제약에 걸리면 "이미 있음" 으로 보고 다시 찾는다. 멤버십이 빠져 있으면 채운다.
 *
 * DB 접근은 `WorkspaceStore` 로 주입 — Better Auth 어댑터 구현은 `betterAuthWorkspaceStore`,
 * 단위 테스트는 인메모리 구현을 쓴다 (personal-workspace.test.ts).
 *
 * Better Auth CLI 가 server.ts 를 통해 이 파일을 읽으므로 경로 별칭(@/)을 쓰지 않는다.
 */

export interface PersonalWorkspaceUser {
  id: string
  name?: string | null
  email: string
}

export interface StoredWorkspace {
  id: string
  name: string
  slug: string
}

export interface WorkspaceStore {
  findBySlug(slug: string): Promise<StoredWorkspace | null>
  /** slug 유니크 위반이면 `WorkspaceSlugTakenError` 를 던진다. */
  create(data: { name: string; slug: string; metadata: Record<string, unknown> }): Promise<StoredWorkspace>
  hasMember(workspaceId: string, userId: string): Promise<boolean>
  addMember(data: { workspaceId: string; userId: string; role: "owner" }): Promise<void>
}

export class WorkspaceSlugTakenError extends Error {
  constructor(slug: string) {
    super(`workspace slug already taken: ${slug}`)
    this.name = "WorkspaceSlugTakenError"
  }
}

export const PERSONAL_SLUG_PREFIX = "personal-"

export function personalWorkspaceSlug(userId: string): string {
  return `${PERSONAL_SLUG_PREFIX}${userId}`
}

/** "<이름>의 워크스페이스". 이름이 비면 이메일 앞부분. */
export function personalWorkspaceName(user: Pick<PersonalWorkspaceUser, "name" | "email">): string {
  const base = user.name?.trim() || user.email.split("@")[0] || "내"
  return `${base}의 워크스페이스`
}

/** 조직 metadata 가 개인 워크스페이스 표식을 가졌는지. metadata 는 JSON 문자열일 수도 있다. */
export function isPersonalWorkspaceMetadata(metadata: unknown): boolean {
  let value = metadata
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return false
    }
  }
  return typeof value === "object" && value !== null && (value as { personal?: unknown }).personal === true
}

export type EnsureResult = { workspace: StoredWorkspace; created: boolean }

export async function ensurePersonalWorkspace(
  store: WorkspaceStore,
  user: PersonalWorkspaceUser,
): Promise<EnsureResult> {
  const slug = personalWorkspaceSlug(user.id)
  let created = false
  let workspace = await store.findBySlug(slug)
  if (!workspace) {
    try {
      workspace = await store.create({
        name: personalWorkspaceName(user),
        slug,
        metadata: { personal: true, ownerUserId: user.id },
      })
      created = true
    } catch (err) {
      if (!(err instanceof WorkspaceSlugTakenError)) throw err
      workspace = await store.findBySlug(slug)
      if (!workspace) throw err
    }
  }
  if (!(await store.hasMember(workspace.id, user.id))) {
    await store.addMember({ workspaceId: workspace.id, userId: user.id, role: "owner" })
  }
  return { workspace, created }
}

// ---------------------------------------------------------------------------
// Better Auth 어댑터 구현 (organization / member 모델)
// ---------------------------------------------------------------------------

/** Better Auth DB 어댑터 중 여기서 쓰는 부분만. */
export interface MinimalAdapter {
  findOne<T>(args: { model: string; where: { field: string; value: string }[] }): Promise<T | null>
  create<T extends Record<string, unknown>, R = T>(args: {
    model: string
    data: Omit<T, "id">
    forceAllowId?: boolean
  }): Promise<R>
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null
  return e?.code === "23505" || e?.cause?.code === "23505"
}

export function betterAuthWorkspaceStore(adapter: MinimalAdapter): WorkspaceStore {
  return {
    async findBySlug(slug) {
      return adapter.findOne<StoredWorkspace>({
        model: "organization",
        where: [{ field: "slug", value: slug }],
      })
    },
    async create({ name, slug, metadata }) {
      try {
        return await adapter.create<Record<string, unknown>, StoredWorkspace>({
          model: "organization",
          data: { name, slug, metadata: JSON.stringify(metadata), createdAt: new Date() },
        })
      } catch (err) {
        if (isUniqueViolation(err)) throw new WorkspaceSlugTakenError(slug)
        throw err
      }
    },
    async hasMember(workspaceId, userId) {
      const m = await adapter.findOne<{ id: string }>({
        model: "member",
        where: [
          { field: "organizationId", value: workspaceId },
          { field: "userId", value: userId },
        ],
      })
      return m !== null
    },
    async addMember({ workspaceId, userId, role }) {
      await adapter.create({
        model: "member",
        data: { organizationId: workspaceId, userId, role, createdAt: new Date() },
      })
    },
  }
}
