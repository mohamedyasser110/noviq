# 🚀 Noviq Production Deployment Guide | دليل نشر وتشغيل المشروع في بيئة الإنتاج

Comprehensive guide to deploy the Noviq enterprise platform (Next.js 15 frontend + Express 5 & SQLite backend).

---

## 📑 جدول المحتويات / Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Option A: Docker Compose Deployment (Recommended)](#2-option-a-docker-compose-deployment-recommended)
3. [Option B: VPS Deployment with PM2 & Nginx](#3-option-b-vps-deployment-with-pm2--nginx)
4. [Option C: cPanel & Shared Hosting](#4-option-c-cpanel--shared-hosting)
5. [Database Persistence & Backup](#5-database-persistence--backup)
6. [SSL Configuration (Let's Encrypt / Certbot)](#6-ssl-configuration-lets-encrypt--certbot)
7. [Healthcheck & Maintenance](#7-healthcheck--maintenance)

---

## 1. Architecture Overview | نظرة عامة على المعمارية
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons, bilingual (`/en` and `/ar`). Runs on port `4321`.
- **Backend API**: Node.js / Express 5 with `better-sqlite3`, bcrypt, JWT, and Helmet. Runs on port `4322`.
- **Admin Dashboard**: Hosted on `http://<domain>/admin` (embedded in backend).
- **Reverse Proxy**: Nginx routes `/` to frontend `:4321`, `/api/` and `/admin` to backend `:4322`.

---

## 2. Option A: Docker Compose Deployment (Recommended) | النشر عبر Docker
The fastest and most isolated way to run Noviq in production.

### Step 1: Clone & Configure
```bash
git clone <repo-url> noviq
cd noviq

# Copy and set your production environment variables
cp .env.production.example .env
nano .env  # Update JWT_SECRET and ADMIN_PASSWORD
```

### Step 2: Build & Start Containers
```bash
# Build images and start services in detached mode
docker compose up -d --build

# View running services
docker compose ps

# View live logs
docker compose logs -f
```

### Step 3: Verify
- Frontend: `http://your-server-ip`
- Admin Dashboard: `http://your-server-ip/admin`
- Backend API Health: `http://your-server-ip/api/health`

---

## 3. Option B: VPS Deployment with PM2 & Nginx | النشر عبر VPS بنظام PM2 وNginx
Ideal for Ubuntu 22.04 / 24.04 or Debian VPS.

### Step 1: Install Node.js 20 & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3 sqlite3 nginx
sudo npm install -g pm2
```

### Step 2: Install Dependencies & Build
```bash
cd /var/www/noviq

# Install backend dependencies
cd backend
npm ci --omit=dev
cd ..

# Install frontend dependencies and build
cd frontend
npm ci
npm run build
cd ..
```

### Step 3: Start Services with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Step 4: Configure Nginx
```bash
sudo cp nginx/nginx.conf /etc/nginx/sites-available/noviq.conf
sudo ln -s /etc/nginx/sites-available/noviq.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Option C: cPanel & Shared Hosting | الاستضافة المشتركة أو cPanel
Refer to the detailed guide at [docs/deployment-shared-hosting.md](file:///c:/Downloads/Noviq%20-%20final/docs/deployment-shared-hosting.md).
- Use **Setup Node.js App** in cPanel.
- Point Application root to `backend/`.
- Ensure Node version is `>= 18` or `20.x`.
- Set Environment Variables: `NODE_ENV=production`, `PORT=4322`, `JWT_SECRET`.

---

## 5. Database Persistence & Backup | النسخ الاحتياطي لقاعدة البيانات
The database is a high-performance SQLite file located at `backend/data/noviq.db`.

### Create Live Backup (Safe while running):
```bash
# Using sqlite3 online backup command
sqlite3 /var/www/noviq/backend/data/noviq.db ".backup '/var/backups/noviq_$(date +%Y%m%d_%H%M%S).db'"
```

### Automated Nightly Backup Cron:
Add to `crontab -e`:
```bash
0 2 * * * sqlite3 /var/www/noviq/backend/data/noviq.db ".backup '/var/backups/noviq_$(date +\%Y\%m\%d).db'"
```

---

## 6. SSL Configuration (Let's Encrypt / Certbot) | تفعيل شهادة الأمان SSL
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 7. Healthcheck & Maintenance | الصيانة والتحقق
- **API Health**: `curl http://localhost:4322/api/health` -> returns `{"status":"ok"}`.
- **Admin Login**: Access `/admin` with username `admin` and password defined in `ADMIN_PASSWORD`.
- **Content Updates**: All changes saved in `/admin` immediately update SQLite and sync with frontend ISR.
