/* ============================================================
   NOVIQ API — ALL ENDPOINTS IN ONE FILE
   ------------------------------------------------------------
   Every API endpoint lives here for easy hosting/deployment.
   app.js mounts this file once under /api.

   Sections:
     1.  Health check
     2.  Contact form
     3.  Newsletter
     4.  Assessment quiz
     5.  Consultation requests
     6.  Solution builder
     7.  Public site content
     8.  User auth (register / login / password reset)
     9.  Chatbot
     10. Visit analytics (cookie-free)
     11. Image generation proxy
     12. Admin — session (login / logout / me / password)
   13. Admin — file upload
     14. Admin — dashboard stats & system
     15. Admin — chat logs
     16. Admin — registered users
     17. Admin — data exports
     18. Admin — site content CRUD
   ============================================================ */

const { Router } = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const db = require('../db/init');
const config = require('../config');
const { adminAuthMiddleware: authMiddleware, generateToken, comparePassword, hashPassword } = require('../middleware/auth');
const { notifyNewLead, sendMail } = require('../mailer');
const { reply, invalidateOverrideCache, getDefaultReply } = require('../chatbot/engine');
const { INTENTS, TOPIC_TREE, TOPIC_COUNT, GENERATED_COUNT, INTENT_META, FAQ_CATEGORIES } = require('../chatbot/knowledge');
const { search: searchKnowledge, indexStats } = require('../chatbot/search');
const { rebuildConfigFile } = require('../content-store');
const { cloneDefaults, validatePromptBuilder } = require('../prompt-builder-config');
const monitor = require('../monitor');
const siteMonitor = require('../site-monitor');
const logs = require('../logs');
const { createLimiter } = require('../rate-limit-config');
const { limitHandler } = require('../logs');

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- Rate limiters ---- */

/* Public auth: 10 attempts / 10 minutes per IP (register + login + reset) */
const authLimiter = createLimiter('auth');

/* Admin login brute-force protection: 5 attempts / 10 minutes per IP */
const adminLoginLimiter = createLimiter('admin-login');

/* Image generation is expensive upstream: 10 requests / 5 min per IP */
const imageLimiter = createLimiter('imagegen');

router.use('/auth', authLimiter);

/* ---- Shared helpers ---- */
function getPublicContent() {
  const rows = db.prepare('SELECT key, value FROM content').all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

/* Safe pagination: NaN-proof, clamped (bad input crashed SQLite binding before) */
function pageParams(req, maxLimit = 200) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), maxLimit);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

function validateResources(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Resources must be an object.' };
  if (!input.hero || typeof input.hero !== 'object') return { error: 'Resources page header is required.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    const value = input.hero[field];
    if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `hero.${field} must contain en and ar.` };
    if (value.en.length > 1000 || value.ar.length > 1000) return { error: `hero.${field} is too long.` };
  }
  if (!Array.isArray(input.tabs) || input.tabs.length > 20) return { error: 'Resources must contain up to 20 sections.' };
  if (!input.items || typeof input.items !== 'object' || Array.isArray(input.items)) return { error: 'Resource items are required.' };

  const ids = new Set();
  const normalized = JSON.parse(JSON.stringify(input));
  for (const tab of normalized.tabs) {
    if (!tab || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tab.id || '') || ids.has(tab.id)) return { error: 'Resource section IDs must be unique safe identifiers.' };
    ids.add(tab.id);
    if (!tab.label || typeof tab.label.en !== 'string' || typeof tab.label.ar !== 'string') return { error: `Section ${tab.id} must contain English and Arabic labels.` };
    if (typeof tab.active !== 'boolean') return { error: `Section ${tab.id} active state is invalid.` };
    const items = normalized.items[tab.id];
    if (!Array.isArray(items) || items.length > 500) return { error: `Section ${tab.id} must contain up to 500 items.` };
    const itemIds = new Set();
    for (const item of items) {
      if (!item || typeof item !== 'object' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(item.id || '') || itemIds.has(item.id)) return { error: `Content IDs in ${tab.id} must be unique safe identifiers.` };
      itemIds.add(item.id);
      for (const field of ['title', 'excerpt', 'content', 'cat']) {
        const value = item[field];
        if (!value || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `${field} in ${item.id} must contain en and ar.` };
      }
      if (!item.title.en.trim() && !item.title.ar.trim()) return { error: `A title is required for ${item.id}.` };
      if (item.title.en.length > 300 || item.title.ar.length > 300 || item.excerpt.en.length > 2000 || item.excerpt.ar.length > 2000 || item.content.en.length > 100000 || item.content.ar.length > 100000) return { error: `Content in ${item.id} is too long.` };
      if (!['draft', 'published'].includes(item.status) || typeof item.featured !== 'boolean') return { error: `Publishing state in ${item.id} is invalid.` };
      if (item.link && !/^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i.test(item.link)) return { error: `External link in ${item.id} is invalid.` };
      for (const field of ['file', 'image']) {
        if (item[field] && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(item[field]) || /(?:^|\/)\.\.(?:\/|$)/.test(item[field]))) return { error: `${field} path in ${item.id} is invalid.` };
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 4 * 1024 * 1024) return { error: 'Resources content is too large.' };
  return { value: normalized };
}

function validateTeam(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Team must be an object.' };
  if (!input.hero || typeof input.hero !== 'object') return { error: 'Team page header is required.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    const value = input.hero[field];
    if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `hero.${field} must contain en and ar.` };
    if (value.en.length > 1000 || value.ar.length > 1000) return { error: `hero.${field} is too long.` };
  }
  if (!Array.isArray(input.members) || input.members.length > 200) return { error: 'Team must contain up to 200 members.' };
  const ids = new Set();
  const normalized = JSON.parse(JSON.stringify(input));
  for (const member of normalized.members) {
    if (!member || typeof member !== 'object' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(member.id || '') || ids.has(member.id)) return { error: 'Member IDs must be unique safe identifiers.' };
    ids.add(member.id);
    for (const field of ['name', 'role', 'bio']) {
      const value = member[field];
      if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `${field} in ${member.id} must contain en and ar.` };
    }
    if (!member.name.en.trim() && !member.name.ar.trim()) return { error: `A name is required for ${member.id}.` };
    if (member.name.en.length > 200 || member.name.ar.length > 200 || member.role.en.length > 300 || member.role.ar.length > 300 || member.bio.en.length > 5000 || member.bio.ar.length > 5000) return { error: `Text in ${member.id} is too long.` };
    if (!['draft', 'published'].includes(member.status) || typeof member.featured !== 'boolean') return { error: `Publishing state in ${member.id} is invalid.` };
    for (const field of ['portfolio', 'linkedin', 'github', 'facebook']) {
      if (member[field] && !/^(?:https?:\/\/)[^\s"'<>]*$/i.test(member[field])) return { error: `Link ${field} in ${member.id} is invalid.` };
    }
    if (member.email && !/^\S+@\S+\.\S+$/.test(member.email)) return { error: `Email in ${member.id} is invalid.` };
    if (member.photo && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(member.photo) || /(?:^|\/)\.\.(?:\/|$)/.test(member.photo))) return { error: `Photo in ${member.id} is invalid.` };
    if (member.cv && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(member.cv) || /(?:^|\/)\.\.(?:\/|$)/.test(member.cv))) return { error: `CV file in ${member.id} is invalid.` };
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 4 * 1024 * 1024) return { error: 'Team content is too large.' };
  return { value: normalized };
}

function validateSolutionBuilder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.steps)) return { error: 'Solution Builder must contain a steps array.' };
  if (!input.steps.length || input.steps.length > 30) return { error: 'Solution Builder must have 1-30 steps.' };
  const normalized = JSON.parse(JSON.stringify(input));
  const keys = new Set();
  let totalOptions = 0;
  for (const step of normalized.steps) {
    if (!step || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(step.key || '') || keys.has(step.key)) return { error: 'Solution Builder step keys must be unique safe identifiers.' };
    keys.add(step.key);
    for (const field of ['label', 'title', 'desc']) {
      if (typeof step[field] !== 'string' || !step[field].trim() || step[field].length > 1000) return { error: `Invalid ${field} in step ${step.key}.` };
    }
    if (typeof step.multi !== 'boolean' || !Array.isArray(step.options) || !step.options.length || step.options.length > 100) return { error: `Invalid options in step ${step.key}.` };
    const values = new Set();
    totalOptions += step.options.length;
    for (const option of step.options) {
      if (!option || typeof option.value !== 'string' || !option.value.trim() || option.value.length > 120 || values.has(option.value)) return { error: `Option values in ${step.key} must be unique.` };
      values.add(option.value);
      if (typeof option.label !== 'string' || !option.label.trim() || option.label.length > 300 || typeof option.icon !== 'string' || option.icon.length > 500) return { error: `Invalid option in step ${step.key}.` };
    }
  }
  if (totalOptions > 500 || Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 512 * 1024) return { error: 'Solution Builder configuration is too large.' };
  return { value: normalized };
}

/* ============================================================
   1. HEALTH CHECK
   ============================================================ */

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ============================================================
   2. CONTACT FORM
   ============================================================ */

router.post('/contact', (req, res) => {
  const { name, email, company, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message too long (max 5000 characters).' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO contacts (name, email, company, message) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), (company || '').trim(), message.trim());

    notifyNewLead('contact message', { name, email, company, message: message.slice(0, 500) });

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Message sent successfully. We will get back to you within one business day.',
    });
  } catch (err) {
    console.error('[Contact] Error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

router.get('/contact', authMiddleware, (req, res) => {
  const { status } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM contacts';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.patch('/contact/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'read', 'replied', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const result = db.prepare(
    'UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, id);

  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found.' });
  res.json({ id: parseInt(id), status });
});

router.delete('/contact/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found.' });
  res.json({ message: 'Contact deleted.' });
});

/* ============================================================
   3. NEWSLETTER
   ============================================================ */

router.post('/newsletter/subscribe', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Invalid email address.' });

  try {
    const existing = db.prepare('SELECT id, active FROM newsletter WHERE email = ?').get(email.trim().toLowerCase());

    if (existing) {
      if (existing.active) return res.json({ message: 'Already subscribed.', subscribed: true });
      db.prepare('UPDATE newsletter SET active = 1, subscribed_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.id);
      return res.json({ message: 'Re-subscribed successfully.', subscribed: true });
    }

    const result = db.prepare('INSERT INTO newsletter (email) VALUES (?)').run(email.trim().toLowerCase());
    res.status(201).json({ id: result.lastInsertRowid, message: 'Subscribed successfully.', subscribed: true });
  } catch (err) {
    console.error('[Newsletter] Error:', err.message);
    res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
  }
});

router.post('/newsletter/unsubscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const result = db.prepare('UPDATE newsletter SET active = 0 WHERE email = ?').run(email.trim().toLowerCase());
  if (result.changes === 0) return res.status(404).json({ error: 'Email not found.' });
  res.json({ message: 'Unsubscribed successfully.', subscribed: false });
});

router.get('/newsletter', authMiddleware, (req, res) => {
  const { active } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM newsletter';
  const params = [];

  if (active !== undefined) {
    query += ' WHERE active = ?';
    params.push(parseInt(active));
  }

  query += ' ORDER BY subscribed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.delete('/newsletter/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM newsletter WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Subscriber not found.' });
  res.json({ message: 'Subscriber deleted.' });
});

/* ============================================================
   4. ASSESSMENT QUIZ
   ============================================================ */

router.post('/assessment', (req, res) => {
  const { name, email, company, answers, score, level } = req.body;
  if (!answers) return res.status(400).json({ error: 'Answers are required.' });

  try {
    const answersStr = typeof answers === 'object' ? JSON.stringify(answers) : answers;
    const result = db.prepare(
      'INSERT INTO assessments (name, email, company, answers, score, level) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      (name || '').trim(),
      (email || '').trim(),
      (company || '').trim(),
      answersStr,
      score || 0,
      level || ''
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      score: score || 0,
      level: level || '',
      message: 'Assessment submitted successfully.',
    });
  } catch (err) {
    console.error('[Assessment] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit assessment.' });
  }
});

router.get('/assessment', authMiddleware, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.json(db.prepare(
    'SELECT * FROM assessments ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset));
});

router.get('/assessment/:id', authMiddleware, (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });
  res.json(assessment);
});

/* ============================================================
   5. CONSULTATION REQUESTS
   ============================================================ */

router.post('/consultation', (req, res) => {
  const { name, email, company, industry, budget, timeline, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

  try {
    const result = db.prepare(
      'INSERT INTO consultations (name, email, company, industry, budget, timeline, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name.trim(),
      email.trim().toLowerCase(),
      (company || '').trim(),
      (industry || '').trim(),
      (budget || '').trim(),
      (timeline || '').trim(),
      (message || '').trim()
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Consultation request submitted. We will contact you shortly.',
    });
  } catch (err) {
    console.error('[Consultation] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit consultation request.' });
  }
});

router.get('/consultation', authMiddleware, (req, res) => {
  const { status } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM consultations';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.patch('/consultation/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'contacted', 'scheduled', 'completed', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const result = db.prepare('UPDATE consultations SET status = ? WHERE id = ?').run(status, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Consultation not found.' });
  res.json({ id: parseInt(id), status });
});

/* ============================================================
   6. SOLUTION BUILDER
   ============================================================ */

router.post('/solution-builder', (req, res) => {
  const { name, email, company, steps, summary } = req.body;
  if (!steps) return res.status(400).json({ error: 'Steps data is required.' });

  try {
    const stepsStr = typeof steps === 'object' ? JSON.stringify(steps) : steps;
    const result = db.prepare(
      'INSERT INTO solution_builds (name, email, company, steps, summary) VALUES (?, ?, ?, ?, ?)'
    ).run(
      (name || '').trim(),
      (email || '').trim(),
      (company || '').trim(),
      stepsStr,
      (summary || '').trim()
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Solution build saved successfully.',
    });
  } catch (err) {
    console.error('[SolutionBuilder] Error:', err.message);
    res.status(500).json({ error: 'Failed to save solution build.' });
  }
});

router.get('/solution-builder', authMiddleware, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.json(db.prepare(
    'SELECT * FROM solution_builds ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset));
});

router.get('/solution-builder/:id', authMiddleware, (req, res) => {
  const build = db.prepare('SELECT * FROM solution_builds WHERE id = ?').get(req.params.id);
  if (!build) return res.status(404).json({ error: 'Solution build not found.' });
  res.json(build);
});

/* ============================================================
   7. PUBLIC SITE CONTENT
   ============================================================ */

router.get('/content', (req, res) => {
  try { res.json(getPublicContent()); }
  catch (err) {
    console.error('[Content API] Error:', err.message);
    res.status(500).json({ error: 'Failed to load content.' });
  }
});

router.get('/content/services', (req, res) => {
  try { res.json(getPublicContent().services || []); } catch { res.status(500).json({ error: 'Failed to load services.' }); }
});

router.get('/content/industries', (req, res) => {
  try { res.json(getPublicContent().industries || []); } catch { res.status(500).json({ error: 'Failed to load industries.' }); }
});

router.get('/content/projects', (req, res) => {
  try { res.json(getPublicContent().projects || []); } catch { res.status(500).json({ error: 'Failed to load projects.' }); }
});

router.get('/content/testimonials', (req, res) => {
  try { res.json(getPublicContent().testimonials || []); } catch { res.status(500).json({ error: 'Failed to load testimonials.' }); }
});

router.get('/content/stats', (req, res) => {
  try { res.json(getPublicContent().stats || []); } catch { res.status(500).json({ error: 'Failed to load stats.' }); }
});

router.get('/content/brand', (req, res) => {
  try { res.json(getPublicContent().brand || {}); } catch { res.status(500).json({ error: 'Failed to load brand.' }); }
});

router.get('/content/hero', (req, res) => {
  try { res.json(getPublicContent().hero || {}); } catch { res.status(500).json({ error: 'Failed to load hero.' }); }
});

router.get('/content/team', (req, res) => {
  try { res.json(getPublicContent().team || {}); } catch { res.status(500).json({ error: 'Failed to load team.' }); }
});

/* ============================================================
   8. USER AUTH — register / login / password reset
   ============================================================ */

router.post('/auth/register', (req, res) => {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!firstName || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const result = db.prepare(
    'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)'
  ).run(firstName, lastName, email, hashPassword(password));
  const user = { id: result.lastInsertRowid, firstName, lastName, email, role: 'user' };
  const token = generateToken({ id: user.id, email: user.email, role: user.role, tokenType: 'user' });
  res.status(201).json({ token, user });
});

router.post('/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const record = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!record || !comparePassword(password, record.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = {
    id: record.id,
    firstName: record.first_name,
    lastName: record.last_name,
    email: record.email,
    role: record.role,
  };
  const token = generateToken({ id: user.id, email: user.email, role: user.role, tokenType: 'user' });
  res.json({ token, user });
});

