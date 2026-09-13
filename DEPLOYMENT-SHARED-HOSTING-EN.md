# Noviq — Shared Hosting Deployment Guide

> Step-by-step guide for deploying Noviq on shared hosting (cPanel / LiteSpeed / Passenger).

---

## Architecture Overview

The project has two parts:

| Part | Path | Stack | Port |
|---|---|---|---|
| Frontend | `frontend/` | Vanilla HTML/CSS/JS (SPA) + Three.js | Served by backend |
| Backend | `backend/` | Express 5 + SQLite (better-sqlite3) | 3001 (default) |

**Default mode:** Backend serves frontend + API + admin panel together (single app).

- Entry point: `backend/index.js`
- App file: `backend/app.js`
- Config: `backend/config.js`
- Database: `backend/data/noviq.db` (SQLite, WAL mode)
- Admin panel: `http://yourdomain.com/admin` (default: admin / noviq2026)

---

## Requirements

### On the hosting
- **Node.js ≥ 18** (required for better-sqlite3 compilation).
- **cPanel** with **Setup Node.js App** (CloudLinux + Passenger).
- **SSH** access (preferred for `npm install` and compiling `better-sqlite3`).
- **phpMyAdmin** or file manager access (optional, for backups).
- Disk space ≥ 500 MB (node_modules + database + images).

### Locally before uploading
- Node.js ≥ 18 installed.
- Project tested locally via `run.bat` or `node backend/index.js`.

---

## Step 1: Local Preparation

### 1.1 Set up env file

Copy `backend/.env.example` to `backend/.env` and edit:

```bash
# REQUIRED in production — long random string
JWT_SECRET=place_a_long_random_secret_here_like_64_chars
ADMIN_PASSWORD=your_new_strong_password

# Admin email (optional) — sign in with username OR email
# ADMIN_EMAIL=admin@yourdomain.com

# Your domain (important for CORS)
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com

# Production mode
NODE_ENV=production

# (Optional) Database path outside public_html
# DB_PATH=/home/USERNAME/noviq-data/noviq.db

# (Optional) Email
# SMTP_HOST=mail.yourdomain.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=notify@yourdomain.com
# SMTP_PASS=yourpassword
# SMTP_FROM=notify@yourdomain.com
# NOTIFY_EMAIL=you@yourdomain.com
```

> Generate JWT_SECRET: run `openssl rand -hex 32`.

### 1.2 Install dependencies locally

```bash
cd backend
npm install
```

### 1.3 Quick test

```bash
node index.js
# Open http://localhost:3001 — site + /admin should work
```

---

## Step 2: Upload Files

### 2.1 What to upload

**Upload the entire `backend/` folder** outside `public_html` (or inside, depending on host):

```
/home/USERNAME/
├── noviq-backend/          ← upload here
│   ├── index.js
│   ├── app.js
│   ├── config.js
│   ├── .env
│   ├── package.json
│   ├── db/
│   ├── routes/
│   ├── middleware/
│   ├── chatbot/
│   ├── admin/
│   ├── content-store.js
│   ├── mailer.js
│   ├── prompt-builder-config.js
│   └── data/               ← auto-created
│       └── noviq.db
├── public_html/            ← public files
└── ...
```

### 2.2 Upload frontend

The frontend (`frontend/`) is integrated in the backend by default. If you want it in `public_html` separately:

**Option A (recommended): Full integration**

Keep `SERVE_FRONTEND=true` (default). Don't upload anything to `public_html`. The Node app serves everything.

**Option B: Separate frontend**

1. Upload contents of `frontend/` to `public_html/`.
2. In `backend/.env` set:
   ```
   SERVE_FRONTEND=false
   FRONTEND_DIR=/home/USERNAME/public_html
   ```
3. Upload `frontend/.htaccess` to `public_html/` (already included) so direct
   links like `/team`, `/member/xyz`, or `/services` open the app instead of 404.
4. If the API lives on another domain/subdomain, set in `frontend/js/config/env.js`:
   `window.NOVIQ_API_URL = 'https://api.yourdomain.com'`
   and add the site domain to `FRONTEND_URL` (CORS).

---

## Step 3: Setup Node.js App in cPanel

### 3.1 Create the app

1. Go to **cPanel** → **Software** → **Setup Node.js App**.
2. Click **Create Application**.

### 3.2 Settings

| Field | Value |
|---|---|
| Node.js version | **18.x** or higher |
| Application mode | **Production** |
| Application root | `/home/USERNAME/noviq-backend` (backend folder path) |
| Application URL | `yourdomain.com` or a subdomain |
| Application startup file | `index.js` |

### 3.3 Environment variables in cPanel

In the **Environment variables** field, add the same values as `.env`:

