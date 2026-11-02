/* ============================================================
   NOVIQ API — ADMIN (JWT required on every route)
   logs · rate-limits · session · upload · stats · system · monitor ·
   analytics · chats · users · exports · settings · content CRUD
   Contracts: contracts/api/{logs,ratelimits,admin,users,export,
   settings,contentadmin}.*
   ============================================================ */
const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/init');
const config = require('../config');
const { adminAuthMiddleware: authMiddleware, generateToken, comparePassword, hashPassword } = require('../middleware/auth');
const { rebuildConfigFile } = require('../services/content-store');
const backup = require('../scripts/backup');
const restore = require('../scripts/restore');
const { validatePromptBuilder } = require('../config/prompt-builder');
const monitor = require('../lib/monitor');
const logs = require('../lib/logger');
const { createLimiter } = require('../config/rate-limit');
/* Purges the Next.js cache after a save so an admin edit is visible on the
   FIRST refresh instead of one ISR window later. Fire-and-forget: the
   response never waits for it and never fails because of it. */
const { purgeFrontendCacheAsync } = require('../lib/revalidate');
const { EMAIL_PATTERN, validateResources, validateTeam, validateSolutionBuilder, validatePricing, validateFaq, validateCareers, validateAbout, validatePages, validateTypewriter, validateObjectFieldNames, strictId, getDictionary, setDictionary, I18N_LOCALES } = require('./_shared');

const router = Router();

/* Admin login brute-force protection: 5 attempts / 10 minutes per IP */
const adminLoginLimiter = createLimiter('admin-login');

router.get('/admin/logs/export', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="admin_logs_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(logs.exportCsv());
});

router.get('/admin/logs', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  res.json({ rows: logs.listLogs(limit) });
});

router.delete('/admin/logs', authMiddleware, (req, res) => {
  const count = logs.clearLogs();
  logs.logEvent('info', 'admin', `Cleared all system logs (${count} entries)`, req);
  res.json({ ok: true, cleared: count });
});

router.delete('/admin/logs/:id', authMiddleware, (req, res) => {
  /* strictId, not parseInt: parseInt('5abc') is 5, so DELETE /logs/5abc would
     remove log 5 — a row the caller never named — and it cannot be undone. */
  const id = strictId(req.params.id);
  if (id === null) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid log id.' } });
  if (!logs.deleteLog(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Log entry not found.' } });
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — RATE LIMITS CONFIG (low defaults: api=10/1min, auth=3/1min, admin-login=2/1min, imagegen=1/1min)
   ------------------------------------------------------------
   GET  /api/admin/rate-limits  → current limits
   PUT  /api/admin/rate-limits  → update limits
   ============================================================ */

const { getLimits, updateLimits } = require('../config/rate-limit');

router.get('/admin/rate-limits', authMiddleware, (req, res) => {
  res.json({ limits: getLimits() });
});

router.put('/admin/rate-limits', authMiddleware, (req, res) => {
  try {
    const newLimits = req.body;
    const updated = updateLimits(newLimits);
    res.json({ ok: true, limits: updated });
  } catch (e) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid limits data.' } });
  }
});

/* ============================================================
   Image generation is implemented once, in
   `services/image-generation.js`, and served by the public route
   GET /api/imagegen (see routes/public.js).

   A duplicate copy of the prompt sanitiser and the Pollinations URL
   builder used to sit here as dead code while the public route called
   `transformPrompt` / `imageVariants` without importing them
   (ReferenceError -> HTTP 500). Both now live in the shared service.
   ============================================================ */

router.post('/admin/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username and password are required.' } });
  }

  /* Admins sign in with their username OR email address (same generic error either way). */
  const identifier = String(username).trim();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(identifier)
    || db.prepare('SELECT * FROM admin_users WHERE email = ? COLLATE NOCASE').get(identifier);
  if (!user || !comparePassword(password, user.password)) {
    logs.logEvent('warning', 'auth', `Failed admin login for "${identifier.slice(0, 64)}"`, req);
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid credentials.' } });
  }

  const token = generateToken({ id: user.id, username: user.username, role: user.role, tokenType: 'admin' });

  db.prepare('INSERT INTO admin_sessions (admin_id, token, ip) VALUES (?, ?, ?)').run(
    user.id, token, req.ip || ''
  );

  logs.logEvent('info', 'auth', `Admin "${user.username}" logged in`, req);

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email || '', role: user.role },
  });
});

router.post('/admin/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  logs.logEvent('info', 'auth', `Admin logged out from ${req.ip || 'unknown ip'}`, req);
  res.json({ message: 'Logged out.' });
});

router.get('/admin/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, created_at FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
  user.email = user.email || '';
  res.json(user);
});

/* Admin updates own username / email / password. Current password is always required.
   Changing the password kills every other active admin session. */

router.put('/admin/profile', authMiddleware, (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body || {};
  if (!currentPassword) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Current password is required to save changes.' } });
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!user || !comparePassword(String(currentPassword), user.password)) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Current password is incorrect.' } });
  }
  const updates = [];
  const params = [];
  if (username !== undefined) {
    const clean = String(username).trim();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(clean)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username must be 3-32 letters, numbers, dots, dashes or underscores.' } });
    const taken = db.prepare('SELECT id FROM admin_users WHERE username = ? AND id != ?').get(clean, user.id);
    if (taken) return res.status(409).json({ error: { code: 'CONFLICT', message: 'That username is already taken.' } });
    updates.push('username = ?'); params.push(clean);
  }
  if (email !== undefined) {
    const clean = String(email).trim();
    if (clean && !EMAIL_PATTERN.test(clean)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' } });
    if (clean) {
      const taken = db.prepare('SELECT id FROM admin_users WHERE email = ? COLLATE NOCASE AND id != ?').get(clean, user.id);
      if (taken) return res.status(409).json({ error: { code: 'CONFLICT', message: 'That email is already in use.' } });
    }
    updates.push('email = ?'); params.push(clean);
  }
  let passwordChanged = false;
  if (newPassword !== undefined && newPassword !== '') {
    if (String(newPassword).length < 8) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters.' } });
    updates.push('password = ?'); params.push(hashPassword(String(newPassword)));
    passwordChanged = true;
  }
  if (!updates.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Nothing to update.' } });
  params.push(user.id);
  db.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  if (passwordChanged) {
    const currentToken = (req.headers.authorization || '').split(' ')[1] || '';
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND token != ?').run(user.id, currentToken);
  }
  logs.logEvent('info', 'auth', `Admin "${user.username}" updated profile`, req);
  const fresh = db.prepare('SELECT id, username, email, role FROM admin_users WHERE id = ?').get(user.id);
  fresh.email = fresh.email || '';
  res.json({ message: 'Profile updated.', user: fresh });
});

router.put('/admin/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Current and new password are required.' } });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!comparePassword(currentPassword, user.password)) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Current password is incorrect.' } });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters.' } });
  }

  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashPassword(newPassword), req.admin.id);
  res.json({ message: 'Password updated.' });
});

/* ============================================================
   12b. ADMIN — TRANSLATIONS (database-backed dictionary)
   ------------------------------------------------------------
   The dictionary lives in the `content` table under `i18n_<locale>`,
   alongside every other admin-editable document: one store, one admin
   surface, and /admin/export carries it automatically.

   Edits are validated (object, leaf strings, size cap) before the single
   write through setDictionary(). Nothing is written to the filesystem, so
   there is no second copy for the site and the admin to disagree about.

   The same row is served to the public site at request time by
   GET /api/content/i18n/:locale (routes/public.js) through the matching
   getDictionary() read, so a saved dictionary reaches visitors without a
   rebuild. Reader and writer are the two halves of one helper in
   routes/_shared.js.
   ============================================================ */

function validateTranslations(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Translations must be an object of sections.';
  const sections = Object.keys(value);
  if (!sections.length || sections.length > 40) return 'Translations must contain 1-40 sections.';
  let leaves = 0;
  const walk = (node, depth) => {
    if (depth > 6) return 'Nesting too deep (max 6).';
    for (const [k, v] of Object.entries(node)) {
      /* Kebab-case is legitimate here: the dictionaries carry sections and
         nav keys like `ai-lab`, so a `[A-Za-z0-9_]`-only rule made EVERY
         save fail with "Invalid key: ai-lab." */
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(k)) return `Invalid key: ${k}.`;
      if (v && typeof v === 'object') {
        const err = walk(v, depth + 1);
        if (err) return err;
      } else if (typeof v !== 'string') {
        return `Leaf ${k} must be a string.`;
      } else if (v.length > 8000) {
        return `Leaf ${k} is too long (max 8000 chars).`;
      } else {
        leaves++;
      }
    }
    return null;
  };
  const err = walk(value, 0);
  if (err) return err;
  if (leaves > 2000) return 'Too many strings (max 2000).';
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 512 * 1024) return 'Translations file is too large.';
  return null;
}

