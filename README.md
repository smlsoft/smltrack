# SMLTrack — AI Chat Intelligence for LINE OA

> ระบบ AI วิเคราะห์แชทอัจฉริยะ สำหรับธุรกิจที่ใช้ LINE OA
> ฟังทุกห้อง วิเคราะห์ทุกข้อความ แนะนำทุกโอกาส — อัตโนมัติ 100%

---

## SMLTrack ทำอะไรได้?

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

### น้องกุ้ง — AI Advisor (ClawTeam Multi-Agent)

**วิเคราะห์ข้อมูลทุกห้อง ทุก 1 ชั่วโมง ด้วย 3 AI agents พร้อมกัน:**

| Agent | หน้าที่ | ผลลัพธ์ |
|-------|---------|---------|
| **Sentiment Agent** | วิเคราะห์ความพอใจ + ตอบช้า | critical / warning alerts |
| **Pipeline Agent** | วิเคราะห์โอกาสขาย | opportunity แนะนำ |
| **Summary Agent** | สรุปภาพรวม | สถิติ + trend |

ประหยัด token เพราะแยก prompt เล็กๆ 3 ชุด แทนส่งทีเดียวทั้งก้อน

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
- ราคาโดยประมาณเป็น THB (x34)

---

### Vision AI — อ่านรูปเป็นข้อความ

ลูกค้าส่งรูปเข้ามา → AI วิเคราะห์และบรรยายเป็นภาษาไทยอัตโนมัติ
→ เก็บคำอธิบายลง Database → ค้นหาได้ + นำไปวิเคราะห์ต่อ

---

### ตรวจจับตอบช้า

- ลูกค้าส่งข้อความ → พนักงานยังไม่ตอบ → ระบบเตือน
- เร็ว (< 5 นาที) / กลาง (5-30 นาที) / ช้า (> 30 นาที)
- แสดง alert banner บน Dashboard ทันที

---

### CRM อัตโนมัติจากแชท

- สร้างจากแชทอัตโนมัติ — ไม่ต้องกรอกเอง
- ดึง LINE profile (รูป, ชื่อ) อัตโนมัติ
- บันทึก sentiment, โอกาสซื้อ, tags, pipeline ต่อลูกค้า
- แก้ไขข้อมูลเพิ่มเติมได้ (บริษัท, เบอร์, email, หมายเหตุ)

---

### เชื่อม ERP ผ่าน MCP

เชื่อมต่อ bc-erp MCP Server → 61 tools:
เช็คสต็อก, ยอดขาย, KPI, ลูกหนี้/เจ้าหนี้, สินค้าขายดี

---

### RAG — จำแชทเก่าได้

1. **Vector Search** (ค้นตามความหมาย)
2. **Keyword Search** (ค้นตามคำ)
3. **Recent Messages** (ข้อความล่าสุด)

---

## Architecture

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
│  │  ClawTeam         │  ← AI Advisor (แกนหลัก)         │
│  │  Python + Cron    │  ← multi-agent ทุก 1 ชม.        │
│  │  Port: 8080       │  ← cost tracking                 │
│  └────────┬─────────┘                                   │
│           │ API                                          │
│           ▼                                              │
│  ┌─────────────────┐   ┌──────────────────┐             │
│  │  Agent (proxy/)  │   │  Dashboard       │             │
│  │  Node.js         │   │  Next.js         │             │
│  │  Port: 3000      │   │  Port: 3001      │             │
│  │                  │   │  (host: 3002)    │             │
│  │  - LINE webhook  │◄──│                  │             │
│  │  - AI + RAG      │   │  - แชท iPhone    │             │
│  │  - MCP ERP       │   │  - CRM / KPI     │             │
│  │  - Cost tracking │   │  - Advice / Cost  │             │
│  └────────┬─────────┘   └──────────────────┘             │
│           │                                              │
│  ┌────────┴─────────┐                                    │
│  │  Cloudflare       │──► Internet                       │
│  │  Tunnel           │                                   │
│  └──────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
            │
            ▼
      MongoDB Atlas (Cloud)
```

| Container | Folder | Port | หน้าที่ |
|-----------|--------|------|---------|
| smltrack-clawteam | `clawteam/` | 8080 | AI Advisor — multi-agent, cron, cost tracking |
| smltrack-agent | `proxy/` | 3000 | LINE webhook, AI chatbot, RAG, MCP, APIs |
| smltrack-dashboard | `smltrackdashboard/` | 3002 | Web Dashboard (แชท, CRM, KPI, Advice, Cost) |
| smltrack-tunnel | cloudflared | — | เปิดให้เข้าจาก Internet |

---

## AI ที่ใช้

### Agent (LINE reply — ฟรีทั้งหมด)

```
OpenRouter Nemotron (free)
  ↓ fail → OpenRouter Llama 3.3-70B (free)
    ↓ fail → OpenRouter Trinity (free)
      ↓ fail → SambaNova (Qwen3-235B)
        ↓ fail → Groq (Llama 3.3-70B)
          ↓ fail → Cerebras (Qwen3-235B)
            ↓ fail → Gemini Flash
```

ตัวไหน rate limit → cooldown 30 นาทีแล้วข้ามทันที

### ClawTeam Advisor (ทุก 1 ชม.)

OpenRouter Qwen3-235B-A22B (ตั้งผ่าน `AI_MODEL` env var)

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
# 1. Clone
git clone https://github.com/smlsoft/smltrack.git
cd smltrack

# 2. สร้าง .env
copy .env.example .env
# แก้ไขค่าใน .env (ดู docs/INSTALL.md)

# 3. Run
docker compose up -d --build

# 4. เข้าใช้งาน
# Dashboard: http://localhost:3002/dashboard
# Agent:     http://localhost:3000/
# ClawTeam:  http://localhost:8080/
```

ดูคู่มือติดตั้งแบบละเอียด → [docs/INSTALL.md](docs/INSTALL.md)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Advisor | Python + ClawTeam (multi-agent swarm) |
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
| [คู่มือติดตั้ง (INSTALL.md)](docs/INSTALL.md) | ติดตั้งทั้งระบบบน Docker Desktop |
| [Docker Desktop](docs/setup-docker.md) | ติดตั้ง Docker Desktop |
| [MongoDB Atlas](docs/setup-mongodb.md) | สมัคร MongoDB Atlas (ฟรี) |
| [LINE Messaging API](docs/setup-line.md) | สร้าง LINE Channel |
| [AI Providers](docs/setup-ai-providers.md) | สมัคร AI Providers (ฟรีทั้งหมด) |
| [Cloudflare Tunnel](docs/setup-cloudflare-tunnel.md) | ตั้งค่า Cloudflare Tunnel (ฟรี) |
| [ClawTeam Advisor](docs/setup-clawteam.md) | ตั้งค่า AI Advisor + Cost Tracking |
