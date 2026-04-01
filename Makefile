.PHONY: dev test build

COMPOSE := docker compose

dev: node_modules
	$(COMPOSE) up -d redis clickhouse
	npm run dev

test: node_modules
	npx vitest run

build: node_modules
	npm run build

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules
