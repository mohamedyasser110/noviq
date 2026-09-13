const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db/init');
const config = require('../config');

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES = '24h';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(payload) {
  /* jti guarantees every token string is unique, even for two logins in the same second.
     Without it, identical tokens break per-session revocation (logout / password-change kill). */
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function ensureAdminUser() {
  /* Tables are created centrally in db/init.js; this is a safety net. */
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );
  `);

  const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!adminExists) {
    const defaultPassword = config.ADMIN_PASSWORD;
    db.prepare('INSERT INTO admin_users (username, password, role, email) VALUES (?, ?, ?, ?)').run(
      'admin',
      hashPassword(defaultPassword),
      'admin',
      config.ADMIN_EMAIL || ''
    );
    if (config.NODE_ENV !== 'production') {
      console.log('[Admin] Default admin created — username: admin');
      console.log('[Admin] ⚠️  Change ADMIN_PASSWORD in production via env var!');
    } else {
      console.log('[Admin] Default admin created — username: admin (password from env)');
    }
  }
  /* Backfill admin email from env when the stored one is empty (never overwrites a user-set email). */
  try {
    if (config.ADMIN_EMAIL) {
      const row = db.prepare('SELECT id, email FROM admin_users WHERE username = ?').get('admin');
      if (row && !row.email) db.prepare('UPDATE admin_users SET email = ? WHERE id = ?').run(config.ADMIN_EMAIL, row.id);
    }
  } catch {}
  /* Cleanup: drop duplicate session rows sharing one token string (legacy DBs created
     before per-token uniqueness mattered). Keeps the newest row per token. */
  try {
    db.exec('DELETE FROM admin_sessions WHERE id NOT IN (SELECT MAX(id) FROM admin_sessions GROUP BY token)');
  } catch {}
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.admin = decoded;
  next();
}

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No admin token provided.' });
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired admin token.' });
  if (decoded.role !== 'admin' || decoded.tokenType !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  const session = db.prepare(`
    SELECT s.id, a.id AS admin_id, a.username, a.role
    FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
    WHERE s.token = ? AND s.admin_id = ?
  `).get(token, decoded.id);
  if (!session || session.role !== 'admin') return res.status(401).json({ error: 'Admin session is no longer active.' });
  req.admin = { ...decoded, username: session.username };
  req.adminToken = token;
  next();
}

module.exports = {
  JWT_SECRET,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  ensureAdminUser,
  authMiddleware,
  adminAuthMiddleware,
};
