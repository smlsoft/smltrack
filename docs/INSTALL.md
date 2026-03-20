# SMLTrack — คู่มือติดตั้งบน Docker Desktop

> คู่มือสำหรับติดตั้งระบบ SMLTrack (AI Chat Intelligence) บนเครื่องใหม่

---

## สิ่งที่ต้องเตรียมก่อนเริ่ม

### Software ที่ต้องติดตั้ง

| ลำดับ | Software | คู่มือ |
|-------|----------|--------|
| 1 | **Docker Desktop** | [setup-docker.md](setup-docker.md) |
| 2 | **Git** | https://git-scm.com/downloads |

> หลังติดตั้ง Docker Desktop → เปิดโปรแกรม → รอจนสถานะเป็น "Running" (ไอคอนสีเขียว)

### บริการที่ต้องสมัคร — คู่มือแยกแต่ละตัว

| บริการ | คู่มือ | หมายเหตุ |
|--------|--------|----------|
| Docker Desktop | [setup-docker.md](setup-docker.md) | รัน containers ทั้งระบบ |
| MongoDB Atlas | [setup-mongodb.md](setup-mongodb.md) | ฐานข้อมูล (ฟรี M0) |
| LINE Messaging API | [setup-line.md](setup-line.md) | เชื่อม LINE OA |
| AI Providers | [setup-ai-providers.md](setup-ai-providers.md) | SambaNova, Groq, Cerebras, OpenRouter, Google (ฟรีทั้งหมด) |
| **ClawTeam** | [setup-clawteam.md](setup-clawteam.md) | **AI Advisor แกนหลัก** — multi-agent วิเคราะห์แชททุก 1 ชม. |
| Cloudflare Tunnel | [setup-cloudflare-tunnel.md](setup-cloudflare-tunnel.md) | เปิดให้เข้าจาก Internet (ฟรี) |
| MCP ERP | ขอจากผู้ดูแลระบบ | เชื่อม ERP (ถ้าใช้) |

### API Keys ที่ต้องเตรียม

| Key | ได้จาก | หมายเหตุ |
|-----|--------|----------|
| `MONGODB_URI` | [setup-mongodb.md](setup-mongodb.md) | MongoDB connection string |
| `LINE_CHANNEL_ACCESS_TOKEN` | [setup-line.md](setup-line.md) | LINE Messaging API |
| `LINE_CHANNEL_SECRET` | [setup-line.md](setup-line.md) | LINE Messaging API |
| `SAMBANOVA_API_KEY` | [setup-ai-providers.md](setup-ai-providers.md) | AI Provider (ฟรี) |
| `GROQ_API_KEY` | [setup-ai-providers.md](setup-ai-providers.md) | AI Provider (ฟรี) |
| `CEREBRAS_API_KEY` | [setup-ai-providers.md](setup-ai-providers.md) | AI Provider (ฟรี) |
| `OPENROUTER_API_KEY` | [setup-ai-providers.md](setup-ai-providers.md) | AI Provider (ฟรี) |
| `GOOGLE_API_KEY` | [setup-ai-providers.md](setup-ai-providers.md) | Gemini Vision (ฟรี) |
| `MCP_ERP_API_KEY` | ผู้ดูแลระบบ | เชื่อม ERP (ถ้าใช้) |
| `AI_MODEL` | [setup-clawteam.md](setup-clawteam.md) | AI model สำหรับ ClawTeam (default: qwen3-235b) |
| `CLOUDFLARE_TUNNEL_TOKEN` | [setup-cloudflare-tunnel.md](setup-cloudflare-tunnel.md) | Cloudflare Tunnel |
| `CONFIG_PASSWORD` | ตั้งเอง | รหัสเข้าหน้า Config บน Dashboard |

---

## ขั้นตอนติดตั้ง

### Step 1 — Clone โปรเจค

เปิด Terminal (Command Prompt / PowerShell / Git Bash) แล้วรัน:

```bash
git clone https://github.com/smlsoft/smltrack.git
cd smltrack
```

### Step 2 — สร้างไฟล์ `.env`

สร้างไฟล์ชื่อ `.env` ที่ root ของโปรเจค (อยู่ข้าง docker-compose.yml):

```bash
# Windows (PowerShell)
copy .env.example .env

# หรือสร้างเองด้วย Notepad
notepad .env
```

ใส่เนื้อหาตามนี้ (เปลี่ยน `<...>` เป็นค่าจริง):