router.get('/admin/i18n/:locale', authMiddleware, (req, res) => {
  const locale = String(req.params.locale || '').toLowerCase();
  if (!I18N_LOCALES.has(locale)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Locale must be en or ar.' } });
  try {
    const value = getDictionary(locale);
    if (!value) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No dictionary stored for this locale.' } });
    res.json({ locale, value });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to read translations: ' + err.message } });
  }
});

router.put('/admin/i18n/:locale', authMiddleware, (req, res) => {
  const locale = String(req.params.locale || '').toLowerCase();
  if (!I18N_LOCALES.has(locale)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Locale must be en or ar.' } });
  const { value } = req.body || {};
  const err = validateTranslations(value);
  if (err) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err } });
  try {
    /* The database is the only place a dictionary is written. No file, no
       mirror, no .bak: those were the second/third/fourth copies, and every
       one of them was a way for the site and the admin to disagree. The
       frontend keeps its own bundled copy purely as an offline fallback. */
    setDictionary(locale, value);
    logs.logEvent('info', 'content', `Admin updated ${locale} translations`, req);
    /* No rebuild: the site reads this row through the public
       GET /content/i18n/:locale endpoint. Purging the frontend cache makes
       the new strings visible on the very next page load; the ISR window
       remains the fallback when the frontend cannot be reached. */
    purgeFrontendCacheAsync('i18n:' + locale);
    res.json({ locale, message: 'Translations saved. Live on the site on the next page load — no rebuild needed.', needsRebuild: false, storage: 'database' });
  } catch (writeErr) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to write translations: ' + writeErr.message } });
  }
});

/* ============================================================
   13. ADMIN — FILE UPLOAD (base64 → frontend uploads folder)
   ============================================================ */

const UPLOAD_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
const UPLOAD_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

router.post('/admin/upload', authMiddleware, (req, res) => {
  const { filename, data } = req.body || {};
  if (!data) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File data is required.' } });

  const match = String(data).match(/^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/);
  const filenameExt = path.extname(String(filename || '')).slice(1).toLowerCase();
  const declaredType = match && match[1].toLowerCase();
  const ext = match && (UPLOAD_TYPES[declaredType] || ((!declaredType || declaredType === 'application/octet-stream') && UPLOAD_EXTENSIONS.has(filenameExt) ? (filenameExt === 'jpeg' ? 'jpg' : filenameExt) : ''));
  if (!match || !ext) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported file. Use PNG, JPG, WebP, GIF, PDF, TXT, CSV, Word, Excel, or PowerPoint.' } });

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File is empty.' } });
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File too large (max 5MB).' } });

  /* Magic-byte verification for images: confirm actual content matches declared type */
  const MAGIC = {
    png:  [0x89, 0x50, 0x4E, 0x47],
    jpg:  [0xFF, 0xD8, 0xFF],
    webp: [0x52, 0x49, 0x46, 0x46],   /* RIFF — check WEBP form at offset 8 */
    gif:  [0x47, 0x49, 0x46, 0x38],   /* GIF8 */
    pdf:  [0x25, 0x50, 0x44, 0x46],   /* %PDF */
  };
  if (MAGIC[ext]) {
    const sig = MAGIC[ext];
    const ok = sig.every((b, i) => buffer[i] === b);
    if (!ok) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File content does not match its extension.' } });
    if (ext === 'webp' && buffer.toString('ascii', 8, 12) !== 'WEBP') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'File content does not match its extension.' } });
    }
  }

  const base = String(filename || 'file').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9_-]/g, '') || 'file';
  const safe = `${Date.now()}-${base}.${ext}`;
  const dir = config.UPLOADS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe), buffer);

  const frontendPath = `images/uploads/${safe}`;
  res.json({ path: frontendPath, mime: match[1].toLowerCase(), message: 'File uploaded.' });
});

/* ============================================================
   14. ADMIN — DASHBOARD STATS, ACTIVITY, SYSTEM, ANALYTICS
   ============================================================ */

router.get('/admin/stats', authMiddleware, (req, res) => {
  const contacts = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const contactsNew = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status = 'new'").get().count;
  const newsletter = db.prepare('SELECT COUNT(*) as count FROM newsletter WHERE active = 1').get().count;
  const consultations = db.prepare('SELECT COUNT(*) as count FROM consultations').get().count;
  const consultationsNew = db.prepare("SELECT COUNT(*) as count FROM consultations WHERE status = 'new'").get().count;
  const assessments = db.prepare('SELECT COUNT(*) as count FROM assessments').get().count;
  const solutions = db.prepare('SELECT COUNT(*) as count FROM solution_builds').get().count;
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  /* The chat counters (chatSessions / chatMessages) went with the Chat Logs
     page on 2026-09-27 — nothing reads chat_messages any more. */
  const today = new Date().toISOString().slice(0, 10);
  const visitsToday = db.prepare('SELECT COALESCE(SUM(count),0) as count FROM visits WHERE day = ?').get(today).count;
  const visitsTotal = db.prepare('SELECT COALESCE(SUM(count),0) as count FROM visits').get().count;

  res.json({
    contacts,
    contactsNew,
    newsletter,
    consultations,
    consultationsNew,
    assessments,
    solutions,
    users,
    visitsToday,
    visitsTotal,
  });
});

router.get('/admin/recent-activity', authMiddleware, (req, res) => {
  const recentContacts = db.prepare('SELECT id, name, email, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 5').all();
  const recentConsultations = db.prepare('SELECT id, name, email, industry, status, created_at FROM consultations ORDER BY created_at DESC LIMIT 5').all();
  const recentNewsletter = db.prepare('SELECT id, email, subscribed_at FROM newsletter WHERE active = 1 ORDER BY subscribed_at DESC LIMIT 5').all();
  const recentAssessments = db.prepare('SELECT id, name, score, level, created_at FROM assessments ORDER BY created_at DESC LIMIT 5').all();

  res.json({ recentContacts, recentConsultations, recentNewsletter, recentAssessments });
});