/*
 * Step 1: request a reset code. Always responds with the same message so
 * account existence is never leaked. Code is emailed when SMTP is set up;
 * in development (no SMTP) it is printed to the server console instead.
 */
router.post('/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const generic = { message: 'If an account exists for this email, a reset code has been sent.' };
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.json(generic);

  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM password_resets WHERE email = ?').run(email);
  db.prepare('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

  const sent = await sendMail(
    email,
    'Noviq password reset code',
    `Your Noviq password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`
  );
  if (!sent && config.NODE_ENV !== 'production') {
    console.log(`[Auth] Password reset code for ${email}: ${code} (SMTP not configured)`);
  }

  res.json(generic);
});

/* Step 2: verify code and set the new password. */
router.post('/auth/reset-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const password = String(req.body.password || '');

  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const row = db.prepare('SELECT * FROM password_resets WHERE email = ? AND code = ?').get(email, code);
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset code.' });
  }

  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .run(hashPassword(password), email);
  db.prepare('DELETE FROM password_resets WHERE email = ?').run(email);

  res.json({ message: 'Password updated. You can now sign in.' });
});

/* ============================================================
   9. CHATBOT
   ============================================================ */

router.post('/chatbot/message', async (req, res) => {
  const message = String(req.body.message || '').trim();
  const sessionId = String(req.body.sessionId || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 10000) return res.status(400).json({ error: 'Message is too long (max 10000 chars).' });

  try {
    res.json(await reply(message, sessionId));
  } catch (e) {
    console.error('[Chatbot] Error:', e);
    res.status(500).json({ error: 'Chatbot error. Please try again.' });
  }
});

router.get('/chatbot/stats', (req, res) => {
  let keywords = 0;
  for (const intent of Object.values(INTENTS)) keywords += intent.en.length + intent.ar.length;
  const conversations = db.prepare('SELECT COUNT(DISTINCT session_id) AS c FROM chat_messages').get().c;
  const messages = db.prepare('SELECT COUNT(*) AS c FROM chat_messages').get().c;
  const searchIdx = indexStats();
  res.json({
    intents: Object.keys(INTENTS).length,
    topics: TOPIC_COUNT,
    keywords,
    generatedKeywords: GENERATED_COUNT,
    conversations,
    messages,
    faqs: searchIdx.faqs,
    searchDocuments: searchIdx.documents,
    vocabulary: searchIdx.vocabulary,
  });
});

/* Topic tree — 150 topics in 10 categories for organized access */
router.get('/chatbot/topics', (req, res) => {
  const lang = req.query.lang === 'ar' ? 'ar' : 'en';
  res.json({
    total: TOPIC_COUNT,
    categories: TOPIC_TREE.map(c => ({
      id: c.id,
      label: c.label[lang],
      icon: c.icon,
      count: c.intents.length + c.faqs.length,
      intents: c.intents,
      faqs: c.faqs,
    })),
  });
});

/* Knowledge-base search (BM25 over FAQs + live site content) */
router.get('/chatbot/search', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'Query is required.' });
  const lang = req.query.lang === 'ar' ? 'ar' : (req.query.lang === 'en' ? 'en' : null);
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 10);
  try {
    const results = searchKnowledge(q, lang || (/[\u0600-\u06FF]/.test(q) ? 'ar' : 'en'), limit)
      .map(({ faq, ...rest }) => rest);   // strip internal faq object
    res.json({ query: q, results });
  } catch (e) {
    console.error('[Chatbot Search] Error:', e);
    res.status(500).json({ error: 'Search error. Please try again.' });
  }
});

/* ============================================================
   9b. CHATBOT REPLY MANAGEMENT (admin)
   ------------------------------------------------------------
   List all editable chatbot answers (intents + FAQs) with any
   admin-defined override. Lets the dashboard edit answers about
   the company, services, business terms, testimonials, etc.
   without touching code.
   ============================================================ */

const CATEGORY_LABELS = {
  general:  { en: 'General',          ar: 'عام' },
  company:  { en: 'Company',          ar: 'الشركة' },
  services: { en: 'Services',         ar: 'الخدمات' },
  business: { en: 'Business & Work',  ar: 'الأعمال والتعاون' },
};

