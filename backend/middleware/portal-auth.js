/* ============================================================
   NOVIQ — user (client) auth middleware
   ------------------------------------------------------------
   The admin has its own gate (adminAuthMiddleware) that also requires an
   admin_sessions row. The client portal needs the equivalent guard for the
   `users` table, and the asymmetry matters:

     · a USER token must NOT open admin routes (tokenType 'user')
     · an ADMIN token must NOT be treated as a client identity
   Both directions are enforced explicitly rather than by "has a token".
   A token that merely verifies is not an authorization.

   401 vs 403 is deliberate and load-bearing:
     401 = "who are you" (missing / invalid / expired / revoked)
     403 = "I know who you are, but not allowed" — specifically a wrong-typed
           token hitting the wrong surface.
   The frontend uses that difference to decide between "session expired,
   send them back to login" and "wrong account type".

   Session revocation: the admin path checks admin_sessions. The client path
   cannot, because user tokens are stateless (middleware/auth.js signs a
   24h JWT with no server-side record). `touchUserSession` below keeps the
   last-seen timestamp for auditing; revoking is deliberately NOT faked.
   ============================================================ */
const db = require('../db/init');
const { verifyToken } = require('./auth');

/** 24h, matching the token expiry in middleware/auth.js. */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function bearer(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Gate for the signed-in client dashboard.
 * Sets req.user = { id, email, firstName, lastName, phone, avatar, role }.
 */
function userAuthMiddleware(req, res, next) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to view this.' } });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Please sign in again.' } });
  }

  /* An admin token presented here is a wrong-surface access, not a bad
     session. Saying 401 would tell the frontend to bounce to the client
     login page, which is the wrong destination for the admin. */
  if (decoded.tokenType === 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This is a client area. Use the admin dashboard.' } });
  }
  if (decoded.tokenType !== 'user') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This token cannot access the client dashboard.' } });
  }

  /* Read the user fresh rather than trusting the token body: a deleted or
     demoted account must stop working immediately, not at token expiry. */
  const row = db
    .prepare('SELECT id, first_name, last_name, email, phone, avatar, role FROM users WHERE id = ?')
    .get(decoded.id);
  if (!row) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'This account no longer exists.' } });
  }

  req.user = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone || '',
    avatar: row.avatar || '',
    role: row.role,
  };
  req.userToken = token;
  touchUserSession(row.id);
  next();
}

/**
 * Gate for admin routes that must ALSO accept a client identity.
 *
 * Deliberately NOT used by the existing admin routes — those keep
 * adminAuthMiddleware and their session table. This exists for the case
 * where an endpoint needs to serve both surfaces (the project-progress
 * view the owner reads and the admin reads).
 */
function userOrAdminMiddleware(req, res, next) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to view this.' } });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Please sign in again.' } });
  }

  if (decoded.tokenType === 'admin') {
    const admin = db
      .prepare('SELECT id, username, role FROM admin_users WHERE id = ?')
      .get(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'This administrator account no longer exists.' } });
    }
    req.admin = { ...decoded, username: admin.username };
    req.adminToken = token;
    return next();
  }

  if (decoded.tokenType !== 'user') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This token cannot access this area.' } });
  }
  const row = db
    .prepare('SELECT id, first_name, last_name, email, phone, avatar, role FROM users WHERE id = ?')
    .get(decoded.id);
  if (!row) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'This account no longer exists.' } });
  }
  req.user = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone || '',
    avatar: row.avatar || '',
    role: row.role,
  };
  req.userToken = token;
  touchUserSession(row.id);
  next();
}

/**
 * Best-effort last-seen record. Wrapped in try/catch and never awaited: it
 * is telemetry, and a telemetry write must never fail a request or hold the
 * event loop on a locked volume.
 */
function touchUserSession(userId) {
  try {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(`user_seen_${userId}`, new Date().toISOString());
  } catch {
    /* ignore — see above */
  }
}

module.exports = { userAuthMiddleware, userOrAdminMiddleware, SESSION_MAX_AGE_MS };
