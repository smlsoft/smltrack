# OpenClaw Mini CRM — AI Chat Intelligence for LINE OA

> ระบบ AI วิเคราะห์แชทอัจฉริยะ สำหรับธุรกิจที่ใช้ LINE OA
> ฟังทุกห้อง วิเคราะห์ทุกข้อความ แนะนำทุกโอกาส — อัตโนมัติ 100%

---

## OpenClaw Mini CRM ทำอะไรได้?

### ฟังทุกแชท วิเคราะห์ทุกข้อความ

- เชื่อมต่อ LINE OA → ฟังข้อความจากทุกกลุ่มและแชทส่วนตัว real-time
- **ทุกข้อความ** ที่เข้ามา → AI วิเคราะห์อัตโนมัติทันที:

| วิเคราะห์ | ผลลัพธ์ | ตัวอย่าง |
|-----------|---------|---------|
| ความพอใจลูกค้า | ปกติ / ติดตาม / ไม่พอใจ | "ลูกค้าเริ่มไม่พอใจเรื่องจัดส่งช้า" |
| โอกาสซื้อ | ไม่สนใจ / เริ่มสนใจ / สนใจซื้อ! | "ลูกค้าถามราคาและขอใบเสนอราคา" |
| แท็กอัตโนมัติ | tags | ถามราคา, สนใจสินค้า, ร้องเรียน, นัดหมาย |
| Sales Pipeline | stages | new → interested → quoting → negotiating → closed |

---

### น้องกุ้ง — AI Advisor (OpenClaw)

**วิเคราะห์ข้อมูลทุกห้อง ทุก 1 ชั่วโมง ผ่าน OpenClaw AI Gateway:**

- ดึงแชทใหม่จาก Agent API → วิเคราะห์ด้วย AI → เก็บ advice ใน MongoDB
- เฉพาะ sources ที่มีการเปลี่ยนแปลง (ประหยัด token)
- CRM analysis ทุก 6 ชม. (follow-up, ลูกค้าหลุด)
- รองรับ 20+ messaging channels (Telegram, LINE, Slack, etc.)

| Priority | เมื่อไหร่ | ตัวอย่าง |
|----------|---------|---------|
| **Critical** | ลูกค้าไม่พอใจ / ตอบช้ามาก | "ลูกค้า X ร้องเรียน ควรโทรติดตามทันที" |
| **Warning** | sentiment เริ่มแย่ | "ห้อง Y ลูกค้าเริ่มไม่พอใจ ควรเข้าไปดูแล" |
| **Opportunity** | โอกาสขายสูง | "ลูกค้า Z สนใจซื้อมาก ควรเสนอราคา" |
| **Info** | สถิติทั่วไป | "วันนี้มี 150 ข้อความ ห้อง A คุยเยอะสุด" |

---

### KPI พนักงาน — ใครทำงาน ใครไม่ทำ

| KPI | วัดจาก |
|-----|-------|
| **เวลาตอบเฉลี่ย** | ข้อความลูกค้า → พนักงานตอบ (เร็ว/กลาง/ช้า) |
| **จำนวนลูกค้าที่ดูแล** | นับ sourceId ที่มี interaction |
| **อัตราปิดการขาย** | pipeline สนใจ → ปิดได้ / ปิดทั้งหมด |
| **ลูกค้าหลุด** | เคยคุยแล้วหายไป > 7 วัน |
| **เสี่ยงหลุด** | ไม่มีข้อความ 3-7 วัน |

---

### AI Cost Tracker — ดูค่าใช้จ่าย AI แบบละเอียด

- ทุก AI call ถูก track: provider, model, feature, tokens, cost
- แสดงผลใน Dashboard: วันนี้ / เดือนนี้ / แยกฟีเจอร์ / แยก provider
- ราคาโดยประมาณเป็น THB

---

### อื่นๆ

- **Vision AI** — ส่งรูป → AI บรรยายเป็นภาษาไทย
- **ตรวจจับตอบช้า** — alert เมื่อพนักงานตอบช้า > 30 นาที
- **CRM อัตโนมัติ** — สร้างจากแชท ไม่ต้องกรอกเอง
- **RAG** — จำแชทเก่าได้ (Vector + Keyword + Recent)
- **MCP ERP** — เชื่อม ERP 61 tools (สต็อก, ยอดขาย, KPI)