router.get('/admin/chatbot/replies', authMiddleware, (req, res) => {
  const overrides = {};
  const rows = db.prepare('SELECT key, type, reply_en, reply_ar, category, image, file, label_en, label_ar, updated_at FROM chatbot_replies').all();
  for (const r of rows) overrides[r.key] = r;

  const items = [];

  /* Intents */
  for (const name of Object.keys(INTENTS)) {
    const meta = INTENT_META[name] || { category: 'general', label: { en: name, ar: name } };
    const ov = overrides[name];
    // Get default replies
    const defaultEn = getDefaultReply(name, 'en');
    const defaultAr = getDefaultReply(name, 'ar');
    
    items.push({
      key: name,
      type: 'intent',
      category: meta.category,
      categoryLabel: CATEGORY_LABELS[meta.category] || CATEGORY_LABELS.general,
      label: meta.label,
      hasOverride: !!(ov && (ov.reply_en || ov.reply_ar)),
      reply_en: ov ? ov.reply_en : '',
      reply_ar: ov ? ov.reply_ar : '',
      image: ov ? ov.image : '',
      file: ov ? ov.file : '',
      default_en: defaultEn,
      default_ar: defaultAr,
      updated_at: ov ? ov.updated_at : null,
      isCustom: false,
    });
  }

  /* FAQs */
  const allFaqs = require('../chatbot/knowledge').FAQS;
  const faqCatMap = {};
  for (const cat of TOPIC_TREE) {
    const mapped = FAQ_CATEGORIES[cat.id] || 'services';
    for (const f of cat.faqs) faqCatMap[f] = mapped;
  }
  for (const f of allFaqs) {
    const cat = faqCatMap[f.id] || 'services';
    const ov = overrides[f.id];
    // Get default replies
    const defaultEn = getDefaultReply(f.id, 'en');
    const defaultAr = getDefaultReply(f.id, 'ar');
    
    items.push({
      key: f.id,
      type: 'faq',
      category: cat,
      categoryLabel: CATEGORY_LABELS[cat] || CATEGORY_LABELS.services,
      label: { en: f.q.en, ar: f.q.ar },
      hasOverride: !!(ov && (ov.reply_en || ov.reply_ar)),
      reply_en: ov ? ov.reply_en : '',
      reply_ar: ov ? ov.reply_ar : '',
      image: ov ? ov.image : '',
      file: ov ? ov.file : '',
      default_en: defaultEn,
      default_ar: defaultAr,
      updated_at: ov ? ov.updated_at : null,
      isCustom: false,
    });
  }

  /* Custom replies (not in knowledge base) */
  const knownKeys = new Set([...Object.keys(INTENTS), ...allFaqs.map(f => f.id)]);
  for (const row of rows) {
    if (!knownKeys.has(row.key)) {
      items.push({
        key: row.key,
        type: row.type === 'faq' ? 'faq' : 'intent',
        category: row.category || 'general',
        categoryLabel: CATEGORY_LABELS[row.category] || CATEGORY_LABELS.general,
        label: { en: row.label_en || row.key, ar: row.label_ar || row.key },
        hasOverride: true,
        reply_en: row.reply_en,
        reply_ar: row.reply_ar,
        image: row.image,
        file: row.file,
        default_en: '',
        default_ar: '',
        updated_at: row.updated_at,
        isCustom: true,
      });
    }
  }

  res.json({
    items,
    counts: {
      total: items.length,
      intents: items.filter(i => i.type === 'intent').length,
      faqs: items.filter(i => i.type === 'faq').length,
      customized: items.filter(i => i.hasOverride).length,
      custom: items.filter(i => i.isCustom).length,
    },
  });
});

