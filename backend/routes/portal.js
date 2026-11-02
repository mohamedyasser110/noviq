/* ============================================================
   NOVIQ API — CLIENT PORTAL (signed-in dashboard)
   ------------------------------------------------------------
   Everything a signed-in user reads about their own work, plus the small
   amount of admin surface needed to populate it.

     GET    /api/portal/me                 who am I, and what is unread
     GET    /api/portal/projects           my projects + milestones
     GET    /api/portal/projects/:id       one project (owned only)
     GET    /api/portal/contracts          my contracts
     GET    /api/portal/notifications      my feed (scoped + broadcast)
     POST   /api/portal/notifications/:id/read
     POST   /api/portal/contact            message the team (no mail needed)
     GET    /api/portal/profile            my contact data (incl. phone)
     PUT    /api/portal/profile            edit my name + phone
     GET    /api/portal/messages           my thread (marks team rows read)
     POST   /api/portal/messages           write in my thread

     --- admin side, populates the above ---
     GET    /api/admin/portal/projects     every project
     POST   /api/admin/portal/projects     create
     PUT    /api/admin/portal/projects/:id update (incl. status)
     DELETE /api/admin/portal/projects/:id delete (cascades milestones+contracts)
     POST   /api/admin/portal/projects/:id/milestones
     PUT    /api/admin/portal/milestones/:id
     DELETE /api/admin/portal/milestones/:id
     POST   /api/admin/portal/contracts    attach a contract
     PUT    /api/admin/portal/contracts/:id update a contract (status notifies)
     POST   /api/admin/portal/notifications broadcast / target one user
     GET    /api/admin/portal/messages     every client thread (unread counts)
     GET    /api/admin/portal/messages/:userId one thread (marks client rows read)
     POST   /api/admin/portal/messages     reply as the team (+notification)

   THE ONE RULE THAT MATTERS HERE
   Every read is scoped by `user_id = req.user.id`. Ownership is never taken
   from the request body or a query parameter — an authenticated user asking
   for /projects/7 must get their own project 7 or a 404, never someone
   else's. Returning 404 rather than 403 for "not yours" is intentional: a
   403 confirms the row exists, which is an enumeration oracle. This is
   asserted directly in tests/portal.test.js.
   ============================================================ */
const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/init');
const config = require('../config');
const { userAuthMiddleware, userOrAdminMiddleware } = require('../middleware/portal-auth');
const { adminAuthMiddleware } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { EMAIL_PATTERN } = require('./_shared');
const { strictId, validateObjectFieldNames } = require('./_shared');

const router = Router();

const PROJECT_STATUSES = new Set(['planning', 'active', 'on-hold', 'completed', 'cancelled']);
const MILESTONE_STATUSES = new Set(['pending', 'in-progress', 'blocked', 'done']);
const CONTRACT_STATUSES = new Set(['draft', 'sent', 'signed', 'active', 'completed', 'cancelled']);
const NOTIFICATION_TYPES = new Set(['news', 'project', 'contract', 'message']);

/* ---------- shared helpers ---------- */

function str(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function int(v, { min = 0, max = 100, dflt = 0 } = {}) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

/** YYYY-MM-DD or ''. Anything else is dropped rather than stored, so date
 *  comparisons in SQL never have to cope with free text. */
function dateStr(v) {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Roll milestone progress up into projects.progress_percent, weighted.
 * Called on every milestone create/update/delete so the denormalised
 * headline number cannot drift from its source.
 */
function recalcProjectProgress(projectId) {
  const rows = db
    .prepare('SELECT progress, weight FROM milestones WHERE project_id = ?')
    .all(projectId);
  if (!rows.length) {
    db.prepare(
      "UPDATE projects SET progress_percent = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(projectId);
    return 0;
  }
  const totalWeight = rows.reduce((s, r) => s + Math.max(1, r.weight), 0);
  const weighted = rows.reduce((s, r) => s + Math.max(0, Math.min(100, r.progress)) * Math.max(1, r.weight), 0);
  const pct = Math.round(weighted / totalWeight);
  db.prepare('UPDATE projects SET progress_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pct, projectId);
  return pct;
}

function projectWithMilestones(project) {
  const milestones = db
    .prepare('SELECT id, title, description, progress, weight, status, due_date, position, completed_at FROM milestones WHERE project_id = ? ORDER BY position, id')
    .all(project.id);
  return {
    id: project.id,
    name: project.name,
    summary: project.summary,
    status: project.status,
    progress: project.progress_percent,
    startDate: project.start_date,
    targetDate: project.target_date,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      progress: m.progress,
      weight: m.weight,
      status: m.status,
      dueDate: m.due_date,
      position: m.position,
      completedAt: m.completed_at,
    })),
  };
}

/* ============================================================
   CLIENT SIDE — all scoped to req.user.id
   ============================================================ */

router.get('/portal/me', userAuthMiddleware, (req, res) => {
  const unread = db
    .prepare(
      `SELECT count(*) AS n FROM notifications nt
       WHERE (nt.user_id = ? OR nt.user_id IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM notification_reads nr
           WHERE nr.notification_id = nt.id AND nr.user_id = ?
         )`
    )
    .get(req.user.id, req.user.id).n;

  /* Chat messages join the same badge: an unread team reply is as
     badge-worthy as an announcement. Reported separately too, so the
     dashboard can label each count honestly. */
  const unreadMessages = db.prepare(
    "SELECT count(*) AS n FROM client_messages WHERE user_id = ? AND sender = 'admin' AND is_read = 0"
  ).get(req.user.id).n;

  const projectCount = db.prepare('SELECT count(*) AS n FROM projects WHERE user_id = ?').get(req.user.id).n;
  const contractCount = db.prepare('SELECT count(*) AS n FROM contracts WHERE user_id = ?').get(req.user.id).n;

  res.json({
    user: req.user,
    unread: unread + unreadMessages,
    unreadMessages,
    counts: { projects: projectCount, contracts: contractCount },
  });
});

router.get('/portal/projects', userAuthMiddleware, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json({ projects: rows.map(projectWithMilestones) });
});

router.get('/portal/projects/:id', userAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  /* user_id in the WHERE, not just in JS: ownership is enforced by the
     query, so there is no window where another user's row is loaded and
     then filtered. */
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!project) {
    /* 404 not 403 — see the header note on enumeration. */
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
  }
  const contracts = db
    .prepare('SELECT id, title, reference, value_cents, currency, status, signed_at, starts_on, ends_on, notes, file FROM contracts WHERE project_id = ? AND user_id = ? ORDER BY id')
    .all(id, req.user.id);
  res.json({ project: projectWithMilestones(project), contracts: contracts.map((c) => ({ ...c, file: c.file || '' })) });
});

router.get('/portal/contracts', userAuthMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.project_id, c.title, c.reference, c.value_cents, c.currency,
              c.status, c.signed_at, c.starts_on, c.ends_on, c.notes, c.file, p.name AS project_name
       FROM contracts c
       LEFT JOIN projects p ON p.id = c.project_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all(req.user.id);
  res.json({ contracts: rows.map(mapContract) });
});

function mapContract(c) {
  return {
    id: c.id,
    projectId: c.project_id,
    projectName: c.project_name || '',
    title: c.title,
    reference: c.reference,
    /* cents -> a decimal string, so the client never does float math */
    value: (c.value_cents / 100).toFixed(2),
    currency: c.currency,
    status: c.status,
    signedAt: c.signed_at,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    notes: c.notes,
    /* Attachment path (or '') — always relative, served from /images/. */
    file: c.file || '',
  };
}

/* Contract attachments must be files WE served: a relative uploads path
   with a document/image extension. Absolute URLs, traversal (..) and
   anything outside images/uploads/ is rejected — otherwise a contract
   could point the client dashboard at an arbitrary third-party URL. */
function contractFileOk(v) {
  if (v === undefined || v === null || v === '') return '';
  const s = String(v).trim();
  if (!/^images\/uploads\/[A-Za-z0-9._-]+\.(pdf|png|jpe?g|webp|gif)$/i.test(s)) return null;
  if (s.includes('..')) return null;
  return s;
}

router.get('/portal/notifications', userAuthMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT nt.id, nt.user_id, nt.type, nt.title, nt.body, nt.link, nt.created_at,
              nr.read_at
       FROM notifications nt
       LEFT JOIN notification_reads nr
         ON nr.notification_id = nt.id AND nr.user_id = ?
       WHERE nt.user_id = ? OR nt.user_id IS NULL
       ORDER BY nt.created_at DESC, nt.id DESC
       LIMIT 50`
    )
    .all(req.user.id, req.user.id);

  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.created_at,
      read: Boolean(n.read_at),
      /* whether it was addressed to this user or broadcast to everyone */
      scope: n.user_id === null ? 'broadcast' : 'personal',
    })),
    unread: rows.filter((n) => !n.read_at).length,
  });
});

router.post('/portal/notifications/:id/read', userAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const notification = db
    .prepare('SELECT id, user_id FROM notifications WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
    .get(id, req.user.id);
  if (!notification) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
  }
  db.prepare(
    'INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)'
  ).run(id, req.user.id);
  res.json({ ok: true });
});

/* Mark every visible notification read in one call (the dashboard's
   "Mark all read"). INSERT OR IGNORE makes it naturally idempotent —
   already-read rows are simply skipped. Returns how many flipped. */
router.post('/portal/notifications/read-all', userAuthMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT nt.id FROM notifications nt
     WHERE (nt.user_id = ? OR nt.user_id IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM notification_reads nr
         WHERE nr.notification_id = nt.id AND nr.user_id = ?
       )`
  ).all(req.user.id, req.user.id);
  const ins = db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)');
  let marked = 0;
  for (const r of rows) {
    if (ins.run(r.id, req.user.id).changes > 0) marked++;
  }
  res.json({ ok: true, marked });
});

