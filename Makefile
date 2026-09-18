IMAGE = ai-graveyard/fastype
VERSION = latest
NEXT_PUBLIC_BASE_PATH ?=
# 和 Dockerfile 最终阶段的 LABEL 保持一致，deploy 用它把清理限定在自己的镜像上。
PRUNE_LABEL = com.ai-graveyard.project=fastype

.DEFAULT_GOAL := help

.PHONY: dev build start stop restart logs deploy help

dev:
	pnpm dev

build:
	docker build --build-arg NEXT_PUBLIC_BASE_PATH="$(NEXT_PUBLIC_BASE_PATH)" -t $(IMAGE):$(VERSION) .

start:
	cd deploy && docker compose up -d

stop:
	cd deploy && docker compose down

restart: stop start

logs:
	cd deploy && docker compose logs -f

deploy:
	git pull --ff-only
	@$(MAKE) build
	@$(MAKE) restart
	docker image prune -f --filter "label=$(PRUNE_LABEL)"

help:
	@echo "Targets:"
	@echo "  make dev      - 本地启动开发服务器"
	@echo "  make build    - 构建 Docker 镜像"
	@echo "  make start    - 启动服务（docker compose up -d）"
	@echo "  make stop     - 停止服务"
	@echo "  make restart  - 重启服务"
	@echo "  make logs     - 查看服务日志"
	@echo "  make deploy   - git pull + 构建镜像 + 重启服务"
