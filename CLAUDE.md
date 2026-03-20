# SMLTrack Project Rules

## Architecture
```
LINE → Cloudflare Tunnel → Agent (Docker) → AI + RAG + MCP → LINE reply
                                  ↓
                            MongoDB Atlas (messages collection เดียว)
                                  ↓
                            Dashboard (Railway) → แสดงสนทนา + analytics
```

## Services
| Service | Deploy | Port | Folder |
|---------|--------|------|--------|
| **Agent** | Docker Desktop + Cloudflare Tunnel | 3000 | `proxy/` |
| **Dashboard** | Railway | 3000 | `smltrackdashboard/` |

## URLs
- **LINE webhook:** `https://smlclaw.satistang.com/webhook`
- **Dashboard:** `https://chat-production-fedc.up.railway.app`
- **Agent health:** `http://localhost:3000/`

## Deploy Rules
- **Agent (proxy/):** `docker compose up -d --build agent` (local Docker Desktop)
- **Dashboard (smltrackdashboard/):** `cd smltrackdashboard && railway up` (Railway)
- **อย่า deploy agent ขึ้น Railway** — รันบน Docker Desktop เท่านั้น
- **อย่าลบ service/folder โดยไม่ถามบอสก่อน**

## AI Providers (ฟรีทั้งหมด, fallback chain)
1. SambaNova (Qwen3-235B) → 2. Groq (llama-3.3-70b) → 3. Cerebras → 4. OpenRouter

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

## MCP
- **bc-erp MCP server:** `http://host.docker.internal:8888/goapi/mcp/sse`
- Transport: SSE (response ส่งกลับทาง SSE stream ไม่ใช่ HTTP response)
- 61 tools: สินค้า, ยอดขาย, KPI, ลูกหนี้/เจ้าหนี้, สต็อก ฯลฯ

## น้องปู (AI Personality)
- เป็น **เลขาส่วนตัว** (ไม่ใช่คลินิก ไม่ใช่ร้าน)
- ตอบภาษาไทย สุภาพ เป็นกันเอง มีมุขตลก
- ห้ามบอกว่าเป็น AI/chatbot

## Env vars (.env)
- `MONGODB_URI` — MongoDB Atlas connection
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`
- `SAMBANOVA_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`
- `MCP_ERP_API_KEY` — bc-erp MCP auth
- `CLOUDFLARE_TUNNEL_TOKEN` — named tunnel token

## สิ่งที่ห้ามทำ
- ห้ามลบ folder/service โดยไม่ถามบอสก่อน
- ห้ามเปลี่ยน deploy strategy โดยไม่แจ้ง (agent = Docker, dashboard = Railway)
- ห้ามใช้ OpenClaw — ลบออกแล้ว ใช้ All-in-One Agent แทน
- ห้ามแยก MongoDB collection ตามคน/กลุ่ม — ใช้ `messages` collection เดียว