router.get('/admin/system', authMiddleware, (req, res) => {
  const dbBytes = fs.existsSync(config.DB_PATH) ? fs.statSync(config.DB_PATH).size : 0;
  const tables = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'").get().count;

  res.json({
    status: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    databaseBytes: dbBytes,
    tables,
    nodeVersion: process.version,
    environment: config.NODE_ENV,
    checkedAt: new Date().toISOString(),
  });
});

/* Live performance & error monitor (in-memory, no DB writes) */

router.get('/admin/monitor', authMiddleware, (req, res) => {
  res.json(monitor.snapshot(60));
});

router.post('/admin/monitor/reset', authMiddleware, (req, res) => {
  monitor.reset();
  res.json({ message: 'Monitor data cleared.' });
});

/* Visits analytics summary (30-day series, top pages, per-language) */

router.get('/admin/analytics', authMiddleware, (req, res) => {
  const days = db.prepare(`
    SELECT day, SUM(count) AS visits FROM visits
    GROUP BY day ORDER BY day DESC LIMIT 30
  `).all();
  const topPages = db.prepare(`
    SELECT path, SUM(count) AS visits FROM visits
    GROUP BY path ORDER BY visits DESC LIMIT 10
  `).all();
  const byLanguage = db.prepare(`
    SELECT language, SUM(count) AS visits FROM visits GROUP BY language
  `).all();
  res.json({ days, topPages, byLanguage });
});

/* ============================================================
   15. ADMIN — CHAT LOGS  (removed 2026-09-27)
   ------------------------------------------------------------
   The dashboard's Chat Logs page and its four endpoints
   (/admin/chats, /admin/chats-export, /admin/chats/:sessionId
   GET + DELETE) were removed with the chat feature. The
   chat_messages table and the data in it were left alone —
   see db/init.js. Nothing writes to it any more, so it is
   inert; drop it by hand if the history is not wanted.
   ============================================================ */

/* ============================================================
   16. ADMIN — REGISTERED USERS
   ============================================================ */

router.get('/admin/users', authMiddleware, (req, res) => {
  const users = db.prepare(
    'SELECT id, first_name, last_name, email, phone, avatar, role, created_at FROM users ORDER BY created_at DESC LIMIT 500'
  ).all();
  res.json(users);
});

router.delete('/admin/users/:id', authMiddleware, (req, res) => {
  /* strictId: this id goes straight into the DELETE, unguarded until now. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid user id.' } });
  }
  /* The dependent tables (requests, projects, contracts, notifications,
     messages) are removed by ON DELETE CASCADE, not by hand, so this cannot
     fall out of step with a table added later. */
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
  res.json({ message: 'User deleted.' });
});

/* Admin sets a new password for a site user (e.g. support reset). Minimum 8 characters. */

router.put('/admin/users/:id/password', authMiddleware, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters.' } });
  }
  const result = db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashPassword(String(newPassword)), strictId(req.params.id) ?? -1);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
  logs.logEvent('info', 'users', `Admin reset password for user #${req.params.id}`, req);
  res.json({ message: 'User password updated.' });
});

/* ============================================================
   17. ADMIN — DATA EXPORTS
   ============================================================ */

/* ============================================================
   17b. ADMIN — BACKUP (archive with the database AND the images)

   Distinct from /admin/export below, which is a JSON dump of the lead
   tables. This is a restorable archive: every table plus every uploaded
   image at its original relative path, so restoring puts a record's
   `images/uploads/<name>` back where the record expects it with no
   rewriting and no database edit.

   GET    /api/admin/backup            -> the .zip (streams to disk)
   GET    /api/admin/backup/inspect    -> what an upload would do, no writes
   POST   /api/admin/backup/restore    -> apply an uploaded .zip

   The restore path is deliberately awkward to trigger by accident:
   it needs an explicit `confirm` token, it always writes a pre-restore
   safety copy of the database first, and it runs in a transaction. A
   mis-click in the dashboard must not be able to destroy a live site.
   ============================================================ */

/* A restore replaces everything, so it is capped by the same ceiling the
   uploader enforces: an archive claiming to hold hundreds of megabytes is
   either not our archive or an attempt to exhaust the container's disk. */
/* A restore replaces everything, so it is capped. The cap must account for
 * base64 inflation (4/3) AND for the JSON envelope, and it has to sit UNDER
 * express.json's body limit or the request is rejected by the parser before
 * any handler runs.
 *
 * That was the bug: the cap was 64 MB while app.js sets `limit: '8mb'`, so a
 * real 7.2 MB archive arrived as a ~9.6 MB base64 string and every inspect
 * and restore died with 413 from the parser — reported by the dashboard as
 * "the upload failed" with nothing to act on.
 *
 * express.json is mounted globally, so it cannot be raised per-route. Instead
 * the JSON limit is raised once, globally, to accommodate this one endpoint
 * (see app.js), and this constant stays the real ceiling the handler enforces
 * after parsing. 48 MB decoded ≈ 64 MB base64 ≈ just under that. */
const MAX_BACKUP_UPLOAD = 48 * 1024 * 1024;

/* ============================================================
   17c. ADMIN — BACKUP HISTORY (stored server-side copies)

   Downloading alone left "the backup system empty": every archive went
   straight to the operator's disk and the server kept nothing, so there
   was no list, nothing to restore from, and no evidence any backup ever
   ran. Every download now also persists a timestamped server copy, and
   the three routes below manage that history (list / download / delete)
   with the same retention cap. The admin page renders the history table
   from GET /backups — that table IS the visible backup system.

   The storage mechanics live in lib/backup-store.js (shared with the
   scheduled writer in lib/auto-backup.js); only the HTTP layer is here.
   ============================================================ */
const {
  BACKUP_KEEP,
  BACKUP_DAYS,
  dayKey,
  backupNameOK,
  backupFilePath,
  listStoredBackups,
  createStoredBackup,
} = require('../lib/backup-store');

router.get('/admin/backups', authMiddleware, (req, res) => {
  /* autoBackupHours tells the history header whether scheduled copies are
     on (and every how many hours) or off — otherwise the UI can only guess
     from gaps in the timestamps. Read lazily so tests can stub the env. */
  let autoBackupHours = 24;
  try {
    autoBackupHours = require('../lib/auto-backup').hours();
  } catch {}
  const backups = listStoredBackups();
  res.json({
    backups,
    keep: BACKUP_KEEP,
    /* The cap alone would let a busy day evict every older day, so the store
       also guarantees one copy per day for the last BACKUP_DAYS days. The UI
       states both rules rather than implying "the newest 10 always survive". */
    keepDays: BACKUP_DAYS,
    /* Which calendar days are currently represented, newest first — the panel
       shows this so an operator can see the coverage they actually have. */
    days: [...new Set(backups.map((b) => dayKey(b.createdAt)))].slice(0, BACKUP_DAYS),
    autoBackupHours,
  });
});

router.get('/admin/backups/:name', authMiddleware, (req, res) => {
  if (!backupNameOK(req.params.name)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid backup name.' } });
  }
  const full = backupFilePath(req.params.name);
  if (!full || !fs.existsSync(full)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Backup not found.' } });
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
  fs.createReadStream(full).pipe(res);
});

router.delete('/admin/backups/:name', authMiddleware, (req, res) => {
  if (!backupNameOK(req.params.name)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid backup name.' } });
  }
  const full = backupFilePath(req.params.name);
  if (!full || !fs.existsSync(full)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Backup not found.' } });
  }
  try {
    fs.unlinkSync(full);
    res.json({ ok: true, deleted: req.params.name });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not delete backup: ' + err.message } });
  }
});

router.get('/admin/backup', authMiddleware, (req, res) => {
  try {
    /* A missing database used to kill the whole server: backup.main calls
       process.exit(1) when the file is absent, and this route runs inside
       the server process. Guard here so the worst case is a 500 JSON. */
    if (!fs.existsSync(config.DB_PATH)) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Database file not found, backup refused.' } });
    }
    /* Stored copy AND download are the same file: build once into the
       history dir with a timestamped name, stream those bytes, keep the
       file. The history table is what makes the backup system non-empty.
       Millisecond stamp PLUS random suffix: two downloads in the same
       millisecond (double-click, retry) must not overwrite each other —
       without the suffix the second silently eats the first.
       createStoredBackup() also verifies the archive and prunes, so a
       corrupt build can never join history. */
    const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' +
      Math.random().toString(36).slice(2, 8);
    let file;
    try {
      file = createStoredBackup(stamp);
    } catch (err) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Backup failed: ' + err.message } });
    }

    /* The upload endpoint accepts a data URL, so the whole archive has to
       arrive as one string. 64 MB of base64 is ~85 MB, which is why the
       limit below is checked on the decoded size. Oversize is the one case
       where the just-stored copy is removed again — serving it would fail
       the restore upload later anyway. */
    const buf = fs.readFileSync(file);
    if (buf.length > MAX_BACKUP_UPLOAD) {
      try { fs.unlinkSync(file); } catch {}
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: `Backup is ${(buf.length / 1048576).toFixed(1)} MB; the limit is ${MAX_BACKUP_UPLOAD / 1048576} MB.` } });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file)}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (err) {
    console.error('[backup] failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Backup failed: ' + err.message } });
  }
});

