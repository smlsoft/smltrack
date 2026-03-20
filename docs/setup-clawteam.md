# ClawTeam AI Advisor — Setup Guide

> ClawTeam คือ **AI Advisor (แกนหลัก)** ของ SMLTrack
> ใช้ multi-agent swarm วิเคราะห์แชททุก 1 ชม. แล้วสร้างคำแนะนำ
> พร้อม cost tracking ทุก AI call

---

## ClawTeam คืออะไร?

ClawTeam เป็น **multi-agent swarm framework** ที่ AI agents ทำงานร่วมกันเป็นทีม

**GitHub:** https://github.com/HKUDS/ClawTeam

ใน SMLTrack ใช้ ClawTeam สำหรับ:
- **Multi-agent advisor** — 3 agents วิเคราะห์พร้อมกัน (ประหยัด token)
- **Task orchestration** — จัดการงาน, inbox, board
- **Cost tracking** — บันทึกค่าใช้จ่ายทุก AI call ลง MongoDB
- **Cron scheduling** — รันทุก 1 ชม. อัตโนมัติ

---

## สิ่งที่ต้องมี

| รายการ | หมายเหตุ |
|--------|---------|
| Docker Desktop | ติดตั้งแล้วจาก setup-docker.md |
| `OPENROUTER_API_KEY` | สมัครแล้วจาก setup-ai-providers.md |
| MongoDB Atlas | ติดตั้งแล้วจาก setup-mongodb.md |

> ClawTeam ใช้ **OpenRouter API key ตัวเดียวกัน** กับ Agent — ไม่ต้องสมัครเพิ่ม

---

## ไฟล์สำคัญ

```
clawteam/
├── Dockerfile          # Docker image (Python + ClawTeam + cron)
├── advisor.py          # น้องกุ้ง — multi-agent advisor script
├── crontab.txt         # cron ทุก 1 ชม.
└── entrypoint.sh       # startup script
```

---

## การทำงาน (ทุก 1 ชม.)

```
ClawTeam Container
  │
  ├── Cron trigger (ทุกต้นชั่วโมง)
  │
  ├── advisor.py เริ่มทำงาน
  │     │
  │     ├── 1. GET /api/advisor/sources-changed
  │     │      → ดู sourceId ที่มีข้อความใหม่ (1 ชม.)
  │     │
  │     ├── 2. GET /api/advisor/source-detail/:id
  │     │      → ดึงข้อความ + analytics + skills + alerts
  │     │
  │     ├── 3. Multi-Agent วิเคราะห์ (3 agents พร้อมกัน)
  │     │      ├── Sentiment Agent → critical / warning
  │     │      ├── Pipeline Agent  → opportunity
  │     │      └── Summary Agent   → info / stats
  │     │
  │     ├── 4. POST /api/advisor/advice
  │     │      → บันทึกคำแนะนำลง MongoDB (auto-normalize)
  │     │
  │     ├── 5. POST /api/advisor/update-pulled
  │     │      → อัพเดต lastPulledAt (ไม่ดึงซ้ำ)
  │     │
  │     └── 6. Cost tracking → บันทึกทุก AI call
  │
  └── ClawTeam Board (web dashboard port 8080)
```

---

## เปลี่ยน AI Model

แก้ `.env` (ที่ root ของ project):