/** Contact the team from inside the dashboard. Persists to `contacts` — the
 *  same table the public form uses, so one inbox sees both — and emails the
 *  team when SMTP is configured. Never fails on the mail path: a dashboard
 *  message that is saved but not mailed is still delivered. */
router.post('/portal/contact', userAuthMiddleware, async (req, res) => {
  const message = str(req.body?.message, 5000);
  if (!message) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message is required.' } });
  }

  const result = db
    .prepare('INSERT INTO contacts (name, email, phone, company, message, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email,
      req.user.email,
      '',
      '',
      message,
      'new'
    );

  /* Stored as a personal notification too, so the sender sees their own
     message acknowledged in the same feed they read for news. */
  try {
    const info = db
      .prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'message', ?, ?, ?)")
      .run(
        req.user.id,
        'Message received',
        message.length > 160 ? `${message.slice(0, 157)}…` : message,
        `/${'en'}/account`
      );
    db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)')
      .run(info.lastInsertRowid, req.user.id);
  } catch { /* non-critical */ }

  let emailed = false;
  if (config.NOTIFY_EMAIL) {
    try {
      emailed = await sendMail(
        config.NOTIFY_EMAIL,
        `Portal message from ${req.user.email}`,
        `From: ${req.user.email}\n\n${message}`
      );
    } catch { /* saved to the inbox regardless */ }
  }

  res.status(201).json({ ok: true, id: result.lastInsertRowid, emailed });
});

/* ============================================================
   CLIENT PROFILE — the client edits their own contact data
   ------------------------------------------------------------
   Email is the identity (login + ownership key) and is immutable here;
   name and phone are editable. Phone lives in users.phone (added by
   migration in db/init.js). Returns the updated user shape so the
   dashboard can re-render without another round-trip.
   ============================================================ */
router.get('/portal/profile', userAuthMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.put('/portal/profile', userAuthMiddleware, (req, res) => {
  const firstName = req.body?.firstName !== undefined ? str(req.body.firstName, 80) : req.user.firstName;
  const lastName = req.body?.lastName !== undefined ? str(req.body.lastName, 80) : req.user.lastName;
  /* Phone: free-form but bounded; empty clears it. */
  const phone = req.body?.phone !== undefined ? str(req.body.phone, 40) : undefined;
  if (!firstName) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'First name is required.' } });
  }
  db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(firstName, lastName, phone !== undefined ? phone : (req.user.phone || ''), req.user.id);
  const row = db.prepare('SELECT id, first_name, last_name, email, phone, avatar, role FROM users WHERE id = ?').get(req.user.id);
  res.json({
    user: { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone || '', avatar: row.avatar || '', role: row.role },
  });
});

/* Profile photo upload. Same trust model as POST /admin/upload (data URL,
   magic-byte verified, uploads-relative path stored) but scoped to the
   caller's own row, capped at 2MB, images only. Re-uploading replaces the
   previous file (deleted best-effort so avatars do not accumulate). */
const AVATAR_MAGIC = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpg: [0xFF, 0xD8, 0xFF],
  webp: [0x52, 0x49, 0x46, 0x46],
  gif: [0x47, 0x49, 0x46, 0x38],
};

function parseAvatarDataUrl(data, filename) {
  const match = String(data || '').match(/^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { error: 'Unsupported file. Use a PNG, JPG, WebP or GIF image.' };
  let ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');
  if (!buffer.length) return { error: 'File is empty.' };
  if (buffer.length > 2 * 1024 * 1024) return { error: 'Photo too large (max 2MB).' };
  const sig = AVATAR_MAGIC[ext];
  if (!sig || !sig.every((b, i) => buffer[i] === b)) return { error: 'File content does not match its type.' };
  if (ext === 'webp' && buffer.toString('ascii', 8, 12) !== 'WEBP') return { error: 'File content does not match its type.' };
  void filename;
  return { buffer, ext };
}

function deleteAvatarFile(rel) {
  try {
    if (typeof rel === 'string' && /^images\/uploads\/avatar-\d+-\d+\.(png|jpg|webp|gif)$/.test(rel)) {
      const full = path.join(config.UPLOADS_DIR, path.basename(rel));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
  } catch { /* best-effort cleanup only */ }
}

router.post('/portal/profile/avatar', userAuthMiddleware, (req, res) => {
  const parsed = parseAvatarDataUrl(req.body?.data, req.body?.filename);
  if (parsed.error) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error } });
  }
  const current = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
  const name = `avatar-${req.user.id}-${Date.now()}.${parsed.ext}`;
  try {
    fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(config.UPLOADS_DIR, name), parsed.buffer);
  } catch {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not store the photo.' } });
  }
  if (current && current.avatar) deleteAvatarFile(current.avatar);
  const rel = `images/uploads/${name}`;
  db.prepare('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rel, req.user.id);
  res.json({ ok: true, avatar: rel });
});