router.put('/admin/chatbot/replies/:key', authMiddleware, (req, res) => {
  const key = String(req.params.key || '').slice(0, 80);
  const replyEn = String(req.body.reply_en || '').slice(0, 8000);
  const replyAr = String(req.body.reply_ar || '').slice(0, 8000);
  const image = String(req.body.image || '').slice(0, 500);
  const file = String(req.body.file || '').slice(0, 500);
  const labelEn = String(req.body.label_en || '').slice(0, 200);
  const labelAr = String(req.body.label_ar || '').slice(0, 200);
  if (!replyEn && !replyAr) return res.status(400).json({ error: 'At least one language is required.' });

  /* Determine type + category from knowledge base */
  let type = 'intent', category = 'general';
  if (INTENTS[key]) {
    type = 'intent';
    category = (INTENT_META[key] && INTENT_META[key].category) || 'general';
  } else {
    const allFaqs = require('../chatbot/knowledge').FAQS;
    const faq = allFaqs.find(f => f.id === key);
    if (faq) {
      type = 'faq';
      for (const cat of TOPIC_TREE) {
        if (cat.faqs.includes(key)) { category = FAQ_CATEGORIES[cat.id] || 'services'; break; }
      }
    } else {
      /* Custom reply — allow admin to set type and category */
      type = String(req.body.type || 'intent').slice(0, 10);
      category = String(req.body.category || 'general').slice(0, 30);
    }
  }

  db.prepare(`
    INSERT INTO chatbot_replies (key, type, reply_en, reply_ar, category, image, file, label_en, label_ar, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      reply_en = excluded.reply_en,
      reply_ar = excluded.reply_ar,
      category = excluded.category,
      image = excluded.image,
      file = excluded.file,
      label_en = excluded.label_en,
      label_ar = excluded.label_ar,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, type, replyEn, replyAr, category, image, file, labelEn, labelAr);

  invalidateOverrideCache();
  res.json({ ok: true, message: 'Reply updated. It takes effect immediately.' });
});

router.delete('/admin/chatbot/replies/:key', authMiddleware, (req, res) => {
  const key = String(req.params.key || '').slice(0, 80);
  db.prepare('DELETE FROM chatbot_replies WHERE key = ?').run(key);
  invalidateOverrideCache();
  res.json({ ok: true, message: 'Custom reply removed — reverted to default.' });
});

/* Test a message against the engine (preview without saving a chat row) */
router.post('/admin/chatbot/test', authMiddleware, async (req, res) => {
  const message = String(req.body.message || '').slice(0, 1000);
  const sessionId = 'admin-test-' + Date.now();
  if (!message.trim()) return res.status(400).json({ error: 'Message is required.' });
  try {
    const result = await reply(message, sessionId);
    res.json(result);
  } catch (e) {
    console.error('[Chatbot Test]', e);
    res.status(500).json({ error: 'Engine error.' });
  }
});

/* ============================================================
   10. VISIT ANALYTICS — cookie-free, aggregated per day/path/lang
   ============================================================ */

router.post('/analytics/visit', (req, res) => {
  const visitPath = String(req.body.path || '/').slice(0, 100);
  const language = String(req.body.language || 'en').slice(0, 5);
  const visitorId = String(req.body.visitorId || '').slice(0, 64);
  const day = new Date().toISOString().slice(0, 10);
  /* persistent daily aggregate (unchanged) */
  db.prepare(`
    INSERT INTO visits (day, path, language, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(day, path, language) DO UPDATE SET count = count + 1
  `).run(day, visitPath, language);
  /* live in-memory traffic monitor (public + admin views) */
  siteMonitor.recordVisit(visitorId, visitPath, language);
  res.json({ ok: true });
});

/* Public live traffic — feeds the site's #/monitor page (sanitized) */
router.get('/analytics/live', (req, res) => {
  res.json(siteMonitor.snapshotPublic());
});

/* Admin live traffic — richer snapshot (auth only) */
router.get('/admin/site-monitor', authMiddleware, (req, res) => {
  res.json(siteMonitor.snapshotAdmin());
});

/* ============================================================
   ADMIN — SYSTEM LOG (separate from chat log; export/delete)
   ------------------------------------------------------------
   GET    /api/admin/logs          → recent entries
   GET    /api/admin/logs/export   → CSV download
   DELETE /api/admin/logs          → clear all
   DELETE /api/admin/logs/:id      → delete one
   ============================================================ */

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
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid log id.' });
  if (!logs.deleteLog(id)) return res.status(404).json({ error: 'Log entry not found.' });
  res.json({ ok: true });
});

/* ============================================================
   ADMIN — RATE LIMITS CONFIG (low defaults: api=10/1min, auth=3/1min, admin-login=2/1min, imagegen=1/1min)
   ------------------------------------------------------------
   GET  /api/admin/rate-limits  → current limits
   PUT  /api/admin/rate-limits  → update limits
   ============================================================ */

const { getLimits, updateLimits } = require('../rate-limit-config');

router.get('/admin/rate-limits', authMiddleware, (req, res) => {
  res.json({ limits: getLimits() });
});

router.put('/admin/rate-limits', authMiddleware, (req, res) => {
  try {
    const newLimits = req.body;
    const updated = updateLimits(newLimits);
    res.json({ ok: true, limits: updated });
  } catch (e) {
    res.status(400).json({ error: 'Invalid limits data.' });
  }
});

/* ============================================================
   ------------------------------------------------------------
   GET /api/imagegen?prompt=...&seed=123
   Server-side proxy to Pollinations so the browser never talks
   to the upstream directly (avoids client network blocks, CORS).
   Tries multiple model variants + sources in order.
   ============================================================ */

const BLOCKED_PROMPTS = /sex|nude|naked|porn|explicit|xxx|graphic|violence|gore|weapon|kill|\b(?:woman|women|female|girl|girls|lady|ladies)\b|امرأة|امراه|نساء|أنثى|انثى|فتاة|فتاه|بنت|بنات|سيدة|سيده|سيدات/i;

function transformPrompt(raw) {
  let clean = String(raw || '').trim().slice(0, 200);
  if (!clean) return null;
  if (BLOCKED_PROMPTS.test(clean)) return null;
  const hasAr = /[\u0600-\u06FF]/.test(clean);
  let result = hasAr
    ? `${clean}، فن رقمي، موضوع تقني، تصميم عصري`
    : `${clean}, digital art, software tech concept, modern style`;
  while (encodeURIComponent(result).length > 450 && result.length > 0) {
    result = result.slice(0, -5).trim();
  }
  return result;
}

function imageVariants(prompt, enc, seed) {
  return [
    /* try backend proxy with multiple models */
    { url: `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&seed=${seed}&model=flux&nologo=true`, timeout: 60000 },
    { url: `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&seed=${seed + 1}&nologo=true`, timeout: 60000 },
    { url: `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&seed=${seed + 2}&model=flux-realism&nologo=true`, timeout: 60000 },
    { url: `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&seed=${seed + 3}&model=turbo&nologo=true`, timeout: 30000 },
    { url: `https://image.pollinations.ai/prompt/${enc}?width=1024&height=1024&seed=${seed + 4}&model=flux-anime&nologo=true`, timeout: 60000 },
  ];
}

router.get('/imagegen', imageLimiter, async (req, res) => {
  const q = String(req.query.prompt || '').trim().slice(0, 480);
  if (!q) return res.status(400).json({ error: 'Prompt is required.' });
  const transformed = transformPrompt(q);
  if (!transformed) return res.status(400).json({ error: 'Prompt contains blocked content.' });

  const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 99999);
  const enc = encodeURIComponent(transformed);

  const variants = imageVariants(transformed, enc, seed);

  for (const v of variants) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), v.timeout);
    try {
      const upstream = await fetch(v.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'noviq-backend/1.0' },
      });
      clearTimeout(timer);
      if (!upstream.ok) continue;

      const type = upstream.headers.get('content-type') || '';
      if (!type.startsWith('image/')) continue;

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length < 1024) continue;

      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err) {
      clearTimeout(timer);
      console.warn('[ImageGen] Variant failed:', err.name === 'AbortError' ? 'timeout' : err.message);
    }
  }

  res.status(502).json({ error: 'Image generation failed upstream. Try again shortly.' });
});

/* ============================================================
   12. ADMIN — SESSION (login / logout / me / password)
   ============================================================ */

router.post('/admin/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  /* Admins sign in with their username OR email address (same generic error either way). */
  const identifier = String(username).trim();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(identifier)
    || db.prepare('SELECT * FROM admin_users WHERE email = ? COLLATE NOCASE').get(identifier);
  if (!user || !comparePassword(password, user.password)) {
    logs.logEvent('warning', 'auth', `Failed admin login for "${identifier.slice(0, 64)}"`, req);
    return res.status(401).json({ error: 'Invalid credentials.' });
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
  if (!user) return res.status(404).json({ error: 'User not found.' });
  user.email = user.email || '';
  res.json(user);
});

