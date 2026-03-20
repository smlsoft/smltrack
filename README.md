# OpenClaw 🦐 — AI-Powered Chat Intelligence

> ระบบ AI วิเคราะห์แชทอัจฉริยะ สำหรับธุรกิจที่ใช้ LINE OA
> ฟังทุกห้อง วิเคราะห์ทุกข้อความ แนะนำทุกโอกาส — อัตโนมัติ 100%

---

## OpenClaw ทำอะไรได้บ้าง?

### 🔍 ฟังทุกแชท วิเคราะห์ทุกข้อความ

- เชื่อมต่อ LINE OA → ฟังข้อความจากทุกกลุ่มและแชทส่วนตัวแบบ real-time
- **ทุกข้อความ** ที่เข้ามา → AI วิเคราะห์อัตโนมัติทันที:

| วิเคราะห์อะไร | ผลลัพธ์ | ตัวอย่าง |
|---------------|---------|---------|
| ความพึงพอใจลูกค้า | 🟢 ปกติ / 🟡 ติดตาม / 🔴 ไม่พอใจ | "ลูกค้าเริ่มไม่พอใจเรื่องจัดส่งช้า" |
| โอกาสซื้อ | 🟢 ไม่สนใจ / 🟡 เริ่มสนใจ / 🔴 สนใจซื้อ! | "ลูกค้าถามราคาและขอใบเสนอราคา" |
| แท็กอัตโนมัติ | auto-tagging | ถามราคา, สนใจสินค้า, ร้องเรียน, นัดหมาย |
| สถานะ Pipeline | CRM pipeline | new → interested → quoting → negotiating → closed |

---

### 🦐 น้องกุ้ง — AI Advisor ประจำธุรกิจ

**วิเคราะห์ข้อมูลทุกห้อง ทุก 1 ชั่วโมง แล้วให้คำแนะนำที่ทำได้จริง**

| Priority | หมายถึง | ตัวอย่างคำแนะนำ |
|----------|---------|----------------|
| 🔴 **Critical** | ต้องจัดการด่วน | "ลูกค้า X ไม่พอใจเรื่องสินค้า ควรโทรติดตามทันที" |
| 🟡 **Warning** | ควรติดตาม | "ห้อง Y sentiment เริ่มแย่ลง ควรเข้าไปดูแล" |
| 🟢 **Opportunity** | โอกาสขาย | "ลูกค้า Z สนใจซื้อมาก ควรเสนอราคาและปิดการขาย" |
| 🔵 **Info** | ข้อมูลทั่วไป | "วันนี้มี 150 ข้อความ ห้อง A คุยเยอะสุด" |

- เก็บประวัติคำแนะนำ → ย้อนดูได้
- กดรีเฟรช manual ได้ทันที
- ดูได้ที่ Dashboard หน้า **น้องกุ้ง**

---

### 👁️ Vision AI — อ่านรูปเป็นข้อความ

- ลูกค้าส่งรูปเข้ามา → AI วิเคราะห์และบรรยายเป็นภาษาไทยอัตโนมัติ
- เก็บคำอธิบายลง Database → ค้นหาได้ + นำไปวิเคราะห์ต่อได้
- ตัวอย่าง: ส่งรูปอาหาร → "รูปแกงจืดผักบุ้งในหม้อสีแดง มีเนื้อหมูหั่นชิ้น"

---

### ⚠️ ตรวจจับตอบช้าอัตโนมัติ

- ลูกค้าส่งข้อความ → พนักงานยังไม่ตอบ → ระบบเตือน
- แบ่งระดับ: 🟢 < 5 นาที / 🟡 5-30 นาที / 🔴 > 30 นาที
- แสดง alert banner บน Dashboard ทันที

---

### 👥 CRM อัตโนมัติจากแชท

- **ไม่ต้องกรอกข้อมูลลูกค้าเอง** — สร้างจากแชทอัตโนมัติ
- ดึง LINE profile (รูป, ชื่อ) อัตโนมัติ
- บันทึก sentiment, โอกาสซื้อ, tags, pipeline ต่อลูกค้า
- แก้ไขข้อมูลเพิ่มเติมได้ (บริษัท, เบอร์, email, หมายเหตุ)

---

### 🦀 น้องปู — สรุปงานสิ้นวัน

- ทุกวัน 20:00 → AI สรุปงานแล้ว **push ไป LINE** อัตโนมัติ:
  - 💬 จำนวนข้อความ + ห้องที่มีความเคลื่อนไหว
  - ⚠️ พนักงานตอบช้า
  - 🔴 ลูกค้าไม่พอใจ
  - 🟡 ห้องต้องติดตาม
  - 🔥 โอกาสขายสูง
  - 📊 ห้องที่คุยเยอะสุด

---

### 📱 Dashboard — ดูแชทแบบ iPhone

- แสดงทุกห้องแชทในรูปแบบ iPhone (WhatsApp style)
- **Drag & Drop** เรียงลำดับได้
- **กรอง** ตาม sentiment / โอกาสซื้อ
- **Score badges** บนทุกห้อง (😊 ลูกค้า / 👔 พนักงาน / 🛒 ซื้อ)
- กดดูรูปขยาย + ดูประวัติวิเคราะห์ได้
- **Live update** ทุก 5 วินาที
- **ธีมสว่าง/มืด** สลับได้ทันที

---

### 🔗 เชื่อม ERP ผ่าน MCP

- เชื่อมต่อ bc-erp MCP Server → 61 tools
- AI เรียกใช้ tool อัตโนมัติเมื่อถามข้อมูลธุรกิจ:
  - เช็คสต็อก, ยอดขาย, KPI
  - ลูกหนี้/เจ้าหนี้
  - สินค้าขายดี, การเติบโต

---

### 🧠 RAG — จำแชทเก่าได้

- ค้นหาข้อมูลจากแชทเดิมด้วย 3-tier:
  1. **Vector Search** (ค้นตามความหมาย)
  2. **Keyword Search** (ค้นตามคำ)
  3. **Recent Messages** (ข้อความล่าสุด)

---

## AI ที่ใช้ (ฟรีทั้งหมด)

ระบบ fallback อัตโนมัติ — ตัวไหนล่มก็ข้ามไป ไม่ต้องรอ:

```
OpenRouter (Nemotron 120B:free)
  ↓ fail → OpenRouter (Llama 3.3-70B:free)
    ↓ fail → OpenRouter (Trinity:free)
      ↓ fail → SambaNova (Qwen3-235B)
        ↓ fail → Groq (Llama 3.3-70B)
          ↓ fail → Cerebras (Qwen3-235B)
            ↓ fail → Gemini (2.0 Flash)
```

- ตัวไหน rate limit → cooldown 30 นาที แล้วข้ามทันที
- ตัวไหน timeout → cooldown 10 นาที
- หมด cooldown → วนกลับมาลองใหม่อัตโนมัติ

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Agent | Node.js + Express |
| Dashboard | Next.js 16 + Tailwind CSS v4 |
| Database | MongoDB Atlas (Free M0) |
| Tunnel | Cloudflare Named Tunnel |
| Deploy | Docker Desktop (ทุก service) |
| AI | OpenRouter / SambaNova / Groq / Cerebras / Gemini |
| ERP | bc-erp MCP Server (SSE) |

---

## เข้าใช้งาน

| หน้า | URL |
|------|-----|
| Dashboard หลัก | `https://smlclaw.satistang.com/dashboard` |
| น้องกุ้ง AI Advisor | `https://smlclaw.satistang.com/dashboard/advice` |
| CRM | `https://smlclaw.satistang.com/dashboard/crm` |
| KPI | `https://smlclaw.satistang.com/dashboard/kpi` |
| ตั้งค่า | `https://smlclaw.satistang.com/dashboard/config` |

---

## Quick Start

```bash
docker compose up -d --build
# เข้า: https://smlclaw.satistang.com/dashboard
```