router.delete('/portal/profile/avatar', userAuthMiddleware, (req, res) => {
  const current = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
  if (current && current.avatar) deleteAvatarFile(current.avatar);
  db.prepare("UPDATE users SET avatar = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.user.id);
  res.json({ ok: true, avatar: '' });
});

/* ============================================================
   TWO-WAY MESSAGES — client ↔ team thread (client side)
   ------------------------------------------------------------
   Distinct from notifications (one-way announcements) and from the
   contacts inbox (public form + dashboard composer both land there, but
   with no reply path back). Each row carries its sender side; is_read
   tracks the RECIPIENT: opening the thread marks the other side's rows
   read, which is what clears the unread badge.
   ============================================================ */
function mapMessage(m) {
  return {
    id: m.id,
    sender: m.sender,
    body: m.body,
    read: Boolean(m.is_read),
    createdAt: m.created_at,
  };
}

router.get('/portal/messages', userAuthMiddleware, (req, res) => {
  /* Opening the conversation IS the read receipt for the client's side. */
  db.prepare("UPDATE client_messages SET is_read = 1 WHERE user_id = ? AND sender = 'admin' AND is_read = 0")
    .run(req.user.id);
  const rows = db.prepare('SELECT * FROM client_messages WHERE user_id = ? ORDER BY created_at, id').all(req.user.id);
  res.json({ messages: rows.map(mapMessage) });
});

router.post('/portal/messages', userAuthMiddleware, (req, res) => {
  const body = str(req.body?.message ?? req.body?.body, 4000);
  if (!body) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message is required.' } });
  }
  const result = db.prepare("INSERT INTO client_messages (user_id, sender, body) VALUES (?, 'client', ?)")
    .run(req.user.id, body);
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

/* ============================================================
   PROJECT ACTIVATION REQUESTS (client side)
   ------------------------------------------------------------
   A structured "please start a project for me" form instead of a blank
   message: title + preset category/budget/timeline + free description.
   The client watches the status on their dashboard; the admin triages
   in Client Projects (approve/reject + one-click project creation).
   ============================================================ */
const REQUEST_CATEGORIES = new Set(['website', 'mobile-app', 'ecommerce', 'erp-crm', 'ai-solution', 'other']);
const REQUEST_STATUSES = new Set(['new', 'reviewed', 'approved', 'rejected']);

function mapProjectRequest(r, email) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    budget: r.budget,
    timeline: r.timeline,
    description: r.description,
    status: r.status,
    adminNote: r.admin_note || '',
    createdAt: r.created_at,
    ...(email !== undefined ? { userEmail: email } : {}),
  };
}

router.get('/portal/requests', userAuthMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM project_requests WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json({ requests: rows.map((r) => mapProjectRequest(r)) });
});

router.post('/portal/requests', userAuthMiddleware, (req, res) => {
  const title = str(req.body?.title, 160);
  if (!title) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Project title is required.' } });
  }
  const category = REQUEST_CATEGORIES.has(req.body?.category) ? req.body.category : 'other';
  const result = db.prepare(
    'INSERT INTO project_requests (user_id, title, category, budget, timeline, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, title, category, str(req.body?.budget, 60), str(req.body?.timeline, 60), str(req.body?.description, 2000));
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

/* ============================================================
   ADMIN SIDE — populates and updates the client view
   ============================================================ */

router.get('/admin/portal/projects', adminAuthMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.first_name, u.last_name, u.email, u.phone, u.avatar
       FROM projects p JOIN users u ON u.id = p.user_id
       ORDER BY p.updated_at DESC, p.id DESC`
    )
    .all();
  res.json({
    projects: rows.map((p) => ({
      ...projectWithMilestones(p),
      user: { id: p.user_id, name: [p.first_name, p.last_name].filter(Boolean).join(' '), email: p.email, phone: p.phone || '', avatar: p.avatar || '' },
    })),
  });
});

router.post('/admin/portal/projects', adminAuthMiddleware, (req, res) => {
  const name = str(req.body?.name, 160);
  if (!name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Project name is required.' } });
  }
  const nameCheck = validateObjectFieldNames(req.body);
  if (nameCheck && nameCheck.error) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: nameCheck.error } });
  }

  /* Target the user by email: an admin should not have to know an id. */
  const email = str(req.body?.userEmail, 200).toLowerCase();
  /* Strict for the same reason as the path ids. */
  const explicitId = req.body?.userId !== undefined ? strictId(req.body.userId) : null;
  if (req.body?.userId !== undefined && explicitId === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"userId" must be a positive whole number.' },
    });
  }
  const user = explicitId
    ? db.prepare('SELECT id FROM users WHERE id = ?').get(explicitId)
    : db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No client account with that email. Ask them to sign up first.' } });
  }

  const status = PROJECT_STATUSES.has(req.body?.status) ? req.body.status : 'planning';
  const result = db
    .prepare(
      'INSERT INTO projects (user_id, name, summary, status, start_date, target_date) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(user.id, name, str(req.body?.summary, 2000), status, dateStr(req.body?.startDate), dateStr(req.body?.targetDate));

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);

  /* Tell the client there is a new project — this is the notification the
     dashboard exists to deliver. */
  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'project', ?, ?, ?)")
      .run(user.id, `New project: ${name}`, str(req.body?.summary, 300), '/en/account');
  } catch { /* non-critical */ }

  res.status(201).json({ project: projectWithMilestones(project) });
});

router.put('/admin/portal/projects/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
  }

  const name = str(req.body?.name, 160) || project.name;
  const summary = req.body?.summary !== undefined ? str(req.body.summary, 2000) : project.summary;
  const status = PROJECT_STATUSES.has(req.body?.status) ? req.body.status : project.status;
  /* progress may be set directly by an admin ("we agreed 60%"), but any
     milestone change recomputes it — last writer wins, which is the
     behaviour an admin expects when they type a number. */
  const progress = req.body?.progress !== undefined
    ? int(req.body.progress, { min: 0, max: 100, dflt: project.progress_percent })
    : project.progress_percent;

  db.prepare(
    `UPDATE projects SET name = ?, summary = ?, status = ?, progress_percent = ?, start_date = ?, target_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    name, summary, status, progress,
    req.body?.startDate !== undefined ? dateStr(req.body.startDate) : project.start_date,
    req.body?.targetDate !== undefined ? dateStr(req.body.targetDate) : project.target_date,
    id
  );

  if (status !== project.status) {
    try {
      db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'project', ?, ?, ?)")
        .run(project.user_id, `${name}: ${status}`, `The status of your project moved to "${status}".`, '/en/account');
    } catch { /* non-critical */ }
  }

  res.json({ project: projectWithMilestones(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)) });
});

router.post('/admin/portal/projects/:id/milestones', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const projectId = strictId(req.params.id);
  if (projectId === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
  }
  const title = str(req.body?.title, 160);
  if (!title) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Milestone title is required.' } });
  }
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM milestones WHERE project_id = ?').get(projectId).m;

  const result = db
    .prepare(
      'INSERT INTO milestones (project_id, title, description, progress, weight, status, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      projectId,
      title,
      str(req.body?.description, 2000),
      int(req.body?.progress, { min: 0, max: 100, dflt: 0 }),
      int(req.body?.weight, { min: 1, max: 100, dflt: 1 }),
      MILESTONE_STATUSES.has(req.body?.status) ? req.body.status : 'pending',
      dateStr(req.body?.dueDate),
      req.body?.position !== undefined ? int(req.body.position, { min: 0, max: 9999, dflt: maxPos + 1 }) : maxPos + 1
    );

  recalcProjectProgress(projectId);
  res.status(201).json({ milestoneId: result.lastInsertRowid });
});

