/**
 * 워크스페이스 초대 "링크" 테이블 — Better Auth organization 플러그인의 초대는 이메일 기반이라
 * (수락 시 이메일 일치 검사) 링크 초대를 위해 별도 모델을 둔다.
 *
 * 엔드포인트 없이 스키마만 선언하는 플러그인 → `npm run migrate`(Better Auth CLI)가 테이블을
 * 같이 만든다. 읽기·쓰기는 lib/workspaces/invites.ts.
 *
 *   id            = 링크 토큰 (Better Auth 기본 id: 무작위 32자) → `/invite/{id}`
 *   role          = 수락자에게 줄 역할 (admin | member)
 *   expiresAt     = 만료 시각. 만료·삭제(취소) 전까지 여러 명이 쓸 수 있다.
 */
import type { BetterAuthPlugin } from "better-auth"

export const workspaceInvites = () =>
  ({
    id: "workspace-invites",
    schema: {
      workspaceInvite: {
        fields: {
          organizationId: {
            type: "string",
            required: true,
            references: { model: "organization", field: "id", onDelete: "cascade" },
            index: true,
          },
          role: { type: "string", required: true },
          inviterId: {
            type: "string",
            required: true,
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          expiresAt: { type: "date", required: true },
          createdAt: { type: "date", required: true },
          acceptedCount: { type: "number", required: true, defaultValue: 0 },
        },
      },
    },
  }) satisfies BetterAuthPlugin
