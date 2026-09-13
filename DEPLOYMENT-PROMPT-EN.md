# Noviq Deployment Prompt — Comprehensive Project Deployment Prompt

> Ready-to-paste prompt for any AI assistant (ChatGPT / Claude / Gemini / Copilot) to streamline Noviq deployment.

---

## How to Use

1. Copy the content between the `---` lines below.
2. Paste it into your AI assistant.
3. Edit the values in `[...]` brackets with your actual information.
4. Attach project files if requested.

---

```text
You are a DevOps expert. Help me deploy the Noviq project on shared hosting.

═══════════════════════════════════════════════════════════
Project Information
═══════════════════════════════════════════════════════════

Project name: Noviq
Project type: Company website + admin panel + API
Architecture:
  - Frontend: Vanilla HTML/CSS/JS (SPA) + Three.js in folder frontend/
  - Backend: Node.js + Express 5 + SQLite (better-sqlite3) in folder backend/
  - Database: SQLite (file backend/data/noviq.db)
  - Entry point: backend/index.js
  - Language: JavaScript (Node.js ≥ 18)

═══════════════════════════════════════════════════════════
Hosting Details
═══════════════════════════════════════════════════════════

Hosting type: Shared hosting
Control panel: cPanel
Domain: [yourdomain.com]
Root directory: /home/[USERNAME]/
App port: 3001 (or as set by Passenger)
Node.js version: [18.x or higher]
SSH available?: [yes/no]
phpMyAdmin available?: [yes/no]

═══════════════════════════════════════════════════════════
Environment Variables
═══════════════════════════════════════════════════════════

The .env file in backend/ contains:
- JWT_SECRET: [place a long random string — required in production]
- ADMIN_PASSWORD: [a strong password — default noviq2026, change it!]
- FRONTEND_URL: [https://yourdomain.com,https://www.yourdomain.com]
- NODE_ENV: production
- SERVE_FRONTEND: true (backend serves the frontend)
- DB_PATH: [optional — path to SQLite file outside public_html]
- (optional) SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFY_EMAIL

═══════════════════════════════════════════════════════════
Key Endpoints (in backend/routes/index.js)
═══════════════════════════════════════════════════════════

Public:
  GET  /api/health
  POST /api/contact
  POST /api/newsletter/subscribe
  POST /api/assessment
  POST /api/consultation
  POST /api/solution-builder
  GET  /api/content (and /api/content/services, /industries, /projects, etc.)
  POST /api/auth/register | /login | /forgot-password | /reset-password
  POST /api/chatbot/message
  GET  /api/chatbot/topics | /search
  POST /api/analytics/visit
  GET  /api/imagegen

Admin (require Bearer token):
  POST /api/admin/login (admin / ADMIN_PASSWORD)
  GET  /api/admin/me | /stats | /system | /analytics | /chats | /users
  GET  /api/admin/content | /content/:key
  PUT  /api/admin/content/:key | /content/:key/array
  DEL  /api/admin/content/:key/array/:index
  POST /api/admin/upload | /content/rebuild

Admin panel: /admin (static HTML in backend/admin/)
Live content file: /data/content.config.js

═══════════════════════════════════════════════════════════
Database Tables (12 tables)
═══════════════════════════════════════════════════════════

1. contacts (contact messages)
2. newsletter (subscribers)
3. assessments (maturity assessments)
4. consultations (consultation requests)
5. solution_builds (solution builder submissions)
6. content (site content — key/value)
7. users (registered users)
8. password_resets (password reset codes)
9. visits (visit analytics)
10. chatbot_replies (chatbot reply overrides)
11. admin_users (admin users)
12. admin_sessions (admin sessions)

═══════════════════════════════════════════════════════════
Task
═══════════════════════════════════════════════════════════

Give me step-by-step instructions to:

1. Prepare files locally before uploading (npm install, .env setup, testing).
2. Upload the correct files only (what to upload and what to skip — do not upload node_modules from Windows).
3. Set up the Node.js app in cPanel (Setup Node.js App):
   - Node version, startup file, application root, env vars.
4. Solve the better-sqlite3 compilation issue on shared hosting.
5. Configure CORS and FRONTEND_URL for the actual domain.
6. Enable SSL/HTTPS.
7. Verify successful deployment (check URLs).
8. Protect and back up the database.
9. Set up email (SMTP) if I want notifications.
10. Troubleshoot common errors (502, CORS, DB, admin).

Then give me:

11. A fallback plan if better-sqlite3 fails:
    - How to migrate to MySQL (via cPanel + mysql2).
    - How to migrate to Supabase (cloud PostgreSQL).
    - Which is more suitable for my case and why?

═══════════════════════════════════════════════════════════
Constraints
═══════════════════════════════════════════════════════════

- Do not upload node_modules from a Windows environment to Linux (better-sqlite3 is a native binary).
- Use NPM Install from cPanel or SSH to compile packages on Linux.
- Do not upload .env via insecure FTP — use the cPanel environment variables interface.
- Take a backup of backend/data/noviq.db before any modification.
- Change JWT_SECRET and ADMIN_PASSWORD before running in production.
- The admin panel is at /admin — protect it with a strong password.

═══════════════════════════════════════════════════════════
Additional Context
═══════════════════════════════════════════════════════════

[Add any additional details here, such as:]
- Are you facing a specific issue right now?
- Does your hosting support SSH?
- Do you want to separate the frontend from the backend or merge them?
- Do you have an SSL certificate?
- Do you want to use a subdomain (api.yourdomain.com)?

═══════════════════════════════════════════════════════════
Response Format
═══════════════════════════════════════════════════════════

- Be precise with paths and numbers.
- Use tables for comparisons.
- Use code blocks for commands.
- Do not assume tools that are not mentioned.
- Briefly explain each step before the command.
```

---

## Additional Tips

### Customizing the Prompt

- **If you're facing a specific issue:** add a "Current Problem" section with error message details.
- **If you want separate deployment:** mention that you want `api.yourdomain.com` for the backend and `yourdomain.com` for the frontend.
- **If you want Docker:** add "I want to use Docker instead of cPanel" — but Docker is not supported on shared hosting.
- **If you want a VPS:** replace "shared hosting" with "VPS" and add server specs.

### Expected AI Questions

The assistant may ask you:
1. What Node.js version is available on cPanel?
2. Does your hosting support SSH?
3. Do you have an SSL certificate?
4. MySQL database name (if you want to migrate)?
5. Current SQLite database size?

Prepare your answers in advance to speed up the process.

---

## Reference Files

When working with an AI assistant, attach or point to:

| File | Purpose |
|---|---|
| `backend/config.js` | All environment variables and settings |
| `backend/.env.example` | Environment variable template |
| `backend/package.json` | Packages and required Node version |
| `backend/app.js` | App structure and middleware |
| `backend/index.js` | Entry point and security checks |
| `backend/db/init.js` | Full database schema (12 tables) |
| `backend/routes/index.js` | All endpoints (64 endpoints) |
| `DEPLOYMENT-SHARED-HOSTING-EN.md` | Full deployment guide |
| `DATABASE-MIGRATION-EN.md` | Database migration guide |

---

## Final Checklist

Before sending the prompt, ensure:

- [ ] You filled in `[yourdomain.com]` with your actual domain.
- [ ] You filled in `[USERNAME]` with your cPanel username.
- [ ] You specified the available Node version.
- [ ] You answered about SSH and phpMyAdmin.
- [ ] You prepared a strong JWT_SECRET (64 hex chars).
- [ ] You prepared a strong ADMIN_PASSWORD.

---

*This prompt is designed to be comprehensive. The more details you add, the more accurate the response.*