router.put('/admin/portal/milestones/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const m = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  if (!m) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
  }

  const progress = int(req.body?.progress, { min: 0, max: 100, dflt: m.progress });
  /* Deriving the status from progress by default keeps the two consistent:
     someone marking a milestone 100% should not also have to remember to
     flip a separate status dropdown. An explicit status still wins. */
  let status = MILESTONE_STATUSES.has(req.body?.status) ? req.body.status : m.status;
  if (!MILESTONE_STATUSES.has(req.body?.status)) {
    if (progress >= 100) status = 'done';
    else if (progress > 0) status = 'in-progress';
    else if (m.status !== 'blocked') status = 'pending';
  }
  const completedAt = status === 'done' ? (m.completed_at || new Date().toISOString().slice(0, 10)) : '';

  db.prepare(
    `UPDATE milestones SET title = ?, description = ?, progress = ?, weight = ?, status = ?, due_date = ?, position = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    str(req.body?.title, 160) || m.title,
    req.body?.description !== undefined ? str(req.body.description, 2000) : m.description,
    progress,
    int(req.body?.weight, { min: 1, max: 100, dflt: m.weight }),
    status,
    req.body?.dueDate !== undefined ? dateStr(req.body.dueDate) : m.due_date,
    req.body?.position !== undefined ? int(req.body.position, { min: 0, max: 9999, dflt: m.position }) : m.position,
    completedAt,
    id
  );

  const pct = recalcProjectProgress(m.project_id);
  res.json({ ok: true, status, projectProgress: pct });
});

router.delete('/admin/portal/milestones/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const m = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  if (!m) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
  }
  db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  recalcProjectProgress(m.project_id);
  res.json({ ok: true });
});

/* Delete a whole project. Milestones and contracts go with it through the
   ON DELETE CASCADE foreign keys declared in create-client-portal-schema.js
   (foreign_keys pragma is ON — see that module). The client is told, so a
   disappearing card is never a mystery. There is no undo; the admin page
   asks twice before calling this. */
router.delete('/admin/portal/projects/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'project', ?, ?, ?)")
      .run(project.user_id, `Project removed: ${project.name}`, 'The project is no longer on your dashboard. Contact the team if this is unexpected.', '/en/account');
  } catch { /* non-critical */ }
  res.json({ ok: true });
});

/* Update a contract in place (status flow draft → sent → signed → active →
   completed, value corrections, date changes). The client is notified only
   when the STATUS moves — editing a typo in the notes should not ping
   anyone. user_id/project_id are immutable here: moving a contract between
   clients is a delete + re-attach, not an edit. */
router.put('/admin/portal/contracts/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const c = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!c) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contract not found.' } });
  }
  const status = CONTRACT_STATUSES.has(req.body?.status) ? req.body.status : c.status;
  const file = req.body?.file !== undefined ? contractFileOk(req.body.file) : c.file || '';
  if (file === null) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Contract file must be an uploaded file (images/uploads/…).' } });
  }
  db.prepare(
    `UPDATE contracts SET title = ?, reference = ?, value_cents = ?, currency = ?,
      status = ?, signed_at = ?, starts_on = ?, ends_on = ?, notes = ?, file = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(
    str(req.body?.title, 160) || c.title,
    req.body?.reference !== undefined ? str(req.body.reference, 60) : c.reference,
    req.body?.value !== undefined ? Math.round(Number(req.body.value) * 100) || 0 : c.value_cents,
    req.body?.currency !== undefined ? str(req.body.currency, 8) || 'USD' : c.currency,
    status,
    req.body?.signedAt !== undefined ? dateStr(req.body.signedAt) : c.signed_at,
    req.body?.startsOn !== undefined ? dateStr(req.body.startsOn) : c.starts_on,
    req.body?.endsOn !== undefined ? dateStr(req.body.endsOn) : c.ends_on,
    req.body?.notes !== undefined ? str(req.body.notes, 2000) : c.notes,
    file,
    id
  );
  if (status !== c.status) {
    try {
      db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'contract', ?, ?, ?)")
        .run(c.user_id, `Contract ${status}: ${c.title}`, `The status of your contract moved to "${status}".`, '/en/account');
    } catch { /* non-critical */ }
  }
  res.json({ ok: true, status });
});

