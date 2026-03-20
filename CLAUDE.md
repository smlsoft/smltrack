# SMLTrack Project Rules

## Architecture
```
LINE → Cloudflare Tunnel → Agent (Docker) → AI + RAG + MCP → LINE reply
                                  ↓
                            MongoDB Atlas (messages collection เดียว)
                                  ↓
                  ClawTeam (แกนหลัก) ← cron ทุก 1 ชม. → วิเคราะห์ → เก็บ advice
                                  ↓
                            Dashboard (Docker) → แสดงสนทนา + analytics + advice
```

## Core Principle — ClawTeam เป็นแกนหลัก
- **ClawTeam** = สมองกลาง (AI Advisor) — multi-agent swarm orchestration
- **Agent** = หูและปาก (LINE webhook listener + RAG + AI reply + MCP)
- **Dashboard** = ตา (แสดงข้อมูลจาก MongoDB)
- ClawTeam GitHub: https://github.com/HKUDS/ClawTeam

## Services
| Service | Role | Deploy | Port | Folder |
|---------|------|--------|------|--------|
| **ClawTeam** | AI Advisor (แกนหลัก) | Docker Desktop | 8080 | `clawteam/` |
| **Agent** | LINE + RAG + MCP | Docker Desktop + Cloudflare Tunnel | 3000 | `proxy/` |
| **Dashboard** | Web UI | Docker Desktop | 3001→3002 | `smltrackdashboard/` |
| **Tunnel** | Fixed URL | Docker Desktop | - | cloudflared |

## URLs
- **LINE webhook:** `https://smlclaw.satistang.com/webhook`
- **Dashboard:** `https://smlclaw.satistang.com/dashboard`
- **ClawTeam board:** `http://localhost:8080`
- **Agent health:** `http://localhost:3000/`

## Deploy Rules
- **ทั้งหมดรันบน Docker Desktop:** `docker compose up -d --build`
- **อย่าลบ service/folder โดยไม่ถามบอสก่อน**

## ClawTeam (AI Brain)
- **Script:** `clawteam/advisor.py` — น้องกุ้ง AI Advisor
- **Cron:** ทุก 1 ชม. (ตั้งใน `clawteam/crontab.txt`)
- **AI:** OpenRouter Qwen3-235B (ตั้งผ่าน `AI_MODEL` env var)
- **Flow:** ดึงแชทใหม่จาก Agent API → AI วิเคราะห์ → เก็บ advice ใน MongoDB
- **เฉพาะ sources ที่เปลี่ยน:** ดู `advisor_pull_log.lastPulledAt` ต่อ sourceId
- **Team orchestration:** ClawTeam CLI จัดการ task/inbox/board

## Advisor API (Agent ให้บริการ — path เป็น /api/advisor/* เพื่อ backward compat)
| Endpoint | Method | หน้าที่ |
|----------|--------|---------|
| `/api/advisor/sources-changed?since=ISO` | GET | ดู sourceId ที่มีข้อความใหม่ |
| `/api/advisor/source-detail/:sourceId?since=ISO` | GET | ข้อความ + analytics + skills + alerts |
| `/api/advisor/advice` | POST | บันทึกคำแนะนำ (auto-normalize format) |
| `/api/advisor/update-pulled` | POST | อัพเดต lastPulledAt |
| `/api/advisor/cost` | POST | บันทึกค่าใช้จ่าย AI |
| `/api/costs` | GET | ดูสรุปค่าใช้จ่าย (dashboard) |

## AI Providers (ใช้ key ชุดเดียวกัน)
### ClawTeam (แกนหลัก)
- OpenRouter Qwen3-235B-A22B (ตั้งผ่าน `AI_MODEL`)

### Agent (LINE reply — ฟรีทั้งหมด)
1. OpenRouter (free) → 2. SambaNova → 3. Groq → 4. Cerebras → 5. Gemini

## RAG (3-tier fallback)
1. MongoDB Atlas Vector Search (`$vectorSearch` + filter sourceId)
2. Keyword Search (regex)
3. Recent messages (sort by createdAt)

## Database
- **MongoDB Atlas M0** (free)
- **Collection เดียว:** `messages` (compound index: sourceId + createdAt)
- **แยกคน/กลุ่ม:** ใช้ `sourceId` field
- **อย่าแยก collection ตามคน/กลุ่ม** — ใช้ collection เดียวเสมอ
- **Analytics:** `chat_analytics` collection แยก
- **Config:** `bot_config`, `groups_meta`
- **Advisor:** `ai_advice` (คำแนะนำ), `advisor_pull_log` (lastPulledAt tracking)

## MCP
- **bc-erp MCP server:** `http://host.docker.internal:8888/goapi/mcp/sse`
- Transport: SSE (response ส่งกลับทาง SSE stream ไม่ใช่ HTTP response)
- 61 tools: สินค้า, ยอดขาย, KPI, ลูกหนี้/เจ้าหนี้, สต็อก ฯลฯ

## น้องปู (AI Personality — Agent)
- เป็น **เลขาส่วนตัว** (ไม่ใช่คลินิก ไม่ใช่ร้าน)
- ตอบภาษาไทย สุภาพ เป็นกันเอง มีมุขตลก
- ห้ามบอกว่าเป็น AI/chatbot

## น้องกุ้ง (AI Advisor — ClawTeam)
- วิเคราะห์แชททุก 1 ชม. ผ่าน `clawteam/advisor.py`
- ให้คำแนะนำ 3-7 ข้อ เรียงตาม priority (critical → warning → opportunity → info)
- เฉพาะ sources ที่มีการเปลี่ยนแปลง
- แสดงผลใน Dashboard หน้า Advice

## Env vars (.env)
- `MONGODB_URI` — MongoDB Atlas connection
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`
- `SAMBANOVA_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`
- `MCP_ERP_API_KEY` — bc-erp MCP auth
- `CLOUDFLARE_TUNNEL_TOKEN` — named tunnel token
- `AI_MODEL` — model สำหรับ ClawTeam advisor (default: `qwen/qwen3-235b-a22b`)

## สิ่งที่ห้ามทำ
- ห้ามลบ folder/service โดยไม่ถามบอสก่อน
- ห้ามเปลี่ยน deploy strategy โดยไม่แจ้ง (ทุก service = Docker Desktop)
- ห้ามแยก MongoDB collection ตามคน/กลุ่ม — ใช้ `messages` collection เดียว
- ห้ามลบ ClawTeam — เป็นแกนหลักของระบบ
