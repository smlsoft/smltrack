# AI Providers — วิธีสมัครและดึง API Key

> OpenClaw Mini CRM ใช้ AI หลายตัวแบบ fallback chain (ตัวไหนล่มก็ข้ามไป)
> **ฟรีทั้งหมด** — ไม่ต้องจ่ายเงิน

---

## 1. SambaNova (Qwen3-235B)

**โมเดล:** Qwen3-235B — ฉลาดมาก ฟรี

1. เข้า https://cloud.sambanova.ai/
2. กด **Sign Up** → สมัครด้วย Email หรือ Google
3. ยืนยัน Email
4. เข้า Dashboard → ไปที่ **API Keys**
5. กด **Create API Key** → ตั้งชื่อ → Copy key

```env
SAMBANOVA_API_KEY=ค่าที่ copy
```

---

## 2. Groq (Llama 3.3-70B)

**โมเดล:** Llama 3.3-70B — เร็วมาก ฟรี

1. เข้า https://console.groq.com/
2. กด **Sign Up** → สมัครด้วย Google / GitHub / Email
3. เข้า Dashboard → ไปที่ **API Keys** (เมนูซ้าย)
4. กด **Create API Key** → ตั้งชื่อ → Copy key

```env
GROQ_API_KEY=ค่าที่ copy
```

> **Rate limit (ฟรี):** 30 requests/min, 14,400 requests/day

---

## 3. Cerebras (Qwen3-235B)

**โมเดล:** Qwen3-235B — เร็วที่สุดในโลก ฟรี

1. เข้า https://cloud.cerebras.ai/
2. กด **Sign Up** → สมัครด้วย Google / GitHub / Email
3. ยืนยัน Email
4. เข้า Dashboard → ไปที่ **API Keys**
5. กด **Create API Key** → Copy key

```env
CEREBRAS_API_KEY=ค่าที่ copy
```

---

## 4. OpenRouter (หลายโมเดลฟรี)

**โมเดล:** Nemotron 120B, Llama 3.3-70B, Trinity — ฟรี

1. เข้า https://openrouter.ai/
2. กด **Sign Up** → สมัครด้วย Google / GitHub / Email
3. เข้า Dashboard → ไปที่ **Keys** (เมนูซ้ายบน)
4. กด **Create Key** → ตั้งชื่อ → Copy key

```env
OPENROUTER_API_KEY=ค่าที่ copy
```

> **ฟรี:** โมเดลที่มี `:free` ต่อท้ายไม่เสียเงิน

---

## 5. Google AI (Gemini — Vision)

**โมเดล:** Gemini 2.0 Flash — ใช้วิเคราะห์รูปภาพ ฟรี

1. เข้า https://aistudio.google.com/
2. ล็อกอินด้วย Google Account
3. กด **Get API Key** (มุมซ้ายบน)
4. กด **Create API Key** → เลือก Google Cloud Project (สร้างใหม่ถ้าไม่มี)
5. Copy key

```env
GOOGLE_API_KEY=ค่าที่ copy
```

> **ฟรี:** 15 requests/min, 1,500 requests/day

---

## สรุป — ใส่ค่าทั้งหมดใน `.env`

```env
SAMBANOVA_API_KEY=xxx
GROQ_API_KEY=xxx
CEREBRAS_API_KEY=xxx
OPENROUTER_API_KEY=xxx
GOOGLE_API_KEY=xxx
```

## ลำดับ Fallback

ระบบจะลองเรียกตามลำดับ — ถ้าตัวไหนล่มจะข้ามไปตัวถัดไปอัตโนมัติ:

```
OpenRouter (Nemotron) → OpenRouter (Llama) → OpenRouter (Trinity)
  → SambaNova → Groq → Cerebras → Gemini
```

> **ไม่จำเป็นต้องสมัครครบทุกตัว** — มีอย่างน้อย 2-3 ตัวก็พอ
> แต่ยิ่งมีเยอะ ระบบยิ่งเสถียร (fallback ได้หลายตัว)