router.post('/admin/portal/contracts', adminAuthMiddleware, (req, res) => {
  const title = str(req.body?.title, 160);
  if (!title) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Contract title is required.' } });
  }

  const projectId = req.body?.projectId ? int(req.body.projectId, { min: 1, max: Number.MAX_SAFE_INTEGER }) : null;
  const project = projectId ? db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) : null;
  if (projectId && !project) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
  }
  /* user_id comes from the PROJECT, never from the request. Passing a
     userId alongside a projectId that belongs to someone else would attach
     a contract to the wrong client. */
  const userId = project ? project.user_id : int(req.body?.userId, { min: 1, max: Number.MAX_SAFE_INTEGER });
  if (!userId) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A project or userId is required.' } });
  }

  const file = contractFileOk(req.body?.file);
  if (file === null) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Contract file must be an uploaded file (images/uploads/…).' } });
  }

  const result = db
    .prepare(
      `INSERT INTO contracts (project_id, user_id, title, reference, value_cents, currency, status, signed_at, starts_on, ends_on, notes, file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      project ? project.id : null,
      userId,
      title,
      str(req.body?.reference, 60),
      /* accept a decimal string or a number and store exact cents */
      Math.round(Number(req.body?.value ?? 0) * 100) || 0,
      str(req.body?.currency, 8) || 'USD',
      CONTRACT_STATUSES.has(req.body?.status) ? req.body.status : 'draft',
      dateStr(req.body?.signedAt),
      dateStr(req.body?.startsOn),
      dateStr(req.body?.endsOn),
      str(req.body?.notes, 2000),
      file
    );

  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'contract', ?, ?, ?)")
      .run(userId, `Contract available: ${title}`, 'A new document was added to your dashboard.', '/en/account');
  } catch { /* non-critical */ }

  res.status(201).json({ id: result.lastInsertRowid });
});

/* List contracts for the admin page: all, or filtered to one project or
   one client. The client already has its own scoped reader; this is the
   unscoped counterpart the "Client Projects" detail view needs. */
router.get('/admin/portal/contracts', adminAuthMiddleware, (req, res) => {
  const qp = req.query || {};
  const projectId = qp.projectId ? int(qp.projectId, { min: 1, max: Number.MAX_SAFE_INTEGER }) : null;
  const userId = qp.userId ? int(qp.userId, { min: 1, max: Number.MAX_SAFE_INTEGER }) : null;
  const where = [];
  const args = [];
  if (projectId) { where.push('c.project_id = ?'); args.push(projectId); }
  if (userId) { where.push('c.user_id = ?'); args.push(userId); }
  const rows = db.prepare(
    'SELECT c.*, p.name AS project_name, u.email AS user_email FROM contracts c ' +
    'LEFT JOIN projects p ON p.id = c.project_id ' +
    'LEFT JOIN users u ON u.id = c.user_id ' +
    (where.length ? `WHERE ${where.join(' AND ')} ` : '') +
    'ORDER BY c.updated_at DESC, c.id DESC'
  ).all(...args);
  res.json({
    contracts: rows.map((c) => ({ ...mapContract(c), userEmail: c.user_email || '' })),
  });
});

/* Seed (or top-up) the demo fixture: demo@noviq.local + project + steps +
   contract + unread messages. Idempotent — a second call creates nothing.
   Admin-only, so production is seeded with one authenticated call instead
   of container SSH. The Client Projects page offers this as "Load demo
   data" when the project list is empty. */
router.post('/admin/portal/seed-demo', adminAuthMiddleware, (req, res) => {
  try {
    const { seedPortalDemo } = require('../scripts/seed-portal-demo');
    const { hashPassword } = require('../middleware/auth');
    const out = seedPortalDemo(db, hashPassword);
    /* The demo password stays a documented fixture value, not an API
       payload: admins already know it, clients never call this. */
    res.json({ ok: true, ...out, login: { email: out.login.email } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: `Demo seed failed: ${err.message}` } });
  }
});

/* ============================================================
   TWO-WAY MESSAGES — admin side (organized inbox)
   ------------------------------------------------------------
   GET  /messages            every client with a thread (last message,
                             unread count of client→admin rows)
   GET  /messages/:userId    one thread (marks client rows read on open)
   POST /messages             reply as the team (also drops a notification
                             so the client's badge + feed show it)
   ============================================================ */
router.get('/admin/portal/messages', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT m.user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar,
            (SELECT body FROM client_messages WHERE user_id = m.user_id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_body,
            (SELECT sender FROM client_messages WHERE user_id = m.user_id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_sender,
            MAX(m.created_at) AS last_at,
            SUM(CASE WHEN m.sender = 'client' AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread,
            COUNT(*) AS total
     FROM client_messages m
     JOIN users u ON u.id = m.user_id
     GROUP BY m.user_id
     ORDER BY last_at DESC, m.user_id DESC`
  ).all();
  res.json({
    conversations: rows.map((r) => ({
      userId: r.user_id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      email: r.email,
      phone: r.phone || '',
      avatar: r.avatar || '',
      lastBody: r.last_body || '',
      lastSender: r.last_sender || '',
      lastAt: r.last_at,
      unread: r.unread || 0,
      total: r.total || 0,
    })),
  });
});

router.get('/admin/portal/messages/:userId', adminAuthMiddleware, (req, res) => {
  const userId = strictId(req.params.userId);
  if (userId === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"userId" must be a positive whole number.' },
    });
  }
  const user = db.prepare('SELECT id, first_name, last_name, email, phone, avatar FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That client account does not exist.' } });
  }
  /* Opening the thread IS the admin's read receipt for the client's rows. */
  db.prepare("UPDATE client_messages SET is_read = 1 WHERE user_id = ? AND sender = 'client' AND is_read = 0")
    .run(userId);
  const rows = db.prepare('SELECT * FROM client_messages WHERE user_id = ? ORDER BY created_at, id').all(userId);
  res.json({
    user: { id: user.id, name: [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email, phone: user.phone || '', avatar: user.avatar || '' },
    messages: rows.map(mapMessage),
  });
});

router.post('/admin/portal/messages', adminAuthMiddleware, (req, res) => {
  /* Strict for the same reason as the path ids: this picks whose thread the
     message lands in, and parseInt('5abc') would silently pick client 5. */
  const userId = req.body?.userId !== undefined ? strictId(req.body.userId) : null;
  if (req.body?.userId !== undefined && userId === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"userId" must be a positive whole number.' },
    });
  }
  if (userId && !db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That client account does not exist.' } });
  }
  if (!userId) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A client (userId) is required — replies are per-client, never broadcast.' } });
  }
  const body = str(req.body?.message ?? req.body?.body, 4000);
  if (!body) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message is required.' } });
  }
  const result = db.prepare("INSERT INTO client_messages (user_id, sender, body) VALUES (?, 'admin', ?)")
    .run(userId, body);
  /* The reply must surface where the client already looks: badge + feed. */
  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'message', ?, ?, ?)")
      .run(userId, 'New message from the team', body.length > 160 ? `${body.slice(0, 157)}…` : body, '/en/account');
  } catch { /* the chat row is the source of truth; the ping is a courtesy */ }
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

