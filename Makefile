.PHONY: dev test build setup

-include .env
export

COMPOSE := docker compose
VENV := .venv
PYTHON := $(VENV)/bin/python3
PIP := $(VENV)/bin/pip

setup: node_modules $(VENV)
	$(COMPOSE) up -d redis clickhouse
	@echo "Waiting for ClickHouse to be ready..."
	@until docker exec clickhouse clickhouse-client --user $(CLICKHOUSE_USER) --password $(CLICKHOUSE_PASSWORD) --query "SELECT 1" > /dev/null 2>&1; do sleep 1; done
	docker exec clickhouse clickhouse-client --user $(CLICKHOUSE_USER) --password $(CLICKHOUSE_PASSWORD) -d $(CLICKHOUSE_DATABASE) --multiquery < clickhouse/init.sql
	@echo "Setup complete: node_modules, python venv, redis, clickhouse"

dev: node_modules
	$(COMPOSE) up -d redis clickhouse
	npm run dev

test: node_modules
	NODE_OPTIONS='--experimental-vm-modules' npx jest

build: node_modules
	npm run build

$(VENV): requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt
	@touch $(VENV)

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules
