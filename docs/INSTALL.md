# OpenClaw Mini CRM — คู่มือติดตั้งบน Docker Desktop

> คู่มือสำหรับติดตั้งระบบ OpenClaw Mini CRM (AI Chat Intelligence) บนเครื่องใหม่

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
| `OPENCLAW_GATEWAY_TOKEN` | สร้างเอง | Token สำหรับ OpenClaw |
| `CLOUDFLARE_TUNNEL_TOKEN` | [setup-cloudflare-tunnel.md](setup-cloudflare-tunnel.md) | Cloudflare Tunnel |
| `CONFIG_PASSWORD` | ตั้งเอง | รหัสเข้าหน้า Config บน Dashboard |

---

## ขั้นตอนติดตั้ง

### Step 1 — Clone โปรเจค

```bash
git clone https://github.com/smlsoft/smltrack.git
cd smltrack
```

### Step 2 — สร้างไฟล์ `.env`

```bash
# Windows (PowerShell)
copy .env.example .env
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

# === OpenClaw AI Advisor ===
OPENCLAW_GATEWAY_TOKEN=<สร้างด้วย: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))">

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
smltrack-openclaw     Up (healthy)    <- AI Advisor (แกนหลัก)
smltrack-agent        Up (healthy)
smltrack-dashboard    Up
smltrack-tunnel       Up
```

### Step 5 — ทดสอบเข้าใช้งาน

| ทดสอบ | URL | ผลที่ควรได้ |
|-------|-----|------------|
| Agent ทำงาน | http://localhost:3000/ | แสดงข้อความ OK |
| OpenClaw | http://localhost:18789/ | Control UI |
| Dashboard | http://localhost:3002/dashboard | เห็นหน้า Dashboard |
| ผ่าน Internet | https://smlclaw.satistang.com/dashboard | เข้าได้จากข้างนอก |

---

## Architecture (ภาพรวมระบบ)

```
LINE OA
  |
  v
Cloudflare Tunnel (smlclaw.satistang.com)
  |
  v
+------------------ Docker Desktop --------------------+
|                                                       |
|  +-----------------+                                  |
|  |  OpenClaw        |  <- AI Advisor (แกนหลัก)        |
|  |  Port: 18789     |  <- cron ทุก 1 ชม.             |
|  |  - AI Gateway    |  <- cost tracking              |
|  +--------+---------+                                 |
|           | curl API                                  |
|           v                                           |
|  +-----------------+   +------------------+           |
|  |  agent (proxy/) |   |  dashboard       |           |
|  |  Node.js        |   |  Next.js         |           |
|  |  Port: 3000     |   |  Port: 3001      |           |
|  |                 |   |  (host: 3002)    |           |
|  |  - LINE webhook |<--|                  |           |
|  |  - AI + RAG     |   |  - แสดงแชท       |           |
|  |  - MCP ERP      |   |  - CRM / KPI     |           |
|  |  - Advisor API  |   |  - Advice / Cost  |           |
|  +--------+--------+   +------------------+           |
|           |                                           |
|  +--------+--------+                                  |
|  |  tunnel          |-> Internet                      |
|  +-----------------+                                  |
+-------------------------------------------------------+
            |
            v
      MongoDB Atlas (Cloud)
```

| Container | Folder | Port | หน้าที่ |
|-----------|--------|------|---------|
| smltrack-openclaw | `openclaw/` | 18789 | **AI Advisor** — cron ทุก 1 ชม., cost tracking |
| smltrack-agent | `proxy/` | 3000 | LINE webhook, AI chatbot, RAG, MCP, Advisor API |
| smltrack-dashboard | `smltrackdashboard/` | 3002 | Web Dashboard (แชท, CRM, KPI, Advice, Cost) |
| smltrack-tunnel | cloudflare image | — | เปิดให้เข้าจาก Internet |

---

## คำสั่งที่ใช้บ่อย

```bash
# เปิดทั้งหมด
docker compose up -d --build

# ปิดทั้งหมด
docker compose down

# Restart เฉพาะ service
docker compose up -d --build agent
docker compose up -d --build dashboard
docker compose restart openclaw

# ดู Logs
docker compose logs -f              # ทั้งหมด
docker compose logs agent -f        # agent
docker compose logs openclaw -f     # OpenClaw
docker compose logs dashboard -f    # dashboard

# อัพเดทโค้ดใหม่
git pull
docker compose up -d --build
```

---

## สรุปขั้นตอน (Quick Checklist)

- [ ] ติดตั้ง Docker Desktop แล้วเปิดใช้งาน
- [ ] ติดตั้ง Git
- [ ] `git clone https://github.com/smlsoft/smltrack.git`
- [ ] `cd smltrack`
- [ ] สร้างไฟล์ `.env` พร้อมใส่ค่าทั้งหมด
- [ ] `docker compose up -d --build`
- [ ] `docker compose ps` → 4 containers running
- [ ] ทดสอบ http://localhost:18789/ → OpenClaw Control UI
- [ ] ทดสอบ http://localhost:3000/ → Agent OK
- [ ] ทดสอบ http://localhost:3002/dashboard → เห็น Dashboard
- [ ] ทดสอบส่งข้อความ LINE → บอทตอบ
