.PHONY: dev test build train

COMPOSE := docker compose

dev: node_modules
	$(COMPOSE) up -d redis clickhouse
	npm run dev

test: node_modules
	NODE_OPTIONS='--experimental-vm-modules' npx jest

build: node_modules
	npm run build

train:
	python3 ranking/training/train.py

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules
