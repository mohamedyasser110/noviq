# Noviq Database Migration Guide

> Guide for migrating from SQLite to **MySQL** or **Supabase (PostgreSQL)**.

---

## Current State

The project uses **SQLite** via the `better-sqlite3` package:
- File: `backend/data/noviq.db`
- Config: `backend/config.js` → `DB_PATH`
- Initialization: `backend/db/init.js`
- Access: directly in `backend/content-store.js`, `backend/routes/index.js`, and `backend/middleware/auth.js`

```js
// Current usage pattern
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.prepare('SELECT ...').all();
db.prepare('INSERT ...').run(...);
db.exec('CREATE TABLE ...');
db.transaction((data) => { ... })();
```

---

## Why Migrate?

| Reason | Explanation |
|---|---|
| Shared hosting may not allow native module compilation | better-sqlite3 needs build tools |
| Need for a centralized, shared database | SQLite struggles with high concurrency |
| Larger data volume | SQLite slows down with concurrent writes |
| Easier backups via phpMyAdmin / Supabase | Visual management tools |
| Separate DB from app server | Better scalability |

---

## Full Database Schema

This schema is taken from `backend/db/init.js`. Use it to create tables in MySQL or Supabase.

```sql
-- ============================================================
-- NOVIQ — DATABASE SCHEMA (from backend/db/init.js)
-- ============================================================

-- 1. Contact messages
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);

-- 2. Newsletter
CREATE TABLE newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1
);
CREATE INDEX idx_newsletter_email ON newsletter(email);

-- 3. Digital maturity assessments
CREATE TABLE assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  answers TEXT NOT NULL,          -- JSON
  score INTEGER DEFAULT 0,
  level TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Consultation requests
CREATE TABLE consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  timeline TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_consultations_status ON consultations(status);

-- 5. Solution builder submissions
CREATE TABLE solution_builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  steps TEXT NOT NULL,            -- JSON
  summary TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Site content (key-value store)
CREATE TABLE content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,            -- JSON
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password TEXT NOT NULL,         -- bcrypt hash
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);

-- 8. Password resets
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_resets_email ON password_resets(email);

-- 9. Visit analytics
CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  language TEXT DEFAULT 'en',
  count INTEGER DEFAULT 1,
  UNIQUE(day, path, language)
);
CREATE INDEX idx_visits_day ON visits(day);

-- 10. Chatbot reply overrides
CREATE TABLE chatbot_replies (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'intent',
  reply_en TEXT DEFAULT '',
  reply_ar TEXT DEFAULT '',
  category TEXT DEFAULT '',
  image TEXT DEFAULT '',
  file TEXT DEFAULT '',
  label_en TEXT DEFAULT '',
  label_ar TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Admin users
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,         -- bcrypt hash
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Admin sessions
CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
```

---

# Option 1: Migrate to MySQL

## Step 1: Install package

```bash
cd backend
npm uninstall better-sqlite3
npm install mysql2
```

## Step 2: Create database

In cPanel → **MySQL Databases**:

1. Create a database: `noviq_db`.
2. Create a user and grant full privileges on `noviq_db`.
3. Record: database name, username, password, host (usually `localhost`).

## Step 3: MySQL Schema

```sql
-- Run in phpMyAdmin

CREATE TABLE contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255) DEFAULT '',
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);

CREATE TABLE newsletter (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active TINYINT DEFAULT 1
);
CREATE INDEX idx_newsletter_email ON newsletter(email);

CREATE TABLE assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  company VARCHAR(255) DEFAULT '',
  answers JSON NOT NULL,
  score INT DEFAULT 0,
  level VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  company VARCHAR(255) DEFAULT '',
  industry VARCHAR(255) DEFAULT '',
  budget VARCHAR(100) DEFAULT '',
  timeline VARCHAR(100) DEFAULT '',
  message TEXT,
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_consultations_status ON consultations(status);

CREATE TABLE solution_builds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  company VARCHAR(255) DEFAULT '',
  steps JSON NOT NULL,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content (
  `key` VARCHAR(255) PRIMARY KEY,
  `value` LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_resets_email ON password_resets(email);

CREATE TABLE visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day VARCHAR(20) NOT NULL,
  path VARCHAR(500) NOT NULL DEFAULT '/',
  language VARCHAR(10) DEFAULT 'en',
  count INT DEFAULT 1,
  UNIQUE KEY uniq_day_path_lang (day, path, language)
);
CREATE INDEX idx_visits_day ON visits(day);

CREATE TABLE chatbot_replies (
  `key` VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL DEFAULT 'intent',
  reply_en LONGTEXT,
  reply_ar LONGTEXT,
  category VARCHAR(255) DEFAULT '',
  image VARCHAR(500) DEFAULT '',
  file VARCHAR(500) DEFAULT '',
  label_en VARCHAR(500) DEFAULT '',
  label_ar VARCHAR(500) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  ip VARCHAR(45) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
```

> **Note:** `key` and `value` are reserved words in MySQL — use backticks.

## Step 4: Connection config

Add to `backend/.env`:

```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=noviq_db
```

## Step 5: New connection file

Create `backend/db/mysql.js`:

```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

module.exports = pool;
```

## Step 6: Adapt queries

Key differences between better-sqlite3 and mysql2:

| SQLite (better-sqlite3) | MySQL (mysql2) |
|---|---|
| `.prepare(sql).all()` | `await pool.execute(sql, params)` → `[rows]` |
| `.prepare(sql).get()` | `(await pool.execute(sql, params))[0]` |
| `.prepare(sql).run(params)` | `await pool.execute(sql, params)` → `[result]` |
| `.exec(sql)` | `await pool.query(sql)` |
| `.transaction(fn)` | `await pool.getConnection()` + `conn.beginTransaction()` |
| synchronous | asynchronous |

### Conversion example

**Before (SQLite):**
```js
const row = db.prepare('SELECT * FROM content WHERE key = ?').get('hero');
db.prepare('INSERT INTO contacts (name, email) VALUES (?, ?)').run(name, email);
```

**After (MySQL):**
```js
const [rows] = await pool.execute('SELECT * FROM content WHERE `key` = ?', ['hero']);
const row = rows[0];
await pool.execute('INSERT INTO contacts (name, email) VALUES (?, ?)', [name, email]);
```

### Files to modify

| File | Change |
|---|---|
| `backend/db/init.js` | Replace with `mysql.js` (or modify to connect to MySQL) |
| `backend/content-store.js` | Make `getContent` and `buildConfigSource` async |
| `backend/routes/index.js` | All `db.prepare` queries → `pool.execute` (requires async/await) |
| `backend/middleware/auth.js` | `admin_users` and `admin_sessions` queries |
| `backend/config.js` | Add DB_TYPE, DB_HOST, etc. settings |

> **Warning:** Converting all queries to async requires making every function in `routes/index.js` `async`. This is significant effort — use search and replace carefully.

## Step 7: Migrate existing data

```bash
# Export from SQLite
sqlite3 backend/data/noviq.db ".dump" > backup.sql

# Then manually edit the SQL to match MySQL syntax
# (AUTOINCREMENT → AUTO_INCREMENT, TEXT → VARCHAR/TEXT, etc.)
# Or use a tool like sqlite3-to-mysql
```

Helper tool:
```bash
npm install -g sqlite3-to-mysql
sqlite3mysql -f backend/data/noviq.db -d noviq_db -u root -p password
```

---

# Option 2: Migrate to Supabase

## Step 1: Create project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Choose a name, a region close to your hosting, and wait for provisioning.
3. Record: `Project URL`, `anon key`, and `service_role key`.

## Step 2: Install package

```bash
cd backend
npm uninstall better-sqlite3
npm install @supabase/supabase-js
```

## Step 3: PostgreSQL Schema

In Supabase → **SQL Editor** run:

```sql
-- Run in Supabase SQL Editor

CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);

CREATE TABLE newsletter (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_newsletter_email ON newsletter(email);

CREATE TABLE assessments (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  answers JSONB NOT NULL,
  score INTEGER DEFAULT 0,
  level TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE consultations (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  timeline TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_consultations_status ON consultations(status);

CREATE TABLE solution_builds (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  company TEXT DEFAULT '',
  steps JSONB NOT NULL,
  summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_password_resets_email ON password_resets(email);

CREATE TABLE visits (
  id SERIAL PRIMARY KEY,
  day TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  language TEXT DEFAULT 'en',
  count INTEGER DEFAULT 1,
  UNIQUE(day, path, language)
);
CREATE INDEX idx_visits_day ON visits(day);

CREATE TABLE chatbot_replies (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'intent',
  reply_en TEXT DEFAULT '',
  reply_ar TEXT DEFAULT '',
  category TEXT DEFAULT '',
  image TEXT DEFAULT '',
  file TEXT DEFAULT '',
  label_en TEXT DEFAULT '',
  label_ar TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- Enable RLS as needed
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

## Step 4: Connection config

Add to `backend/.env`:

```bash
DB_TYPE=supabase
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

> Use **service_role key** in the backend only (bypasses RLS). Never use the anon key server-side.

## Step 5: New connection file

Create `backend/db/supabase.js`:

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

module.exports = supabase;
```

## Step 6: Adapt queries

### Conversion table

| SQLite | Supabase JS |
|---|---|
| `db.prepare('SELECT * FROM contacts WHERE id=?').get(id)` | `const { data } = await supabase.from('contacts').select('*').eq('id', id).single()` |
| `db.prepare('SELECT * FROM contacts').all()` | `const { data } = await supabase.from('contacts').select('*')` |
| `db.prepare('INSERT INTO contacts ...').run(...)` | `const { data } = await supabase.from('contacts').insert({...}).select().single()` |
| `db.prepare('UPDATE contacts SET ... WHERE id=?').run(id)` | `const { data } = await supabase.from('contacts').update({...}).eq('id', id)` |
| `db.prepare('DELETE FROM contacts WHERE id=?').run(id)` | `await supabase.from('contacts').delete().eq('id', id)` |

### Example

**Before:**
```js
const row = db.prepare('SELECT key, value FROM content WHERE key = ?').get(key);
```

**After (Supabase):**
```js
const { data: row } = await supabase
  .from('content')
  .select('key, value')
  .eq('key', key)
  .single();
```

## Step 7: Migrate data

```bash
# Export from SQLite
sqlite3 backend/data/noviq.db ".dump" > dump.sql

# Adjust syntax for PostgreSQL:
#   AUTOINCREMENT → SERIAL
#   INTEGER PRIMARY KEY → SERIAL PRIMARY KEY
#   TEXT → TEXT
#   DATETIME DEFAULT CURRENT_TIMESTAMP → TIMESTAMPTZ DEFAULT NOW()

# Or use a tool:
npx pgloader backend/data/noviq.db "postgresql://user:pass@host:5432/noviq"
```

---

## Comparison

| Criterion | MySQL | Supabase |
|---|---|---|
| Cost | Free on most cPanel hosts | Free tier + paid |
| Shared hosting | Excellent — runs locally | Excellent — fully cloud |
| Performance | Fast locally | Depends on network |
| Setup | Medium — requires query changes | Medium — different API paradigm |
| Backup | Manual / phpMyAdmin | Automatic + Point-in-time |
| RLS / Row-level security | No | Yes |
| Full control | Yes | Limited on free tier |
| Compilation on cPanel | Not needed (pure JS) | Not needed (pure JS) |

**Recommendation:**
- If your cPanel hosting has MySQL ready → **MySQL** (simpler, local, no external dependency).
- If you want a cloud database independent of hosting or to avoid cPanel issues → **Supabase**.

---

## Important Notes

1. **Migration is not automatic:** it requires editing multiple files manually. There is no auto-migration.
2. **Test locally first** before deploying to production.
3. **Take a backup** of `noviq.db` before any change.
4. **JSON in SQLite is stored as TEXT** — in MySQL use `JSON`, in Supabase use `JSONB`.
5. **bcrypt and JWT are unaffected** — they work independently of the database.
6. **`content.config.js`** is generated from the `content` table — ensure it works after migration.

---

## Post-Migration Checklist

- [ ] All tables created
- [ ] Old data imported
- [ ] Default admin works
- [ ] `/api/health` returns ok
- [ ] `/admin` login succeeds
- [ ] Contact form saves
- [ ] Chatbot responds
- [ ] Visit analytics record
- [ ] Site content loads
- [ ] No errors in logs

---

*This guide is a technical reference. Always test in a development environment before deploying to production.*