/* Admin updates own username / email / password. Current password is always required.
   Changing the password kills every other active admin session. */
router.put('/admin/profile', authMiddleware, (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body || {};
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required to save changes.' });
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!user || !comparePassword(String(currentPassword), user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const updates = [];
  const params = [];
  if (username !== undefined) {
    const clean = String(username).trim();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(clean)) return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, dots, dashes or underscores.' });
    const taken = db.prepare('SELECT id FROM admin_users WHERE username = ? AND id != ?').get(clean, user.id);
    if (taken) return res.status(409).json({ error: 'That username is already taken.' });
    updates.push('username = ?'); params.push(clean);
  }
  if (email !== undefined) {
    const clean = String(email).trim();
    if (clean && !EMAIL_PATTERN.test(clean)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (clean) {
      const taken = db.prepare('SELECT id FROM admin_users WHERE email = ? COLLATE NOCASE AND id != ?').get(clean, user.id);
      if (taken) return res.status(409).json({ error: 'That email is already in use.' });
    }
    updates.push('email = ?'); params.push(clean);
  }
  let passwordChanged = false;
  if (newPassword !== undefined && newPassword !== '') {
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    updates.push('password = ?'); params.push(hashPassword(String(newPassword)));
    passwordChanged = true;
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });
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
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!comparePassword(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashPassword(newPassword), req.admin.id);
  res.json({ message: 'Password updated.' });
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
  if (!data) return res.status(400).json({ error: 'File data is required.' });

  const match = String(data).match(/^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/);
  const filenameExt = path.extname(String(filename || '')).slice(1).toLowerCase();
  const declaredType = match && match[1].toLowerCase();
  const ext = match && (UPLOAD_TYPES[declaredType] || ((!declaredType || declaredType === 'application/octet-stream') && UPLOAD_EXTENSIONS.has(filenameExt) ? (filenameExt === 'jpeg' ? 'jpg' : filenameExt) : ''));
  if (!match || !ext) return res.status(400).json({ error: 'Unsupported file. Use PNG, JPG, WebP, GIF, PDF, TXT, CSV, Word, Excel, or PowerPoint.' });

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return res.status(400).json({ error: 'File is empty.' });
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'File too large (max 5MB).' });

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
    if (!ok) return res.status(400).json({ error: 'File content does not match its extension.' });
    if (ext === 'webp' && buffer.toString('ascii', 8, 12) !== 'WEBP') {
      return res.status(400).json({ error: 'File content does not match its extension.' });
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
  const chatSessions = db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM chat_messages').get().count;
  const chatMessages = db.prepare("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'user'").get().count;
  const chatRepliesCustomized = db.prepare("SELECT COUNT(*) as count FROM chatbot_replies WHERE reply_en != '' OR reply_ar != ''").get().count;
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
    chatSessions,
    chatMessages,
    chatRepliesCustomized,
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
   15. ADMIN — CHAT LOGS
   ============================================================ */

router.get('/admin/chats', authMiddleware, (req, res) => {
  const sessions = db.prepare(`
    SELECT session_id,
           COUNT(*) AS messages,
           SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_messages,
           MAX(language) AS language,
           MIN(created_at) AS started_at,
           MAX(created_at) AS last_at
    FROM chat_messages
    GROUP BY session_id
    ORDER BY last_at DESC
    LIMIT 200
  `).all();
  res.json(sessions);
});

/* CSV export — must be declared before /admin/chats/:sessionId */
router.get('/admin/chats-export', authMiddleware, (req, res) => {
  const rows = db.prepare(
    'SELECT session_id, role, message, intent, language, created_at FROM chat_messages ORDER BY session_id, id'
  ).all();
  const csvEscape = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const header = 'session_id,role,message,intent,language,created_at';
  const lines = rows.map(r =>
    [r.session_id, r.role, r.message, r.intent, r.language, r.created_at].map(csvEscape).join(',')
  );
  const csv = '\uFEFF' + [header, ...lines].join('\r\n');  // BOM so Arabic opens correctly in Excel
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="noviq-chats-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

router.get('/admin/chats/:sessionId', authMiddleware, (req, res) => {
  const messages = db.prepare(
    'SELECT role, message, intent, language, created_at FROM chat_messages WHERE session_id = ? ORDER BY id'
  ).all(req.params.sessionId);
  if (!messages.length) return res.status(404).json({ error: 'Session not found.' });
  res.json({ sessionId: req.params.sessionId, messages });
});

router.delete('/admin/chats/:sessionId', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(req.params.sessionId);
  res.json({ deleted: result.changes });
});

/* ============================================================
   16. ADMIN — REGISTERED USERS
   ============================================================ */

router.get('/admin/users', authMiddleware, (req, res) => {
  const users = db.prepare(
    'SELECT id, first_name, last_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 500'
  ).all();
  res.json(users);
});

router.delete('/admin/users/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found.' });
  res.json({ message: 'User deleted.' });
});

/* Admin sets a new password for a site user (e.g. support reset). Minimum 8 characters. */
router.put('/admin/users/:id/password', authMiddleware, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const result = db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashPassword(String(newPassword)), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found.' });
  logs.logEvent('info', 'users', `Admin reset password for user #${req.params.id}`, req);
  res.json({ message: 'User password updated.' });
});

/* ============================================================
   17. ADMIN — DATA EXPORTS
   ============================================================ */

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