/* ============================================================
   PROJECT ACTIVATION REQUESTS — admin triage
   ------------------------------------------------------------
   GET  /requests            every request (optional ?status=)
   PUT  /requests/:id        set status + admin note. Terminal states
                             (approved/rejected) notify the client so the
                             dashboard status never changes silently.
   ============================================================ */
router.get('/admin/portal/requests', adminAuthMiddleware, (req, res) => {
  const status = req.query?.status;
  const where = status && REQUEST_STATUSES.has(status) ? 'WHERE r.status = ?' : '';
  const args = where ? [status] : [];
  const rows = db.prepare(
    `SELECT r.*, u.first_name, u.last_name, u.email, u.phone, u.avatar
     FROM project_requests r JOIN users u ON u.id = r.user_id
     ${where} ORDER BY r.created_at DESC, r.id DESC`
  ).all(...args);
  res.json({
    requests: rows.map((r) => ({
      ...mapProjectRequest(r),
      user: {
        id: r.user_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
        email: r.email,
        phone: r.phone || '',
        avatar: r.avatar || '',
      },
    })),
  });
});

router.put('/admin/portal/requests/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const r = db.prepare('SELECT * FROM project_requests WHERE id = ?').get(id);
  if (!r) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found.' } });
  }
  const status = REQUEST_STATUSES.has(req.body?.status) ? req.body.status : r.status;
  const adminNote = req.body?.adminNote !== undefined ? str(req.body.adminNote, 1000) : r.admin_note;
  db.prepare('UPDATE project_requests SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, adminNote, id);
  /* Terminal states are decisions the client waits on — tell them. */
  if (status !== r.status && (status === 'approved' || status === 'rejected')) {
    try {
      db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'project', ?, ?, ?)")
        .run(r.user_id,
          status === 'approved' ? `Request approved: ${r.title}` : `Request update: ${r.title}`,
          status === 'approved'
            ? 'Your project request was approved — the team will attach your project here.'
            : (adminNote || 'The team reviewed your request. Reply in the conversation for details.'),
          '/en/account');
    } catch { /* non-critical */ }
  }
  res.json({ ok: true, status });
});

/* Deleting a request.
   The queue could be approved and rejected but never removed, which is not a
   finished control: a duplicate, a spam signup or a probe left behind by a
   test is permanent in the admin's face with no way out of it except direct
   database access.

   Deliberately NOT reversible and NOT something the client can trigger — a
   request is also a record of what somebody asked for. This only removes it
   from the triage queue. */
router.delete('/admin/portal/requests/:id', adminAuthMiddleware, (req, res) => {
  /* strictId, not int(): parseInt('5abc') is 5, and this id picks a row. */
  const id = strictId(req.params.id);
  if (id === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"id" must be a positive whole number.' },
    });
  }
  const row = db.prepare('SELECT id, user_id, title, status FROM project_requests WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found.' } });
  }
  db.prepare('DELETE FROM project_requests WHERE id = ?').run(id);
  /* Tell the client it is gone, so a request they were waiting on does not
     simply stop updating. The wording has to say WHO removed it: the client
     did not withdraw anything, and a feed that says they did sends them
     looking for a cancel button that does not exist. Best effort: the row
     is already deleted. */
  try {
    db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'project', ?, ?, ?)")
      .run(row.user_id,
        'Request removed by the team',
        `Your request "${row.title}" was removed from the queue by the team.`,
        '/en/account');
  } catch { /* non-critical */ }
  res.json({ ok: true, deleted: id });
});

/** userId omitted = broadcast to every signed-in user. */
router.post('/admin/portal/notifications', adminAuthMiddleware, (req, res) => {  const title = str(req.body?.title, 200);
  if (!title) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Notification title is required.' } });
  }
  /* Strict for the same reason as the path ids: this picks whose thread the
     message lands in, and parseInt('5abc') would silently pick client 5. */
  const userId = req.body?.userId !== undefined ? strictId(req.body.userId) : null;
  if (req.body?.userId !== undefined && userId === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '"userId" must be a positive whole number.' },
    });
  }
  if (userId && !db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That client account does not exist.' } });
  }
  const type = NOTIFICATION_TYPES.has(req.body?.type) ? req.body.type : 'news';

  const result = db
    .prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, str(req.body?.body, 4000), str(req.body?.link, 300));

  res.status(201).json({ id: result.lastInsertRowid, broadcast: userId === null });
});

module.exports = router;
