#!/bin/bash
# ==============================================
# OpenClaw Mini CRM — Setup Hetzner VPS (รันครั้งแรกครั้งเดียว)
# Usage: ssh root@YOUR_IP 'bash -s' < scripts/setup-server.sh
# ==============================================
set -e

echo "=== OpenClaw Mini CRM Server Setup ==="

# 1. Update system
echo "[1/6] Updating system..."
apt-get update && apt-get upgrade -y

# 2. Install Docker
echo "[2/6] Installing Docker..."
curl -fsSL https://get.docker.com | sh

# 3. Install Docker Compose plugin
echo "[3/6] Docker Compose..."
apt-get install -y docker-compose-plugin

# 4. Create project directory
echo "[4/6] Creating project directory..."
mkdir -p /opt/smltrack

# 5. Setup firewall
echo "[5/6] Configuring firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# 6. Setup auto-update
echo "[6/6] Setting up auto-update..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo ""
echo "=== Server setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Copy .env to server: scp .env root@SERVER_IP:/opt/smltrack/"
echo "  2. Deploy: DEPLOY_HOST=SERVER_IP ./scripts/deploy.sh"
echo "  3. Setup SSL: ssh root@SERVER_IP 'cd /opt/smltrack && ./scripts/setup-ssl.sh'"