```
JWT_SECRET=your_long_random_secret
ADMIN_PASSWORD=your_strong_password
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production
SERVE_FRONTEND=true
```

3. Click **Create** then **Run NPM Install**.

### 3.4 If better-sqlite3 fails to compile

`better-sqlite3` needs build tools. On shared hosting:

1. Try **Run NPM Install** via cPanel first.
2. If it fails, use **SSH**:
   ```bash
   cd /home/USERNAME/noviq-backend
   npm install
   ```
3. If SSH is unavailable or compilation fails, install the package locally on the same Linux environment then upload `node_modules`:
   ```bash
   # Locally on WSL/Docker (Ubuntu)
   npm install better-sqlite3
   # Then upload node_modules/better-sqlite3 entirely
   ```

> **Alternative:** If better-sqlite3 cannot be compiled at all, see `DATABASE-MIGRATION-EN.md` to use MySQL instead.

---

## Step 4: Rewrite Rules

Passenger handles the Node app automatically. But if you need `.htaccess` in `public_html`:

```apache
# Route all requests to the Node app
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3001/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
```

> Most modern cPanel hosts (Passenger) don't need this — routing is automatic.

---

## Step 5: Verification

Open in your browser:

| URL | Expected |
|---|---|
| `https://yourdomain.com` | Site homepage |
| `https://yourdomain.com/admin` | Admin login page |
| `https://yourdomain.com/api/health` | `{"status":"ok","timestamp":"..."}` |
| `https://yourdomain.com/data/content.config.js` | JS content file |

Login to admin with:
- **Username:** `admin`
- **Password:** the value in `ADMIN_PASSWORD` (default `noviq2026` — **change it immediately!**)

---

## Step 6: Post-Deployment

### 6.1 Change admin credentials
In the admin panel → **Settings** → **Admin Account** (username, email, and password
in one card — current password is always required). Or set `ADMIN_PASSWORD` /
`ADMIN_EMAIL` in `.env`.

### 6.2 Protect database
- Place `noviq.db` outside `public_html` if possible (use `DB_PATH`).
- Take regular backups of `backend/data/noviq.db`.

### 6.3 SSL / HTTPS
Enable **Let's Encrypt** from cPanel → **SSL/TLS**. Make all URLs `https://`.

### 6.4 Email setup (optional)
To receive email notifications when contact messages arrive, enable SMTP in `.env` (shown above).

---

## Troubleshooting

### Site not loading
- Check **Application log** in cPanel → Setup Node.js App → **Log**.
- Ensure startup file = `index.js`.
- Ensure `NODE_ENV=production` and `JWT_SECRET` is set.

### CORS error
- Add your domain to `FRONTEND_URL`:
  ```
  FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
  ```
- Restart the app.

### App refuses to start in production
- This is the built-in guard: `JWT_SECRET` and `ADMIN_PASSWORD` must differ from
  the defaults when `NODE_ENV=production`. Set both, then start again.

### Database error
- Ensure the `data/` folder exists and is writable.
- Check logs in `backend/data/`.

### Admin can't login
- Verify `JWT_SECRET` and `ADMIN_PASSWORD` in `.env`.
- Delete `noviq.db` (only if you have no data) and restart to recreate the default admin.

### better-sqlite3 not working
- Ensure Node version ≥ 18.
- Recompile: `npm rebuild better-sqlite3`.
- See `DATABASE-MIGRATION.md` to switch to MySQL.

### 502 / 503 errors
- Usually a Passenger issue: restart the app from cPanel.
- Check resource usage (RAM/CPU) — you may need a higher plan.

---

## Quick Summary

```bash
# 1. Locally
cd backend
cp .env.example .env
# Edit .env (JWT_SECRET, ADMIN_PASSWORD, FRONTEND_URL)
npm install
node index.js  # test

# 2. Upload backend/ to hosting
# 3. cPanel → Setup Node.js App → Create
#    - root: /home/USERNAME/noviq-backend
#    - startup: index.js
#    - Node 18+, Production
#    - env vars: JWT_SECRET, ADMIN_PASSWORD, FRONTEND_URL, NODE_ENV=production
# 4. Run NPM Install (cPanel) or npm install (SSH)
# 5. Start the app
# 6. Verify: /api/health and /admin
```

---

## Important Notes

- **Do not upload `node_modules` from Windows to Linux hosting** — `better-sqlite3` needs to be compiled on Linux. Install via SSH or cPanel NPM Install.
- **Do not upload `.env` with real secrets via insecure FTP** — use the cPanel environment variables interface.
- **Take a backup** of `backend/data/noviq.db` before any update.
- **Change `JWT_SECRET` and `ADMIN_PASSWORD`** before running in production.
- The admin panel is at `/admin` — protect it with a strong password.

---

*Always check `config.js`, `.env.example`, and `package.json` for the latest settings.*
