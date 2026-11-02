/* ============================================================
   NOVIQ API — USER AUTH (register / login / password reset)
   Rate-limited per IP via authLimiter (applies to every route here,
   same as the old router.use('/auth', authLimiter)).
   Contracts: contracts/api/auth.*
   ============================================================ */
const { Router } = require('express');
const crypto = require('crypto');
const db = require('../db/init');
const config = require('../config');
const { generateToken, comparePassword, hashPassword } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { createLimiter } = require('../config/rate-limit');
const { EMAIL_PATTERN } = require('./_shared');

const router = Router();

/* Public auth: 10 attempts / 10 minutes per IP (register + login + reset) */
const authLimiter = createLimiter('auth');
/* Path-scoped exactly like the old router.use('/auth', authLimiter):
   a bare router.use() here would count EVERY request through this mount. */
router.use('/auth', authLimiter);

router.post('/auth/register', (req, res) => {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!firstName || !email || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' } });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' } });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' } });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'An account with this email already exists.' } });
  }

  const result = db.prepare(
    'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)'
  ).run(firstName, lastName, email, hashPassword(password));
  const user = { id: result.lastInsertRowid, firstName, lastName, email, phone: '', avatar: '', role: 'user' };
  const token = generateToken({ id: user.id, email: user.email, role: user.role, tokenType: 'user' });
  res.status(201).json({ token, user });
});

router.post('/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' } });
  }

  const record = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!record || !comparePassword(password, record.password)) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password.' } });
  }

  const user = {
    id: record.id,
    firstName: record.first_name,
    lastName: record.last_name,
    email: record.email,
    phone: record.phone || '',
    avatar: record.avatar || '',
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
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' } });
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
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email, code, and new password are required.' } });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' } });
  }

  const row = db.prepare('SELECT * FROM password_resets WHERE email = ? AND code = ?').get(email, code);
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired reset code.' } });
  }

  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .run(hashPassword(password), email);
  db.prepare('DELETE FROM password_resets WHERE email = ?').run(email);

  res.json({ message: 'Password updated. You can now sign in.' });
});

/* ============================================================
   9. CHATBOT
   ============================================================ */

module.exports = router;