```env
# === MongoDB Atlas ===
MONGODB_URI=<ขอจากผู้ดูแลระบบ>

# === LINE Messaging API ===
LINE_CHANNEL_ACCESS_TOKEN=<ขอจากผู้ดูแลระบบ>
LINE_CHANNEL_SECRET=<ขอจากผู้ดูแลระบบ>

# === AI Providers (สมัครฟรี) ===
SAMBANOVA_API_KEY=<สมัครที่ cloud.sambanova.ai>
GROQ_API_KEY=<สมัครที่ console.groq.com>
CEREBRAS_API_KEY=<สมัครที่ cloud.cerebras.ai>
OPENROUTER_API_KEY=<สมัครที่ openrouter.ai>
GOOGLE_API_KEY=<สมัครที่ aistudio.google.com>

# === ClawTeam AI Advisor (ใช้ OPENROUTER_API_KEY ตัวเดียวกัน) ===
AI_MODEL=qwen/qwen3-235b-a22b

# === MCP ERP (เชื่อม ERP — ถ้าไม่ใช้ให้เว้นว่าง) ===
MCP_ERP_API_KEY=<ขอจากผู้ดูแลระบบ>

# === Cloudflare Tunnel ===
CLOUDFLARE_TUNNEL_TOKEN=<ขอจากผู้ดูแลระบบ>

# === Dashboard ===
CONFIG_PASSWORD=<ตั้งรหัสเอง>
```

> **สำคัญ:** ไฟล์ `.env` จะไม่ถูก push ขึ้น Git (อยู่ใน .gitignore แล้ว)

### Step 3 — Build & Run

```bash
docker compose up -d --build
```

> ครั้งแรกใช้เวลาประมาณ 2-5 นาที (ต้อง download images + build Next.js)

### Step 4 — ตรวจสอบว่ารันสำเร็จ

```bash
docker compose ps
```

ผลที่ต้องเห็น — **4 containers** สถานะ **running**:

```
NAME                  STATUS
smltrack-clawteam     Up (healthy)    ← AI Advisor (แกนหลัก)
smltrack-agent        Up (healthy)
smltrack-dashboard    Up
smltrack-tunnel       Up
```

### Step 5 — ทดสอบเข้าใช้งาน

| ทดสอบ | URL | ผลที่ควรได้ |
|-------|-----|------------|
| Agent ทำงาน | http://localhost:3000/ | แสดงข้อความ OK |
| Dashboard | http://localhost:3002/dashboard | เห็นหน้า Dashboard |
| CRM | http://localhost:3002/dashboard/crm | เห็นหน้า CRM |
| ผ่าน Internet | https://smlclaw.satistang.com/dashboard | เข้าได้จากข้างนอก |

---

## Architecture (ภาพรวมระบบ)

```
LINE OA
  │
  ▼
Cloudflare Tunnel (smlclaw.satistang.com)
  │
  ▼
┌──────────────────── Docker Desktop ────────────────────┐
│                                                         │
│  ┌──────────────────┐                                   │
│  │  ClawTeam         │  ← AI Advisor (แกนหลัก)          │
│  │  Port: 8080       │  ← multi-agent ทุก 1 ชม.        │
│  │  - 3 AI agents    │  ← cost tracking                │
│  └────────┬─────────┘                                   │
│           │ API                                          │
│           ▼                                              │
│  ┌─────────────────┐   ┌──────────────────┐             │
│  │  agent (proxy/)  │   │  dashboard       │             │
│  │  Node.js         │   │  Next.js         │             │
│  │  Port: 3000      │   │  Port: 3001      │             │
│  │                  │   │  (host: 3002)    │             │
│  │  - LINE webhook  │◄──│                  │             │
│  │  - AI + RAG      │   │  - แสดงแชท       │             │
│  │  - MCP ERP tools │   │  - CRM / KPI     │             │
│  │  - Advisor API   │   │  - Advice / Cost  │             │
│  └────────┬─────────┘   └──────────────────┘             │
│           │                                              │
│  ┌────────┴─────────┐                                    │
│  │  tunnel           │──► Internet                       │
│  └──────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
            │
            ▼
      MongoDB Atlas (Cloud)
```

| Container | Folder | Port (เครื่อง) | หน้าที่ |
|-----------|--------|---------------|---------|
| smltrack-clawteam | `clawteam/` | 8080 | **AI Advisor** — multi-agent, cron ทุก 1 ชม., cost tracking |
| smltrack-agent | `proxy/` | 3000 | LINE webhook, AI chatbot, RAG, MCP, Advisor API |
| smltrack-dashboard | `smltrackdashboard/` | 3002 | Web Dashboard (แชท, CRM, KPI, Advice, Cost) |
| smltrack-tunnel | cloudflare image | — | เปิดให้เข้าจาก Internet |

---

## คำสั่งที่ใช้บ่อย

### เปิด/ปิด

```bash
# เปิดทั้งหมด
docker compose up -d --build

# ปิดทั้งหมด
docker compose down

# Restart เฉพาะ agent (เช่น แก้โค้ดแล้ว)
docker compose up -d --build agent

# Restart เฉพาะ dashboard
docker compose up -d --build dashboard
```

### ดู Logs