/** Dry-run: validate an uploaded archive and describe the plan. */
router.post('/admin/backup/inspect', authMiddleware, (req, res) => {
  const raw = readUploadedZip(req);
  if (raw.error) return res.status(raw.status).json({ error: { code: raw.code, message: raw.message } });

  try {
    const files = restore.unzip(raw.buf);
    const manifestRaw = files.get('manifest.json');
    if (!manifestRaw) {
      return res.status(400).json({ error: { code: 'INVALID_ARCHIVE', message: 'No manifest.json — this is not a Noviq backup.' } });
    }
    const manifest = JSON.parse(manifestRaw.toString('utf8'));
    if (manifest.format !== 'noviq-backup') {
      return res.status(400).json({ error: { code: 'INVALID_ARCHIVE', message: `Unexpected format: ${manifest.format}` } });
    }

    const liveColumns = new Map(
      Object.keys(manifest.tables || {}).map((t) => [
        t,
        db.prepare(`PRAGMA table_info(${backup.quoteIdent(t)})`).all().map((c) => c.name),
      ])
    );

    const tables = Object.entries(manifest.tables || {}).map(([name, meta]) => {
      const live = liveColumns.get(name);
      const missing = live ? meta.columns.filter((c) => !live.includes(c)) : meta.columns;
      return {
        name,
        rows: meta.rows,
        compatible: !!live && missing.length === 0,
        /* A table with no CREATE TABLE in the archive cannot be built on a
           target that lacks it, so it is reported rather than skipped. */
        note: !live ? 'not present in this install — will be skipped'
          : missing.length ? `missing columns here: ${missing.join(', ')}`
          : null,
      };
    });

    const images = [...files.keys()].filter((n) => n.startsWith('images/uploads/')).length;

    res.json({
      ok: true,
      createdAt: manifest.createdAt,
      tables,
      images,
      bytes: raw.buf.length,
      /* Restoring REPLACES: rows added after the archive was taken are
         removed. Say so before the operator clicks. */
      destructive: true,
      restorable: tables.every((t) => t.compatible || t.note?.startsWith('not present')),
    });
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_ARCHIVE', message: 'Could not read the archive: ' + err.message } });
  }
});