```env
# Qwen3-235B (default — ฉลาด, ราคาถูก ~$0.18/1M tokens)
AI_MODEL=qwen/qwen3-235b-a22b

# Qwen3-30B (ถูกกว่า ~$0.04/1M tokens แต่ฉลาดน้อยกว่า)
# AI_MODEL=qwen/qwen3-30b-a3b

# Llama 3.3-70B free (ฟรี แต่ rate limit บ่อย)
# AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

แล้ว restart:
```bash
docker compose restart clawteam
```

---

## Multi-Agent ประหยัด Token อย่างไร?

### แบบเดิม (single agent)
ส่ง prompt ยาวๆ 1 ก้อน รวมทุกข้อมูล → ใช้ ~5,000 tokens

### แบบใหม่ (3 agents)
แยก 3 prompt สั้นๆ → รันพร้อมกัน:

| Agent | Prompt size | Max output | รวม |
|-------|------------|-----------|-----|
| Sentiment | ~500 tokens | 500 | ~1,000 |
| Pipeline | ~500 tokens | 500 | ~1,000 |
| Summary | ~300 tokens | 300 | ~600 |
| **รวม** | | | **~2,600 tokens** |

**ประหยัด ~50%** เพราะแต่ละ agent เห็นเฉพาะข้อมูลที่เกี่ยวข้อง

---

## AI Cost Tracking

ทุก AI call ถูก track ลง MongoDB collection `ai_costs`:

```json
{
  "provider": "openrouter",
  "model": "qwen/qwen3-235b-a22b",
  "feature": "advisor-sentiment",
  "inputTokens": 450,
  "outputTokens": 320,
  "totalTokens": 770,
  "costUsd": 0.000139,
  "service": "clawteam",
  "createdAt": "2026-03-20T12:00:00Z"
}
```

### Features ที่ track

| Feature | Service | หน้าที่ |
|---------|---------|---------|
| `chat-reply` | agent | ตอบแชท LINE |
| `chat-tools` | agent | เรียก MCP tools |
| `light-ai` | agent | AI เบา (sentiment, summary) |
| `light-ai-json` | agent | AI เบา (JSON output) |
| `embedding` | agent | Gemini Embedding |
| `advisor-sentiment` | clawteam | น้องกุ้ง: วิเคราะห์ sentiment |
| `advisor-pipeline` | clawteam | น้องกุ้ง: วิเคราะห์โอกาสขาย |
| `advisor-summary` | clawteam | น้องกุ้ง: สรุปภาพรวม |

### ดูค่าใช้จ่ายใน Dashboard

เข้าหน้า **💰 AI Cost** ที่ `/dashboard/costs`:
- Summary cards: วันนี้ / เดือนนี้
- กราฟ Token ใช้ต่อวัน (7 วัน)
- แยกตาม feature + provider
- AI Calls ล่าสุด real-time
- ราคาโดยประมาณเป็น THB

---

## API Endpoints

Agent (`http://agent:3000`) ให้บริการ API สำหรับ ClawTeam:

| Endpoint | Method | หน้าที่ |
|----------|--------|---------|
| `/api/advisor/sources-changed?since=ISO` | GET | ดู sourceId ที่มีข้อความใหม่ |
| `/api/advisor/source-detail/:sourceId?since=ISO` | GET | ข้อความ + analytics + skills + alerts |
| `/api/advisor/advice` | POST | บันทึกคำแนะนำ (auto-normalize format) |
| `/api/advisor/update-pulled` | POST | อัพเดต lastPulledAt |
| `/api/advisor/cost` | POST | บันทึกค่าใช้จ่าย AI |
| `/api/costs` | GET | ดูสรุปค่าใช้จ่าย (dashboard ใช้) |

---

## MongoDB Collections

| Collection | หน้าที่ | สร้างโดย |
|-----------|---------|---------|
| `ai_advice` | คำแนะนำจาก AI Advisor | ClawTeam |
| `ai_costs` | ค่าใช้จ่าย AI ทุก call | Agent + ClawTeam |
| `advisor_pull_log` | lastPulledAt tracking | ClawTeam |

---

## Troubleshooting

### ClawTeam ไม่ start
```bash
docker logs smltrack-clawteam
```
สาเหตุที่พบบ่อย:
- `.env` ไม่มี `OPENROUTER_API_KEY` → สมัครที่ openrouter.ai
- Agent ยัง start ไม่เสร็จ → รอ 10 วินาทีแล้วลองใหม่

### Advisor ไม่สร้างคำแนะนำ
```bash
# ดู log
docker exec smltrack-clawteam cat //var//log//advisor.log

# รัน manual
docker exec smltrack-clawteam python /app/advisor.py
```
สาเหตุที่พบบ่อย:
- ไม่มีข้อความใหม่ในรอบ 1 ชม. → ปกติ (ไม่สร้าง advice ซ้ำ)
- OpenRouter rate limit → รอ 5-10 นาทีแล้วลองใหม่

### ดู cost ไม่ขึ้น
- cost จะเริ่มเก็บหลัง rebuild agent → ข้อมูลเก่าไม่มี
- ทดสอบ: `curl http://localhost:3000/api/costs`

### เปลี่ยน cron schedule
แก้ `clawteam/crontab.txt`:
```
# ทุก 30 นาที
*/30 * * * * cd /app && python advisor.py >> /var/log/advisor.log 2>&1

# ทุก 2 ชม.
0 */2 * * * cd /app && python advisor.py >> /var/log/advisor.log 2>&1
```
แล้ว rebuild: `docker compose up -d --build clawteam`
