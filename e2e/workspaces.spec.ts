import { expect, test } from "@playwright/test"

import { devSignIn, uniqueEmail } from "./helpers"

test("로그인 → 개인 워크스페이스 → 워크스페이스 생성 → 초대 링크 → 두 번째 사용자 수락", async ({ browser }) => {
  // ---- 사용자 A ----
  const a = await browser.newContext()
  const pageA = await a.newPage()
  const emailA = uniqueEmail("owner")

  await pageA.goto("/")
  await expect(pageA).toHaveURL(/\/sign-in\?callbackUrl=/)
  await expect(pageA.getByTestId("sign-in-page")).toBeVisible()
  await devSignIn(pageA, emailA, "김소유")

  // 계정 홈
  await expect(pageA.getByTestId("profile-name")).toHaveText("김소유")
  await expect(pageA.getByTestId("profile-email")).toHaveText(emailA)
  await expect(pageA.getByTestId("session-current-badge")).toBeVisible()
  await expect(pageA.getByTestId("connected-apps-empty")).toBeVisible()

  // 개인 워크스페이스 자동 생성
  await pageA.getByTestId("nav-workspaces-link").click()
  await expect(pageA.getByTestId("workspaces-list")).toContainText("김소유의 워크스페이스")

  // 새 워크스페이스
  await pageA.getByTestId("workspaces-create-button").click()
  await pageA.getByTestId("workspaces-create-name-input").fill("E2E 팀")
  await pageA.getByTestId("workspaces-create-submit-button").click()
  await expect(pageA).toHaveURL(/\/workspaces\/[^/]+$/)
  await expect(pageA.getByTestId("workspace-title")).toHaveText("E2E 팀")
  const workspaceUrl = pageA.url()

  // 이름 바꾸기
  await pageA.getByTestId("workspace-rename-input").fill("E2E 팀 (수정)")
  await pageA.getByTestId("workspace-rename-save-button").click()
  await expect(pageA.getByTestId("workspace-title")).toHaveText("E2E 팀 (수정)")

  // 초대 링크
  await expect(pageA.getByTestId("invite-links-empty")).toBeVisible()
  await pageA.getByTestId("invite-create-button").click()
  const urlInput = pageA.locator('[data-testid^="invite-link-"][data-testid$="-url-input"]').first()
  await expect(urlInput).toBeVisible()
  const inviteUrl = await urlInput.inputValue()
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]+$/)

  // ---- 사용자 B: 링크 → 로그인 → 수락 ----
  const b = await browser.newContext()
  const pageB = await b.newPage()
  const emailB = uniqueEmail("member")
  await pageB.goto(new URL(inviteUrl).pathname)
  await expect(pageB).toHaveURL(/\/sign-in\?callbackUrl=%2Finvite%2F/)
  await expect(pageB.getByTestId("sign-in-subtitle")).toContainText("초대")
  await devSignIn(pageB, emailB, "이멤버")
  await expect(pageB).toHaveURL(/\/invite\//)
  await expect(pageB.getByTestId("invite-workspace-name")).toHaveText("E2E 팀 (수정)")
  await pageB.getByTestId("invite-accept-button").click()
  await expect(pageB).toHaveURL(new URL(workspaceUrl).pathname)
  await expect(pageB.getByTestId("workspace-title")).toHaveText("E2E 팀 (수정)")
  // 멤버는 초대 링크와 이름 변경 권한 없음
  await expect(pageB.getByTestId("invite-links")).toHaveCount(0)
  await expect(pageB.getByTestId("workspace-rename-input")).toBeDisabled()

  // 같은 링크 다시 → 이미 멤버
  await pageB.goto(new URL(inviteUrl).pathname)
  await expect(pageB.getByTestId("invite-already-member")).toBeVisible()

  // A 화면: 멤버 2명, 참여 1명
  await pageA.reload()
  await expect(pageA.getByTestId("workspace-members-list")).toContainText("이멤버")
  await expect(pageA.getByTestId("invite-links-list")).toContainText("1명 참여")

  // B 는 나갈 수 있고, A(유일한 소유자)는 나가기 비활성
  await expect(pageA.getByTestId("workspace-leave-button")).toBeDisabled()
  await pageB.goto(new URL(workspaceUrl).pathname)
  await pageB.getByTestId("workspace-leave-button").click()
  await pageB.getByRole("button", { name: "나가기" }).last().click()
  await expect(pageB).toHaveURL(/\/workspaces$/)
  await expect(pageB.getByTestId("workspaces-list")).not.toContainText("E2E 팀")

  // A 가 삭제
  await pageA.getByTestId("workspace-delete-button").click()
  await pageA.getByRole("button", { name: "삭제" }).last().click()
  await expect(pageA).toHaveURL(/\/workspaces$/)
  await expect(pageA.getByTestId("workspaces-list")).not.toContainText("E2E 팀")

  await a.close()
  await b.close()
})

test("잘못된 초대 링크는 안내 화면", async ({ page }) => {
  await page.goto("/sign-in")
  await devSignIn(page, uniqueEmail("invalid"), "박링크")
  await page.goto("/invite/does-not-exist")
  await expect(page.getByTestId("invite-invalid-title")).toHaveText("유효하지 않은 초대 링크입니다")
})