/** Apply an uploaded archive. Requires confirm === 'REPLACE'. */
router.post('/admin/backup/restore', authMiddleware, (req, res) => {
  if (req.body?.confirm !== 'REPLACE') {
    return res.status(400).json({
      error: { code: 'CONFIRMATION_REQUIRED', message: 'A restore replaces all data. Resend with confirm: "REPLACE".' },
    });
  }

  const raw = readUploadedZip(req);
  if (raw.error) return res.status(raw.status).json({ error: { code: raw.code, message: raw.message } });

  /* Safety copy before anything is touched. Without this, a bad archive
     is unrecoverable — the whole point of the feature is that it can be
     used when the data is already suspect. */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safety = `${config.DB_PATH}.pre-restore-${stamp}`;
  try {
    fs.copyFileSync(config.DB_PATH, safety);
    /* No wal_checkpoint here. This route runs INSIDE the server process, and
       db (db/init.js) holds a live connection to DB_PATH — opening a second
       connection to checkpoint it fails with EBUSY on Windows and would fail
       on a volume-backed container too.
       The safety copy is therefore taken WITHOUT checkpointing, which means
       it can be missing recent WAL-only writes. That is why the copy is
       only a fallback, never the mechanism: restore.js takes its own
       checkpointed copy at the point it is about to write, from a fresh
       process context where the lock is available. */
  } catch (err) {
    return res.status(500).json({ error: { code: 'BACKUP_FAILED', message: 'Could not write the safety copy, so nothing was changed: ' + err.message } });
  }

  const tmp = path.join(require('os').tmpdir(), `noviq-restore-${stamp}.zip`);
  try {
    fs.writeFileSync(tmp, raw.buf);

    /* main() re-validates the manifest and refuses an incompatible schema
       before it opens a transaction. `--apply --yes` is supplied because the
       caller already passed the CONFIRMATION_REQUIRED gate above, and
       throwOnError turns its terse exits into catchable errors so a failed
       restore returns 400 instead of taking the process down mid-request. */
    const result = restore.main([tmp], { apply: true, yes: true, quiet: true, throwOnError: true });

    res.json({
      ok: true,
      restoredTables: result.plan.filter((p) => p.action === 'replace').map((p) => p.table),
      skipped: result.plan.filter((p) => p.action !== 'replace').map((p) => p.table),
      images: result.images,
      safetyCopy: path.basename(safety),
      /* The running process still holds the pre-restore snapshot in
         memory. Saying so beats a dashboard that looks unchanged. */
      notice: 'Restart the API service to serve the restored data.',
    });
  } catch (err) {
    res.status(400).json({ error: { code: 'RESTORE_FAILED', message: err.message, safetyCopy: path.basename(safety) } });
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

/** The archive arrives as a data URL (same convention as /admin/upload). */
function readUploadedZip(req) {
  const data = req.body?.data;
  if (!data) {
    return { error: true, status: 400, code: 'VALIDATION_ERROR', message: 'Archive data is required.' };
  }
  const m = String(data).match(/^data:[^;,]*;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) {
    return { error: true, status: 400, code: 'VALIDATION_ERROR', message: 'Expected a base64 data URL.' };
  }
  const buf = Buffer.from(m[1], 'base64');
  if (!buf.length) {
    return { error: true, status: 400, code: 'VALIDATION_ERROR', message: 'Archive is empty.' };
  }
  if (buf.length > MAX_BACKUP_UPLOAD) {
    return { error: true, status: 413, code: 'PAYLOAD_TOO_LARGE', message: `Archive is ${(buf.length / 1048576).toFixed(1)} MB; the limit is ${MAX_BACKUP_UPLOAD / 1048576} MB.` };
  }
  return { buf };
}

router.get('/admin/export', authMiddleware, (req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    contacts: db.prepare('SELECT * FROM contacts ORDER BY id').all(),
    newsletter: db.prepare('SELECT * FROM newsletter ORDER BY id').all(),
    assessments: db.prepare('SELECT * FROM assessments ORDER BY id').all(),
    consultations: db.prepare('SELECT * FROM consultations ORDER BY id').all(),
    solutionBuilds: db.prepare('SELECT * FROM solution_builds ORDER BY id').all(),
    content: db.prepare('SELECT key, value, updated_at FROM content ORDER BY key').all(),
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="noviq-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(payload);
});

/* ============================================================
   18. ADMIN — SITE CONTENT CRUD
   ============================================================ */

const OBJECT_KEYS = ['brand', 'hero', 'servicesHeader', 'whyHeader', 'industriesHeader', 'portfolioHeader', 'processHeader', 'testimonialsHeader', 'stackHeader', 'contact', 'footer', 'clientsHeader', 'promptBuilder', 'resources', 'team', 'solutionBuilder', 'costEstimator', 'assessment', 'aiConsultant', 'pricing', 'faq', 'careers', 'about', 'pages', 'typewriter', 'auth',
  /* Hero visuals: the WebGL black hole and the header logo. Both were
     hardcoded in their components, which made them the most expensive
     decoration on the site to change. Seeded with the shipped values, so
     adding the keys changed nothing about the picture. */
  'heroBlackhole', 'logo'];
const ARRAY_KEYS = ['nav', 'stats', 'services', 'why', 'industries', 'projects', 'process', 'testimonials', 'stack', 'clients', 'solutions'];
const ALL_KEYS = [...OBJECT_KEYS, ...ARRAY_KEYS];

/* ============================================================
   18b. ADMIN — SITE SETTINGS (motion, perf, etc.)
   ============================================================ */

const VALID_MOTION_MODES = new Set(['full', 'auto-reduce-low-tier', 'always-reduce', 'off']);

router.get('/admin/settings', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  res.json(result);
});

router.put('/admin/settings/motion', authMiddleware, (req, res) => {
  const { mode, reductionLevel } = req.body || {};
  if (!VALID_MOTION_MODES.has(mode)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `mode must be one of: ${[...VALID_MOTION_MODES].join(', ')}` } });
  }
  const level = Math.min(100, Math.max(0, parseInt(reductionLevel, 10) || 0));
  const value = JSON.stringify({ mode, reductionLevel: level });
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP').run('motion', value);
  const sync = rebuildConfigFile();
  res.json({ motion: { mode, reductionLevel: level }, message: 'Motion settings updated.', fileWritten: sync.fileWritten !== false, ...(sync.fileWritten === false ? { fileWarning: 'Saved to database, but static file sync failed: ' + (sync.fileError || 'check FRONTEND_DIR permissions') } : {}) });
});

router.get('/admin/content', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value, updated_at FROM content').all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  res.json(result);
});

/* /keys must be declared before /:key */

router.get('/admin/content/keys', authMiddleware, (req, res) => {
  res.json(ALL_KEYS);
});

router.post('/admin/content/rebuild', authMiddleware, (req, res) => {
  try {
    const result = rebuildConfigFile();
    /* The rebuild republishes every key, so purge the whole CMS cache. */
    purgeFrontendCacheAsync('content-rebuild');
    if (result.fileWritten === false) {
      return res.status(207).json({ message: 'Database is current, but static file sync failed.', keys: result.keys, fileWritten: false, fileError: result.fileError });
    }
    res.json({ message: 'Content config rebuilt successfully.', keys: result.keys, fileWritten: true });
  } catch (err) {
    console.error('[Content Rebuild] Error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to rebuild content config.' } });
  }
});

/* POST /admin/content/promptBuilder/reset was removed on 2026-09-27 with the
   Image Prompt Builder page — the dashboard had no other caller. The content
   key itself is untouched: /api/content still serves it to the public site and
   the PUT branch below still validates it, so the stored configuration and
   the image-generation service are unaffected. */

