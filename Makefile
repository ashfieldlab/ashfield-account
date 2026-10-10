# Ashfield Account: 개발 명령. `make help` 로 목록.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup install infra stop clean migrate seed seed-rotate dev build start \
        lint typecheck test e2e browsers oidc-check ci-local

help:  ## 명령 목록
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: install  ## 처음 한 번: 의존성 설치 + .env 생성 + infra + migrate + seed
	@test -f .env || (cp .env.example .env && echo "✓ .env 생성 (.env.example 복사)")
	$(MAKE) infra migrate seed

install:  ## npm 의존성 설치
	npm install

infra:  ## Postgres 기동 (docker compose, 호스트 포트 5632)
	docker compose up -d --wait

stop:  ## Postgres 정지 (데이터 유지)
	docker compose stop

clean:  ## Postgres 컨테이너·볼륨 삭제 (데이터 삭제!)
	docker compose down -v

migrate:  ## Better Auth 테이블 생성·갱신 (Better Auth CLI)
	npm run migrate

seed:  ## 1st-party OAuth 클라이언트 등록·갱신 (멱등). 새 secret 은 .secrets/clients.local.json
	npm run seed:clients

seed-rotate:  ## confidential client secret 재발급
	npm run seed:clients -- --rotate

dev:  ## 개발 서버 http://localhost:3300
	npm run dev

build:  ## 프로덕션 빌드
	npm run build

start:  ## 프로덕션 서버 (build 후)
	npm run start

lint:  ## ESLint
	npm run lint

typecheck:  ## TypeScript
	npm run typecheck

test:  ## 단위 테스트 (vitest)
	npm test

browsers:  ## Playwright 브라우저 설치 (Ubuntu 26.04 등 미지원 OS 는 24.04 바이너리)
	PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium

e2e:  ## Playwright E2E (전제: infra·migrate·seed, AUTH_DEV_PASSWORD_LOGIN=true. 서버는 자동 기동/재사용)
	npm run e2e

oidc-check:  ## OIDC 종단 점검: ashfield-sync 로 authorize→PKCE→token→JWKS 검증→refresh 회전 (서버 기동 필요)
	npm run oidc:check

ci-local: lint typecheck test build  ## push 전 로컬 점검 (e2e·oidc-check 는 서버 필요: 별도)
