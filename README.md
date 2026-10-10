<div align="center">

<img src="public/icons/ashfield/mark.svg" width="72" alt="Ashfield" />

# Ashfield Account

Ashfield 앱들의 통합 계정 서버

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.7-3f4a3c?style=flat-square)](https://www.better-auth.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

</div>

한 번 로그인하면 Calendar · Drive · Sync 를 모두 쓸 수 있고, 함께 일할 워크스페이스를 여기서 관리합니다.

- **하나의 계정**: Google · GitHub 로 로그인하고, 모든 Ashfield 앱에 바로 들어갑니다 (SSO)
- **워크스페이스**: 만들고, 링크로 초대하고, 멤버 역할을 관리합니다
- **연결 관리**: 로그인된 앱과 기기를 확인하고 언제든 연결을 끊습니다
- **표준 OpenID Connect**: 앱은 표준 OIDC 클라이언트로 붙습니다

## 시작하기

Node 24+ 와 Docker 가 필요합니다.

```bash
make setup   # 의존성 설치, DB 기동, 테이블 생성, 앱 클라이언트 등록
make dev     # http://localhost:3300
```

## 문서

- [Google · GitHub 로그인 설정](docs/setup-oauth.md)
- [앱 연결 계약 (OIDC)](docs/adr/0001-account-server-contract.md): 앱이 토큰을 받고 검증하는 방법

## Ashfield

| | |
|---|---|
| [Account](https://github.com/ashfieldlab/ashfield-account) | 계정 · 워크스페이스 |
| [Calendar](https://github.com/ashfieldlab/ashfield-calendar) | 일정 · 회의실 · 예약 |
| [Drive](https://github.com/ashfieldlab/ashfield-drive) | 파일 저장 · 공유 |
| [Sync](https://github.com/ashfieldlab/ashfield-sync) | Drive 데스크톱 동기화 (Windows) |

## 라이선스

MIT
