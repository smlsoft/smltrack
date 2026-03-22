# LINE Messaging API — วิธีสมัครและตั้งค่า

> เชื่อมต่อ LINE OA กับ OpenClaw Mini CRM เพื่อรับ-ส่งข้อความ

---

## Step 1 — สร้าง LINE Official Account (ถ้ายังไม่มี)

1. เข้า https://manager.line.biz/
2. ล็อกอินด้วย LINE Account ส่วนตัว
3. กด **สร้างบัญชี LINE Official Account**
4. ตั้งชื่อ เลือกหมวด กด **ตกลง**

## Step 2 — เปิด Messaging API

1. เข้า https://developers.line.biz/console/
2. ล็อกอิน → กด **Create a new provider** (หรือเลือก provider ที่มี)
3. ตั้งชื่อ Provider เช่น `OpenClaw Mini CRM`
4. กด **Create a Messaging API channel**
5. เลือก LINE OA ที่สร้างไว้ → กรอกข้อมูล → กด **Create**

## Step 3 — ดึง Channel Secret

1. เข้า Channel ที่สร้าง → แท็บ **Basic settings**
2. หา **Channel secret** → กด **Copy**

## Step 4 — ดึง Channel Access Token

1. แท็บ **Messaging API**
2. เลื่อนลงล่าง → หา **Channel access token (long-lived)**
3. กด **Issue** → กด **Copy**

## Step 5 — ตั้งค่า Webhook URL

1. แท็บ **Messaging API**
2. หา **Webhook URL** → กด **Edit**
3. ใส่:
   ```
   https://smlclaw.satistang.com/webhook
   ```
   (หรือ URL ของ Cloudflare Tunnel ที่ตั้งไว้)
4. กด **Update**
5. กด **Verify** → ต้องขึ้น **Success**
6. เปิด **Use webhook** → **ON**

## Step 6 — ปิด Auto-reply (สำคัญ)

ถ้าไม่ปิด LINE จะตอบข้อความซ้ำกับบอท:

1. แท็บ **Messaging API** → หา **LINE Official Account features**
2. กด **Edit** ข้าง Auto-reply messages
3. จะเปิดหน้า LINE OA Manager → **ตั้งค่าการตอบข้อความ**
4. ปิด **ข้อความตอบกลับอัตโนมัติ** → OFF
5. ปิด **ข้อความทักทาย** → OFF (ถ้าไม่ต้องการ)

## ใส่ค่าใน `.env`

```env
LINE_CHANNEL_ACCESS_TOKEN=ค่าที่ copy จาก Step 4
LINE_CHANNEL_SECRET=ค่าที่ copy จาก Step 3
```

---

## หมายเหตุ

- **Free plan** ส่งข้อความได้ 500 ข้อความ/เดือน (reply ไม่จำกัด)
- ข้อความที่บอท **ตอบกลับ (reply)** ไม่เสียค่าใช้จ่าย
- ข้อความที่บอท **ส่งเอง (push)** นับโควต้า
