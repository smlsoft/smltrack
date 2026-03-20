# Cloudflare Tunnel — วิธีสมัครและตั้งค่า

> ทำให้ Docker บนเครื่องเราเข้าถึงจาก Internet ได้ (ไม่ต้องเปิด port/ซื้อ IP)
> **ฟรี** — ไม่มีค่าใช้จ่าย

---

## Step 1 — สมัคร Cloudflare

1. เข้า https://dash.cloudflare.com/sign-up
2. กรอก Email + Password → กด **Create Account**
3. ยืนยัน Email

## Step 2 — เพิ่มโดเมน (ถ้ายังไม่มี)

> ถ้าผู้ดูแลระบบให้ Tunnel Token มาแล้ว ข้ามไป Step 5

1. เข้า Dashboard → กด **Add a site**
2. ใส่ชื่อโดเมน เช่น `satistang.com`
3. เลือก **Free plan** → กด **Continue**
4. Cloudflare จะแสดง Nameservers → ไปเปลี่ยนที่ผู้ให้บริการโดเมน
5. รอ Nameserver propagation (1-24 ชม.)

## Step 3 — สร้าง Tunnel

1. เข้า https://one.dash.cloudflare.com/
2. ไปที่ **Networks** → **Tunnels**
3. กด **Create a tunnel**
4. เลือก **Cloudflared** → กด **Next**
5. ตั้งชื่อ Tunnel เช่น `smltrack` → กด **Save tunnel**

## Step 4 — Copy Tunnel Token

1. หน้า **Install and run a connector** จะแสดง token
2. หา token ในคำสั่งที่แสดง (ยาวมาก ขึ้นต้นด้วย `eyJ...`)
3. **Copy token ทั้งก้อน**

> Token มีหน้าตาแบบนี้: `eyJhIjoixxxxxxxxx...` (ยาวหลายร้อยตัวอักษร)

## Step 5 — ตั้ง Public Hostname

1. กดแท็บ **Public Hostname** → กด **Add a public hostname**
2. กรอก:
   - **Subdomain:** `smlclaw` (หรือชื่อที่ต้องการ)
   - **Domain:** เลือกโดเมนที่เพิ่มไว้
   - **Type:** `HTTP`
   - **URL:** `agent:3000`
3. กด **Save hostname**

> ผลลัพธ์: `https://smlclaw.satistang.com` → จะ forward ไปที่ agent container port 3000

## Step 6 — เพิ่ม Dashboard route (ถ้าต้องการ)

Dashboard เข้าผ่าน agent อยู่แล้ว (reverse proxy) ที่ path `/dashboard`
ไม่ต้องเพิ่ม route แยก

## ใส่ค่าใน `.env`

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoixxxxxxxxx...
```

---

## ทดสอบ

หลัง `docker compose up -d --build` แล้ว:

1. ดู logs: `docker compose logs tunnel -f`
2. ต้องเห็น `Connection registered` หรือ `Registered tunnel connection`
3. เข้า `https://smlclaw.satistang.com/` → ต้องตอบ OK
4. เข้า `https://smlclaw.satistang.com/dashboard` → ต้องเห็น Dashboard

## แก้ปัญหา

| ปัญหา | สาเหตุ | แก้ไข |
|--------|--------|------|
| `ERR failed to connect` | Token ผิด/หมดอายุ | ขอ token ใหม่จาก Cloudflare Dashboard |
| `502 Bad Gateway` | Agent ยังไม่ start | `docker compose logs agent` ดู error |
| เข้า URL ไม่ได้ | DNS ยังไม่ propagate | รอ 5-10 นาที |
