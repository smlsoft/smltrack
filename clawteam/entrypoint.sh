#!/bin/bash
set -e

# ส่ง env vars ให้ cron ใช้ได้
printenv | grep -E "^(AGENT_|OPENROUTER_|AI_MODEL|MONGODB_|GROQ_|SAMBANOVA_|CEREBRAS_|GOOGLE_)" > /etc/environment

echo "[ClawTeam] 🦀 Starting SMLTrack Advisor..."
echo "[ClawTeam] Agent API: ${AGENT_API_URL:-http://agent:3000}"
echo "[ClawTeam] AI Model: ${AI_MODEL:-qwen/qwen3-235b-a22b}"

# Init ClawTeam team
clawteam team spawn-team smltrack-advisors -d "SMLTrack Chat Advisor Team" -n advisor 2>/dev/null || true

# รัน advisor ครั้งแรก (30 วินาทีหลัง startup)
(sleep 30 && cd /app && python advisor.py >> /var/log/advisor.log 2>&1) &

# Start cron + ClawTeam web dashboard
cron

echo "[ClawTeam] ✅ Cron started (every hour)"
echo "[ClawTeam] 🌐 Dashboard: http://0.0.0.0:8080"

# ClawTeam board serve เป็น foreground process
exec clawteam board serve --port 8080 --host 0.0.0.0 2>/dev/null || \
  exec tail -f /var/log/advisor.log
