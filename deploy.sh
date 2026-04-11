#!/bin/bash
set -euo pipefail

# This script runs ON the droplet via SSH from the CD pipeline.
# It expects:
#   - APP_IMAGE env var (e.g., ghcr.io/baronliu1993/moviebackend:sha-abc123)
#   - .env file already written to /opt/moviebackend/.env
#   - Docker and docker compose installed

APP_DIR="/opt/moviebackend"
COMPOSE_URL="https://raw.githubusercontent.com/BaronLiu1993/moviebackend/main"

cd "$APP_DIR"

echo "==> Pulling deployment files..."
curl -sSfL "$COMPOSE_URL/docker-compose.yml" -o docker-compose.yml
curl -sSfL "$COMPOSE_URL/Caddyfile" -o Caddyfile
curl -sSfL "$COMPOSE_URL/clickhouse/init.sql" -o init.sql
mkdir -p clickhouse
mv init.sql clickhouse/init.sql

echo "==> Pulling image: $APP_IMAGE"
docker pull "$APP_IMAGE"

echo "==> Deploying with docker compose..."
export APP_IMAGE
docker compose --env-file .env up -d --remove-orphans

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Waiting for health check..."
for i in $(seq 1 30); do
  if docker inspect --format='{{.State.Health.Status}}' app 2>/dev/null | grep -q healthy; then
    echo "==> App is healthy!"
    exit 0
  fi
  sleep 2
done

echo "==> WARNING: App did not become healthy within 60s"
docker logs app --tail 30
exit 1
