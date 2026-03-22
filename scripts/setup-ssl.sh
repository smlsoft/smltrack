#!/bin/bash
# ==============================================
# OpenClaw Mini CRM — Setup SSL Certificate (Let's Encrypt)
# Usage: ./scripts/setup-ssl.sh YOUR_DOMAIN
# ==============================================
set -e

DOMAIN="${1:-smlclaw.satistang.com}"
EMAIL="${2:-admin@satistang.com}"

echo "=== Setting up SSL for ${DOMAIN} ==="

# Step 1: ใช้ nginx config แบบ HTTP-only ก่อน (ยังไม่มี cert)
cat > /opt/smltrack/nginx/conf.d/default.conf << 'HTTPCONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    location / {
        return 200 'Waiting for SSL setup...';
        add_header Content-Type text/plain;
    }
}
HTTPCONF

# Step 2: Start nginx
docker compose -f docker-compose.prod.yml up -d nginx

# Step 3: Get certificate
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot \
  -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email

# Step 4: Restore full config (HTTPS)
echo "Restoring HTTPS config..."
git checkout nginx/conf.d/default.conf

# Step 5: Restart nginx with SSL
docker compose -f docker-compose.prod.yml restart nginx

echo ""
echo "=== SSL setup complete! ==="
echo "Test: https://${DOMAIN}"
