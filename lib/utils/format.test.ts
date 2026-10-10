import { describe, expect, it } from "vitest"

import { safeCallbackUrl } from "./callback-url"
import { formatIp, formatRelative, formatRemaining } from "./format"
import { describeUserAgent } from "./user-agent"

describe("safeCallbackUrl", () => {
  it("내부 경로만 허용", () => {
    expect(safeCallbackUrl("/workspaces/abc")).toBe("/workspaces/abc")
    expect(safeCallbackUrl("https://evil.example")).toBe("/")
    expect(safeCallbackUrl("//evil.example")).toBe("/")
    expect(safeCallbackUrl("/\\evil.example")).toBe("/")
    expect(safeCallbackUrl("/sign-in?x=1")).toBe("/")
    expect(safeCallbackUrl(undefined, "/home")).toBe("/home")
  })
})

describe("format", () => {
  const now = new Date("2026-10-10T00:00:00Z")
  it("상대 시간", () => {
    expect(formatRelative(new Date(now.getTime() - 30_000), now)).toBe("방금 전")
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000), now)).toBe("5분 전")
    expect(formatRelative(new Date(now.getTime() - 3 * 86_400_000), now)).toBe("3일 전")
  })
  it("남은 기간 (7일짜리 링크는 7일)", () => {
    expect(formatRemaining(new Date(now.getTime() + 7 * 86_400_000 - 1000), now)).toBe("7일 남음")
    expect(formatRemaining(new Date(now.getTime() - 1), now)).toBe("만료됨")
  })
  it("루프백 IP", () => {
    expect(formatIp("::1")).toBe("이 컴퓨터(localhost)")
    expect(formatIp("0000:0000:0000:0000:0000:0000:0000:0001")).toBe("이 컴퓨터(localhost)")
    expect(formatIp("0000:0000:0000:0000:0000:0000:0000:0000")).toBe("이 컴퓨터(localhost)")
    expect(formatIp("127.0.0.1")).toBe("이 컴퓨터(localhost)")
    expect(formatIp("203.0.113.7")).toBe("203.0.113.7")
  })
  it("User-Agent 요약", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
    expect(describeUserAgent(ua)).toEqual({ label: "Chrome, Windows", kind: "desktop" })
    expect(describeUserAgent(null).kind).toBe("unknown")
  })
})