---

## Architecture

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
|  +--------+---------+                                 |
|           | curl API                                  |
|           v                                           |
|  +-----------------+   +------------------+           |
|  |  Agent (proxy/) |   |  Dashboard       |           |
|  |  Node.js        |   |  Next.js         |           |
|  |  Port: 3000     |   |  Port: 3002      |           |
|  |  - LINE webhook |<--|  - แชท iPhone    |           |
|  |  - AI + RAG     |   |  - CRM / KPI     |           |
|  |  - MCP ERP      |   |  - Advice / Cost  |           |
|  +--------+---------+  +------------------+           |
|           |                                           |
|  +--------+---------+                                 |
|  |  Cloudflare       |-> Internet                     |
|  +-------------------+                                |
+-------------------------------------------------------+
            |
            v
      MongoDB Atlas (Cloud)
```

| Container | Folder | Port | หน้าที่ |
|-----------|--------|------|---------|
| smltrack-openclaw | `openclaw/` | 18789 | AI Advisor — cron, cost tracking |
| smltrack-agent | `proxy/` | 3000 | LINE webhook, AI chatbot, RAG, MCP |
| smltrack-dashboard | `smltrackdashboard/` | 3002 | Web Dashboard |
| smltrack-tunnel | cloudflared | — | เปิดให้เข้าจาก Internet |

---

## AI ที่ใช้ (ฟรีทั้งหมด)

```
OpenRouter Nemotron (free)
  -> OpenRouter Llama 3.3-70B (free)
    -> OpenRouter Trinity (free)
      -> SambaNova (Qwen3-235B)
        -> Groq (Llama 3.3-70B)
          -> Cerebras (Qwen3-235B)
            -> Gemini Flash
```

ตัวไหน rate limit → cooldown 30 นาทีแล้วข้ามทันที

---

## Dashboard

| หน้า | URL | หน้าที่ |
|------|-----|---------|
| หน้าหลัก | `/dashboard` | แชทแบบ iPhone + filters |
| CRM | `/dashboard/crm` | ข้อมูลลูกค้า + pipeline |
| KPI | `/dashboard/kpi` | พนักงาน + ปิดการขาย + ลูกค้าหลุด |
| น้องกุ้ง | `/dashboard/advice` | คำแนะนำ AI ทุก 1 ชม. |
| AI Cost | `/dashboard/costs` | ค่าใช้จ่าย AI แบบละเอียด |
| Config | `/dashboard/config` | ตั้งค่าระบบ |

---

## Quick Start

```bash
git clone https://github.com/smlsoft/smltrack.git
cd smltrack
copy .env.example .env
# แก้ไขค่าใน .env (ดู docs/INSTALL.md)
docker compose up -d --build
# เข้า: http://localhost:3002/dashboard
```

ดูคู่มือติดตั้งแบบละเอียด → [docs/INSTALL.md](docs/INSTALL.md)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Advisor | OpenClaw (AI Gateway + Cron) |
| AI Agent | Node.js + Express |
| Dashboard | Next.js + Tailwind CSS |
| Database | MongoDB Atlas (Free M0) |
| Tunnel | Cloudflare Named Tunnel |
| Deploy | Docker Desktop (ทุก service) |
| AI | OpenRouter / SambaNova / Groq / Cerebras / Gemini |
| ERP | bc-erp MCP Server (SSE) |

---

## เอกสารเพิ่มเติม

| เอกสาร | เนื้อหา |
|--------|---------|
| [คู่มือติดตั้ง](docs/INSTALL.md) | ติดตั้งทั้งระบบบน Docker Desktop |
| [Docker Desktop](docs/setup-docker.md) | ติดตั้ง Docker Desktop |
| [MongoDB Atlas](docs/setup-mongodb.md) | สมัคร MongoDB Atlas (ฟรี) |
| [LINE Messaging API](docs/setup-line.md) | สร้าง LINE Channel |
| [AI Providers](docs/setup-ai-providers.md) | สมัคร AI Providers (ฟรีทั้งหมด) |
| [Cloudflare Tunnel](docs/setup-cloudflare-tunnel.md) | ตั้งค่า Cloudflare Tunnel (ฟรี) |
