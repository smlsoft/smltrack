# MongoDB Atlas — วิธีสมัครและตั้งค่า

> ฐานข้อมูลหลักของ OpenClaw Mini CRM (ฟรี M0 Tier)

---

## Step 1 — สมัครบัญชี

1. เข้า https://www.mongodb.com/cloud/atlas/register
2. กรอก Email + Password หรือ Sign up with Google
3. ยืนยัน Email

## Step 2 — สร้าง Cluster (ฟรี)

1. กด **Build a Database**
2. เลือก **M0 FREE** (ฟรีตลอด, 512MB)
3. เลือก Provider: **AWS** → Region: **Singapore (ap-southeast-1)** (ใกล้ไทยที่สุด)
4. ตั้งชื่อ Cluster เช่น `Cluster0`
5. กด **Create Deployment**

## Step 3 — สร้าง Database User

1. ระบบจะถาม **How would you like to authenticate?**
2. เลือก **Username and Password**
3. ตั้ง Username เช่น `smltrack_user`
4. ตั้ง Password (กด Autogenerate ได้) → **จดไว้!**
5. กด **Create Database User**

## Step 4 — ตั้งค่า Network Access (Whitelist IP)

1. ไปที่ **Network Access** (เมนูซ้าย)
2. กด **Add IP Address**
3. เลือก **Allow Access from Anywhere** (`0.0.0.0/0`)
   - หรือใส่ IP เครื่องที่จะรัน Docker
4. กด **Confirm**

> ถ้าใช้ IP เฉพาะ: ทุกครั้งที่เปลี่ยนเครื่อง/เน็ต ต้องมา whitelist IP ใหม่

## Step 5 — สร้าง Database

1. ไปที่ **Database** → กดชื่อ Cluster → **Browse Collections**
2. กด **Add My Own Data**
3. Database name: `smltrack`
4. Collection name: `messages`
5. กด **Create**

## Step 6 — ดึง Connection String

1. กลับไปหน้า **Database** → กด **Connect**
2. เลือก **Drivers**
3. จะเห็น Connection String หน้าตาแบบนี้:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
   ```
4. แก้ `<username>` → ชื่อ user ที่สร้าง
5. แก้ `<password>` → password ที่ตั้งไว้
6. เพิ่มชื่อ database หลัง `.net/`:
   ```
   mongodb+srv://smltrack_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/smltrack?appName=Cluster0
   ```

## ใส่ค่าใน `.env`

```env
MONGODB_URI=mongodb+srv://smltrack_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/smltrack?appName=Cluster0
```

---

## สร้าง Index (สำคัญ — ทำหลัง deploy ครั้งแรก)

หลังจาก agent รันแล้วมีข้อมูล ให้สร้าง compound index:

1. เข้า **Browse Collections** → เลือก collection `messages`
2. กดแท็บ **Indexes** → **Create Index**
3. ใส่:
   ```json
   { "sourceId": 1, "createdAt": -1 }
   ```
4. กด **Create**

> Index นี้ช่วยให้ query เร็วขึ้นมากเมื่อข้อมูลเยอะ