router.get('/admin/content/:key', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT value, updated_at FROM content WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found.' } });
  try { res.json({ key: req.params.key, value: JSON.parse(row.value), updated_at: row.updated_at }); }
  catch { res.json({ key: req.params.key, value: row.value, updated_at: row.updated_at }); }
});

router.put('/admin/content/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  if (!ALL_KEYS.includes(key)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Invalid key. Must be one of: ${ALL_KEYS.join(', ')}` } });
  }

  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Value is required.' } });
  }

  let normalizedValue = value;
  /* Field names are policed for every object-shaped section, including the ones
     with a dedicated validator below: a rejected name there would surface as a
     confusing downstream error instead of a clear one. Runs first so a bad name
     is reported before any other validation. */
  const nameCheck = validateObjectFieldNames(value);
  if (nameCheck && nameCheck.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: nameCheck.error } });

  if (key === 'promptBuilder') {
    const validated = validatePromptBuilder(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    const current = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
    if (current) {
      try {
        const revision = JSON.parse(current.value).revision || 1;
        if ((validated.value.revision || 1) !== revision) return res.status(409).json({ error: { code: 'CONFLICT', message: 'Prompt Builder was updated elsewhere. Reload and try again.' } });
        validated.value.revision = revision + 1;
      } catch {}
    }
    normalizedValue = validated.value;
  } else if (key === 'resources') {
    const validated = validateResources(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'team') {
    const validated = validateTeam(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'solutionBuilder') {
    const validated = validateSolutionBuilder(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'pricing') {
    const validated = validatePricing(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'faq') {
    const validated = validateFaq(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'careers') {
    const validated = validateCareers(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'about') {
    const validated = validateAbout(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'pages') {
    const validated = validatePages(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  } else if (key === 'typewriter') {
    const validated = validateTypewriter(value);
    if (validated.error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validated.error } });
    normalizedValue = validated.value;
  }
  const valueStr = typeof normalizedValue === 'object' ? JSON.stringify(normalizedValue) : String(normalizedValue);

  const existing = db.prepare('SELECT key FROM content WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(valueStr, key);
  } else {
    db.prepare('INSERT INTO content (key, value) VALUES (?, ?)').run(key, valueStr);
  }

  /* DB save is authoritative (live /data/content.config.js reads from DB).
     File sync is best-effort for separately-hosted frontends. */
  const sync = rebuildConfigFile();
  /* Purge the frontend cache so the edit shows on the next page load. */
  purgeFrontendCacheAsync('content:' + key);
  res.json({ key, value: normalizedValue, message: 'Content updated successfully.', fileWritten: sync.fileWritten !== false, ...(sync.fileWritten === false ? { fileWarning: 'Saved to database and live on co-hosted site, but static file sync failed: ' + (sync.fileError || 'check FRONTEND_DIR') } : {}) });
});

router.put('/admin/content/:key/array', authMiddleware, (req, res) => {
  const { key } = req.params;
  if (!ARRAY_KEYS.includes(key)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Key must be an array type. Valid: ${ARRAY_KEYS.join(', ')}` } });
  }

  const { index, item } = req.body;
  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found.' } });

  let arr;
  try { arr = JSON.parse(row.value); } catch { return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to parse existing data.' } }); }

  if (index !== undefined && index !== null) {
    if (index < 0 || index >= arr.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Index out of range.' } });
    arr[index] = item;
  } else {
    arr.push(item);
  }

  db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(JSON.stringify(arr), key);
  const syncArr = rebuildConfigFile();
  purgeFrontendCacheAsync('content-array:' + key);
  res.json({ key, value: arr, message: 'Array item updated.', fileWritten: syncArr.fileWritten !== false, ...(syncArr.fileWritten === false ? { fileWarning: 'Saved to database, static file sync failed: ' + (syncArr.fileError || '') } : {}) });
});

router.delete('/admin/content/:key/array/:index', authMiddleware, (req, res) => {
  const { key, index } = req.params;
  const idx = parseInt(index);
  if (!ARRAY_KEYS.includes(key)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Key must be an array type.' } });

  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found.' } });

  let arr;
  try { arr = JSON.parse(row.value); } catch { return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to parse data.' } }); }
  if (idx < 0 || idx >= arr.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Index out of range.' } });

  arr.splice(idx, 1);
  db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(JSON.stringify(arr), key);
  const syncDel = rebuildConfigFile();
  purgeFrontendCacheAsync('content-array-delete:' + key);
  res.json({ key, value: arr, message: 'Item removed.', fileWritten: syncDel.fileWritten !== false, ...(syncDel.fileWritten === false ? { fileWarning: 'Saved to database, static file sync failed: ' + (syncDel.fileError || '') } : {}) });
});

module.exports = router;