const OBJECT_KEYS = ['brand', 'hero', 'servicesHeader', 'whyHeader', 'industriesHeader', 'portfolioHeader', 'processHeader', 'testimonialsHeader', 'stackHeader', 'contact', 'footer', 'clientsHeader', 'promptBuilder', 'resources', 'team', 'solutionBuilder', 'costEstimator', 'assessment', 'aiConsultant'];
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
    return res.status(400).json({ error: `mode must be one of: ${[...VALID_MOTION_MODES].join(', ')}` });
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
    if (result.fileWritten === false) {
      return res.status(207).json({ message: 'Database is current, but static file sync failed.', keys: result.keys, fileWritten: false, fileError: result.fileError });
    }
    res.json({ message: 'Content config rebuilt successfully.', keys: result.keys, fileWritten: true });
  } catch (err) {
    console.error('[Content Rebuild] Error:', err);
    res.status(500).json({ error: 'Failed to rebuild content config.' });
  }
});

router.post('/admin/content/promptBuilder/reset', authMiddleware, (req, res) => {
  const value = cloneDefaults();
  const current = db.prepare("SELECT value FROM content WHERE key = 'promptBuilder'").get();
  if (current) {
    try { value.revision = (JSON.parse(current.value).revision || 1) + 1; } catch {}
  }
  db.prepare(`INSERT INTO content (key, value, updated_at) VALUES ('promptBuilder', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(JSON.stringify(value));
  const syncPb = rebuildConfigFile();
  res.json({ key: 'promptBuilder', value, message: 'Prompt Builder defaults restored.', fileWritten: syncPb.fileWritten !== false, ...(syncPb.fileWritten === false ? { fileWarning: 'Saved to database, but static file sync failed: ' + (syncPb.fileError || '') } : {}) });
});

router.get('/admin/content/:key', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT value, updated_at FROM content WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'Key not found.' });
  try { res.json({ key: req.params.key, value: JSON.parse(row.value), updated_at: row.updated_at }); }
  catch { res.json({ key: req.params.key, value: row.value, updated_at: row.updated_at }); }
});

router.put('/admin/content/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  if (!ALL_KEYS.includes(key)) {
    return res.status(400).json({ error: `Invalid key. Must be one of: ${ALL_KEYS.join(', ')}` });
  }

  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: 'Value is required.' });
  }

  let normalizedValue = value;
  if (key === 'promptBuilder') {
    const validated = validatePromptBuilder(value);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const current = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
    if (current) {
      try {
        const revision = JSON.parse(current.value).revision || 1;
        if ((validated.value.revision || 1) !== revision) return res.status(409).json({ error: 'Prompt Builder was updated elsewhere. Reload and try again.' });
        validated.value.revision = revision + 1;
      } catch {}
    }
    normalizedValue = validated.value;
  } else if (key === 'resources') {
    const validated = validateResources(value);
    if (validated.error) return res.status(400).json({ error: validated.error });
    normalizedValue = validated.value;
  } else if (key === 'team') {
    const validated = validateTeam(value);
    if (validated.error) return res.status(400).json({ error: validated.error });
    normalizedValue = validated.value;
  } else if (key === 'solutionBuilder') {
    const validated = validateSolutionBuilder(value);
    if (validated.error) return res.status(400).json({ error: validated.error });
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
  res.json({ key, value: normalizedValue, message: 'Content updated successfully.', fileWritten: sync.fileWritten !== false, ...(sync.fileWritten === false ? { fileWarning: 'Saved to database and live on co-hosted site, but static file sync failed: ' + (sync.fileError || 'check FRONTEND_DIR') } : {}) });
});

router.put('/admin/content/:key/array', authMiddleware, (req, res) => {
  const { key } = req.params;
  if (!ARRAY_KEYS.includes(key)) {
    return res.status(400).json({ error: `Key must be an array type. Valid: ${ARRAY_KEYS.join(', ')}` });
  }

  const { index, item } = req.body;
  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: 'Key not found.' });

  let arr;
  try { arr = JSON.parse(row.value); } catch { return res.status(500).json({ error: 'Failed to parse existing data.' }); }

  if (index !== undefined && index !== null) {
    if (index < 0 || index >= arr.length) return res.status(400).json({ error: 'Index out of range.' });
    arr[index] = item;
  } else {
    arr.push(item);
  }

  db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(JSON.stringify(arr), key);
  const syncArr = rebuildConfigFile();
  res.json({ key, value: arr, message: 'Array item updated.', fileWritten: syncArr.fileWritten !== false, ...(syncArr.fileWritten === false ? { fileWarning: 'Saved to database, static file sync failed: ' + (syncArr.fileError || '') } : {}) });
});

router.delete('/admin/content/:key/array/:index', authMiddleware, (req, res) => {
  const { key, index } = req.params;
  const idx = parseInt(index);
  if (!ARRAY_KEYS.includes(key)) return res.status(400).json({ error: 'Key must be an array type.' });

  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: 'Key not found.' });

  let arr;
  try { arr = JSON.parse(row.value); } catch { return res.status(500).json({ error: 'Failed to parse data.' }); }
  if (idx < 0 || idx >= arr.length) return res.status(400).json({ error: 'Index out of range.' });

  arr.splice(idx, 1);
  db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(JSON.stringify(arr), key);
  const syncDel = rebuildConfigFile();
  res.json({ key, value: arr, message: 'Item removed.', fileWritten: syncDel.fileWritten !== false, ...(syncDel.fileWritten === false ? { fileWarning: 'Saved to database, static file sync failed: ' + (syncDel.fileError || '') } : {}) });
});

module.exports = router;
