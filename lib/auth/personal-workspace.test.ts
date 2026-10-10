import { describe, expect, it } from "vitest"

import {
  ensurePersonalWorkspace,
  isPersonalWorkspaceMetadata,
  personalWorkspaceName,
  personalWorkspaceSlug,
  WorkspaceSlugTakenError,
  type StoredWorkspace,
  type WorkspaceStore,
} from "./personal-workspace"

function memoryStore() {
  const workspaces: (StoredWorkspace & { metadata: Record<string, unknown> })[] = []
  const members: { workspaceId: string; userId: string; role: string }[] = []
  let seq = 0
  const store: WorkspaceStore = {
    async findBySlug(slug) {
      return workspaces.find((w) => w.slug === slug) ?? null
    },
    async create(data) {
      if (workspaces.some((w) => w.slug === data.slug)) throw new WorkspaceSlugTakenError(data.slug)
      const w = { id: `ws_${++seq}`, ...data }
      workspaces.push(w)
      return w
    },
    async hasMember(workspaceId, userId) {
      return members.some((m) => m.workspaceId === workspaceId && m.userId === userId)
    },
    async addMember(data) {
      members.push(data)
    },
  }
  return { store, workspaces, members }
}

const alice = { id: "u_Alice1", name: "앨리스", email: "alice@example.com" }

describe("personal workspace", () => {
  it("처음 호출이면 '<이름>의 워크스페이스' 를 만들고 owner 로 넣는다", async () => {
    const { store, workspaces, members } = memoryStore()
    const res = await ensurePersonalWorkspace(store, alice)
    expect(res.created).toBe(true)
    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]).toMatchObject({
      name: "앨리스의 워크스페이스",
      slug: "personal-u_Alice1",
      metadata: { personal: true, ownerUserId: "u_Alice1" },
    })
    expect(members).toEqual([{ workspaceId: res.workspace.id, userId: alice.id, role: "owner" }])
  })

  it("여러 번 호출해도 하나만 (멱등)", async () => {
    const { store, workspaces, members } = memoryStore()
    await ensurePersonalWorkspace(store, alice)
    const again = await ensurePersonalWorkspace(store, alice)
    await ensurePersonalWorkspace(store, { ...alice, name: "이름 바뀜" })
    expect(again.created).toBe(false)
    expect(workspaces).toHaveLength(1)
    expect(members).toHaveLength(1)
  })

  it("동시 호출이 겹쳐도 하나만 (slug 유니크 충돌 → 기존 것 사용)", async () => {
    const { store, workspaces } = memoryStore()
    const results = await Promise.all([
      ensurePersonalWorkspace(store, alice),
      ensurePersonalWorkspace(store, alice),
      ensurePersonalWorkspace(store, alice),
    ])
    expect(workspaces).toHaveLength(1)
    expect(new Set(results.map((r) => r.workspace.id)).size).toBe(1)
    expect(results.filter((r) => r.created)).toHaveLength(1)
  })

  it("워크스페이스는 있는데 멤버십이 빠졌으면 채운다", async () => {
    const { store, members } = memoryStore()
    await store.create({ name: "x", slug: personalWorkspaceSlug(alice.id), metadata: {} })
    const res = await ensurePersonalWorkspace(store, alice)
    expect(res.created).toBe(false)
    expect(members).toEqual([{ workspaceId: res.workspace.id, userId: alice.id, role: "owner" }])
  })

  it("다른 오류는 그대로 던진다", async () => {
    const { store } = memoryStore()
    store.create = async () => {
      throw new Error("db down")
    }
    await expect(ensurePersonalWorkspace(store, alice)).rejects.toThrow("db down")
  })

  it("이름이 비면 이메일 앞부분", () => {
    expect(personalWorkspaceName({ name: "  ", email: "bob@example.com" })).toBe("bob의 워크스페이스")
    expect(personalWorkspaceName({ name: null, email: "carol@example.com" })).toBe(
      "carol의 워크스페이스",
    )
  })

  it("metadata 표식 판별 (객체·JSON 문자열)", () => {
    expect(isPersonalWorkspaceMetadata({ personal: true })).toBe(true)
    expect(isPersonalWorkspaceMetadata('{"personal":true}')).toBe(true)
    expect(isPersonalWorkspaceMetadata('{"personal":"yes"}')).toBe(false)
    expect(isPersonalWorkspaceMetadata("not json")).toBe(false)
    expect(isPersonalWorkspaceMetadata(null)).toBe(false)
  })
})
