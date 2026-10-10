import { expect, type Page } from "@playwright/test"

export const PASSWORD = "e2e-password-1234"

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
}

/** DEV 비밀번호 로그인 (처음 쓰는 이메일이면 가입). 로그인 화면이 아니면 먼저 이동한다. */
export async function devSignIn(page: Page, email: string, name: string) {
  if (!page.url().includes("/sign-in")) await page.goto("/sign-in")
  await page.getByTestId("sign-in-dev-email-input").fill(email)
  await page.getByTestId("sign-in-dev-password-input").fill(PASSWORD)
  await page.getByTestId("sign-in-dev-name-input").fill(name)
  await page.getByTestId("sign-in-dev-submit-button").click()
  await expect(page).not.toHaveURL(/\/sign-in/)
}
