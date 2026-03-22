#!/bin/bash
# ==============================================
# OpenClaw Mini CRM — Deploy to Hetzner VPS
# Usage: ./scripts/deploy.sh
# ==============================================
set -e

REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST}"
REMOTE_DIR="/opt/smltrack"
COMPOSE_FILE="docker-compose.prod.yml"

if [ -z "$REMOTE_HOST" ]; then
  echo "ERROR: DEPLOY_HOST is not set"
  echo "Usage: DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh"
  exit 1
fi

echo "=== OpenClaw Mini CRM Deploy to ${REMOTE_USER}@${REMOTE_HOST} ==="

# Step 1: Sync files (exclude secrets + runtime)
echo "[1/4] Syncing files..."
rsync -avz --delete \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'openclaw/logs' \
  --exclude 'openclaw/cron/runs' \
  --exclude 'openclaw/workspace' \
  --exclude 'openclaw/devices' \
  --exclude 'openclaw/agents' \
  --exclude 'openclaw/canvas' \
  --exclude 'openclaw/identity' \
  --exclude 'openclaw/*.bak*' \
  --exclude '*.png' \
  --exclude '.playwright-mcp' \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# Step 2: Build & restart on remote
echo "[2/4] Building containers..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} build --no-cache"

echo "[3/4] Starting services..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} up -d"

# Step 4: Health check
echo "[4/4] Checking health..."
sleep 10
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} ps"

echo ""
echo "=== Deploy complete! ==="
echo "Dashboard: https://smlclaw.satistang.com/dashboard"
