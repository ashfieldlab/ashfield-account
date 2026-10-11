# Ashfield Account: 개발 명령. `make help` 로 목록.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup install infra stop clean migrate seed seed-rotate dev build start \
        lint typecheck test e2e browsers oidc-check ci-local \
        deploy-git-init deploy-init deploy deploy-ps deploy-logs deploy-backup

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

clean:  ## Postgres 컨테이너와 볼륨 삭제 (데이터 삭제!)
	docker compose down -v

migrate:  ## Better Auth 테이블 생성과 갱신 (Better Auth CLI)
	npm run migrate

seed:  ## 1st-party OAuth 클라이언트 등록과 갱신 (멱등). 새 secret 은 .secrets/clients.local.json
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

e2e:  ## Playwright E2E (전제: infra, migrate, seed, AUTH_DEV_PASSWORD_LOGIN=true. 서버는 자동 기동/재사용)
	npm run e2e

oidc-check:  ## OIDC 종단 점검: ashfield-sync 로 authorize→PKCE→token→JWKS 검증→refresh 회전 (서버 기동 필요)
	npm run oidc:check

ci-local: lint typecheck test build  ## push 전 로컬 점검 (e2e, oidc-check 는 서버 필요: 별도)

# ---- 운영 배포 (docs/deploy.md): 서버가 GitHub origin/main 을 받아 scripts/prod.sh 실행 ----
DEPLOY_HOST ?= ovm
DEPLOY_DIR ?= ashfield/account
# 서버는 레포 전용 읽기 전용 deploy key (ssh 별칭 github-<repo>) 로 GitHub 에서 직접 받는다.
# 추적하지 않는 서버 전용 파일(.env.prod, backups/ 등)은 그대로 남는다.
DEPLOY_SLUG := $(shell git remote get-url origin | sed -E 's#\.git$$##; s#^.*[:/]([^/]+/[^/]+)$$#\1#')
DEPLOY_PULL := git -C $(DEPLOY_DIR) fetch -q origin main && git -C $(DEPLOY_DIR) checkout -q -f -B main origin/main && git -C $(DEPLOY_DIR) log -1 --format="→ %h %s"

deploy-git-init:  ## 처음 한 번: 서버에 deploy key 를 만들고 배포 디렉터리를 GitHub 체크아웃으로 (키 등록 안내가 나오면 등록 후 다시 실행)
	ssh $(DEPLOY_HOST) 'sh -s -- $(DEPLOY_SLUG) $(DEPLOY_DIR)' < scripts/server-git-init.sh


deploy-init: ## 처음 한 번: 서버에 .env.prod 생성, 비밀값은 서버에서 생성 (ADMIN_EMAIL=허용 이메일)
	ssh $(DEPLOY_HOST) '$(DEPLOY_PULL) && ADMIN_EMAIL="$(ADMIN_EMAIL)" sh $(DEPLOY_DIR)/scripts/prod.sh init-env'

deploy: ## 운영 배포: GitHub origin/main 받기, 빌드, 마이그레이션, 클라이언트 등록, 재시작
	@git fetch -q origin main && test -z "$$(git log --oneline origin/main..HEAD)" || echo "! push 하지 않은 커밋은 배포되지 않습니다 (서버는 origin/main 을 받는다)"
	ssh $(DEPLOY_HOST) '$(DEPLOY_PULL) && sh $(DEPLOY_DIR)/scripts/prod.sh up'

deploy-ps:  ## 운영 컨테이너 상태
	ssh $(DEPLOY_HOST) 'sh $(DEPLOY_DIR)/scripts/prod.sh ps'

deploy-logs:  ## 운영 로그 follow
	ssh -t $(DEPLOY_HOST) 'sh $(DEPLOY_DIR)/scripts/prod.sh logs'

deploy-backup:  ## 운영 Postgres 덤프 (서버의 backups/)
	ssh $(DEPLOY_HOST) 'sh $(DEPLOY_DIR)/scripts/prod.sh backup'
