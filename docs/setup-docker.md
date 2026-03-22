# Docker Desktop — วิธีติดตั้งและตั้งค่า

> ใช้รัน OpenClaw Mini CRM ทั้งระบบบนเครื่อง

---

## Step 1 — ดาวน์โหลดและติดตั้ง

### Windows

1. เข้า https://www.docker.com/products/docker-desktop/
2. กด **Download for Windows**
3. รัน `Docker Desktop Installer.exe`
4. ติดตั้งตาม wizard → เลือก **Use WSL 2** (แนะนำ)
5. รีสตาร์ทเครื่อง (ถ้าระบบขอ)

### macOS

1. เข้า https://www.docker.com/products/docker-desktop/
2. กด **Download for Mac** (เลือก Apple Silicon หรือ Intel ตาม CPU)
3. ลาก Docker.app ไปใส่ Applications
4. เปิด Docker.app

### Linux (Ubuntu/Debian)

```bash
# ติดตั้ง Docker Engine
curl -fsSL https://get.docker.com | sh

# เพิ่ม user เข้ากลุ่ม docker (ไม่ต้อง sudo)
sudo usermod -aG docker $USER

# ล็อกเอาท์แล้วล็อกอินใหม่
```

## Step 2 — ตรวจสอบการติดตั้ง

เปิด Terminal แล้วรัน:

```bash
docker --version
# ต้องเห็น: Docker version 27.x.x หรือใหม่กว่า

docker compose version
# ต้องเห็น: Docker Compose version v2.x.x
```

## Step 3 — ตั้งค่า Resources (แนะนำ)

เปิด Docker Desktop → Settings (ฟันเฟือง) → Resources:

| Setting | แนะนำ | ขั้นต่ำ |
|---------|-------|--------|
| CPUs | 4 | 2 |
| Memory | 4 GB | 2 GB |
| Disk | 20 GB | 10 GB |

> OpenClaw Mini CRM ใช้ RAM ประมาณ 1-2 GB (agent + dashboard + tunnel)

## Step 4 — เปิด Docker Desktop

1. เปิดโปรแกรม Docker Desktop
2. รอจนไอคอน Docker ที่ system tray เป็น **สีเขียว/นิ่ง**
3. ทดสอบ: `docker ps` → ต้องไม่ error

---

## ทดสอบ Docker ก่อนรัน OpenClaw Mini CRM

```bash
# ทดสอบว่า Docker ทำงานได้
docker run --rm hello-world

# ต้องเห็น: "Hello from Docker!"
```

ถ้าเห็นข้อความ Hello from Docker! แสดงว่าพร้อมใช้งาน ไปต่อที่ [INSTALL.md](INSTALL.md) ได้เลย

---

## แก้ปัญหาที่พบบ่อย

### Windows: WSL 2 ไม่ได้ติดตั้ง

```
WSL 2 installation is incomplete
```

แก้:
```powershell
# เปิด PowerShell (Admin)
wsl --install
# รีสตาร์ทเครื่อง
```

### Windows: Virtualization ไม่ได้เปิดใน BIOS

```
Hardware assisted virtualization and data execution protection must be enabled in the BIOS
```

แก้:
1. รีสตาร์ทเครื่อง → เข้า BIOS (กด F2/Del/F10 ตอนบูต)
2. หา **Intel VT-x** หรือ **AMD-V** → เปิด **Enabled**
3. Save & Exit

### Docker daemon ไม่ทำงาน

```
Cannot connect to the Docker daemon
```

แก้:
- Windows/Mac: เปิดโปรแกรม Docker Desktop แล้วรอจนพร้อม
- Linux: `sudo systemctl start docker`

### Port ถูกใช้อยู่แล้ว

```
Bind for 0.0.0.0:3000 failed: port is already allocated
```

แก้:
- หาว่าโปรแกรมอะไรใช้ port: `netstat -ano | findstr :3000` (Windows)
- ปิดโปรแกรมนั้น หรือเปลี่ยน port ใน `docker-compose.yml`