```bash
# ดูทั้งหมด (กด Ctrl+C หยุด)
docker compose logs -f

# ดูเฉพาะ agent
docker compose logs agent -f

# ดูเฉพาะ dashboard
docker compose logs dashboard -f

# ดูเฉพาะ tunnel
docker compose logs tunnel -f
```

### เข้าไปใน Container

```bash
# เข้า agent
docker exec -it smltrack-agent sh

# เข้า dashboard
docker exec -it smltrack-dashboard sh
```

### อัพเดทโค้ดใหม่

```bash
git pull
docker compose up -d --build
```

---

## แก้ปัญหา (Troubleshooting)

### Agent ไม่ start / ค้างที่ "restarting"

```bash
docker compose logs agent
```

สาเหตุที่พบบ่อย:
- `.env` ไม่มี หรือ path ผิด → ตรวจว่าไฟล์ `.env` อยู่ข้าง `docker-compose.yml`
- `MONGODB_URI` ผิด → ตรวจ connection string กับผู้ดูแลระบบ
- MongoDB Atlas ไม่ whitelist IP → เข้า Atlas → Network Access → Add Current IP

### Dashboard แสดง 502 / ไม่ขึ้น

```bash
docker compose logs dashboard
```

สาเหตุที่พบบ่อย:
- Build ยังไม่เสร็จ → รอ 1-2 นาทีแล้วลองใหม่
- Port 3002 ถูกใช้ → เปลี่ยน port ใน docker-compose.yml: `"3003:3001"`

### Tunnel ไม่ connect

```bash
docker compose logs tunnel
```

สาเหตุที่พบบ่อย:
- `CLOUDFLARE_TUNNEL_TOKEN` ผิด → ขอ token ใหม่จากผู้ดูแลระบบ
- Firewall บล็อก → อนุญาต Docker Desktop ผ่าน Firewall

### LINE ส่งข้อความแล้วไม่ตอบ

ตรวจตามลำดับ:
1. `docker compose ps` → agent ต้อง running
2. `docker compose logs agent -f` → ส่งข้อความแล้วดูว่า log ขึ้นมั้ย
3. ถ้าไม่มี log → Webhook URL ผิด (ตรวจที่ LINE Developers Console)
4. ถ้ามี log แต่ error → ดู error message แล้วแจ้งผู้ดูแลระบบ

### MCP/ERP ไม่ทำงาน

- ต้องมี bc-erp server รันอยู่ที่เครื่อง (port 8888)
- Docker ใช้ `host.docker.internal` เพื่อเข้าถึงเครื่อง host
- ทดสอบ: `curl http://localhost:8888/goapi/mcp/sse` ต้องตอบกลับ

### Port ชนกับโปรแกรมอื่น

แก้ port ใน `docker-compose.yml`:

```yaml
# เปลี่ยนจาก
ports:
  - "3000:3000"   # agent
  - "3002:3001"   # dashboard

# เป็น (ตัวอย่าง)
ports:
  - "4000:3000"   # agent → เข้าที่ localhost:4000
  - "4002:3001"   # dashboard → เข้าที่ localhost:4002
```

---

## MongoDB Atlas — Whitelist IP

ถ้า Agent connect MongoDB ไม่ได้ ต้อง whitelist IP เครื่อง:

1. เข้า https://cloud.mongodb.com/
2. เลือก Cluster → **Network Access**
3. กด **Add IP Address**
4. เลือก **Allow Access from Anywhere** (`0.0.0.0/0`) หรือใส่ IP เครื่อง
5. กด **Confirm**
6. รอ 1-2 นาที แล้ว restart: `docker compose restart agent`

---

## สรุปขั้นตอน (Quick Checklist)

- [ ] ติดตั้ง Docker Desktop แล้วเปิดใช้งาน
- [ ] ติดตั้ง Git
- [ ] `git clone https://github.com/smlsoft/smltrack.git`
- [ ] `cd smltrack`
- [ ] สร้างไฟล์ `.env` พร้อมใส่ค่าทั้งหมด (ขอจากผู้ดูแลระบบ)
- [ ] `docker compose up -d --build`
- [ ] `docker compose ps` → 4 containers running
- [ ] ทดสอบ http://localhost:8080/ → ClawTeam Board
- [ ] ทดสอบ http://localhost:3000/ → Agent OK
- [ ] ทดสอบ http://localhost:3002/dashboard → เห็น Dashboard
- [ ] ทดสอบส่งข้อความ LINE → บอทตอบ
- [ ] ClawTeam cron ทำงาน → ดู [setup-clawteam.md](setup-clawteam.md)

---

## ติดต่อผู้ดูแลระบบ

หากติดปัญหาที่แก้ไม่ได้ ให้แจ้งพร้อม:
1. ผลจาก `docker compose ps`
2. ผลจาก `docker compose logs <service-name>` (copy error message)
3. ระบบปฏิบัติการ + เวอร์ชัน Docker Desktop
