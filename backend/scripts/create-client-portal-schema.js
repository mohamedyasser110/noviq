/* ============================================================
   NOVIQ — client portal schema
   ------------------------------------------------------------
   Creates the four tables the signed-in dashboard needs. Idempotent:
   safe to run on every boot, and safe against an existing install.

   WHY NEW TABLES RATHER THAN REUSING solution_builds / assessments
   Those two are LEAD capture: a row means "someone submitted the public
   form", with a free-text `steps` blob and no owner. A client project is
   a different thing — it has an owner, an ordered set of milestones with
   per-milestone progress, a lifecycle status, and a contract with its own
   value, dates and file. Retrofitting those onto a leads table would mean
   adding a nullable column per concept and guessing which rows are real
   projects. New tables are clearer than six half-null columns.

   All four are keyed to `users.id` so a portal session can read exactly
   its own rows and nothing else. That isolation is enforced in the route
   layer (see routes/portal.js) and asserted by tests/portal.test.js — an
   authenticated user must never see another user's project.

       projects     one row per engagement, owned by a user
       milestones   ordered steps belonging to a project
       contracts    a contract/scope document attached to a project
       notifications per-user messages, read/unread tracked

   `user_sessions` is deliberately NOT here. The existing auth flow issues a
   stateless 24h JWT (middleware/auth.js), and revoking it server-side would
   need the admin_sessions pattern. Out of scope for this pass; the logout
   button clears the client token, which is what the current login page
   already implies.
       portable wrappers rather than this file so there is no circular
       require: db/init.js requires this module at the very bottom, and this
       module requiring db/init.js back would hand us a half-initialised
       `db` whose `exec` is not yet attached. Handed the instance in
       instead, the module works from both db/init.js (bootstrap) and a test
       (direct), with no import cycle.
   ============================================================ */

/**
 * @param {import('better-sqlite3').Database} db
 */
function createPortalSchema(db) {
  if (!db || typeof db.exec !== 'function') {
    throw new Error('createPortalSchema needs a database instance (got no exec)');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      summary TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planning',
      /* progress_percent is the rolled-up headline figure. Milestones carry
         their own weights, so this is DENORMALISED on purpose: the dashboard
         renders one number on every card, and recomputing a SUM across
         milestones per card per request is the wrong trade. portal.js
         recalculates and stores it whenever a milestone changes, so it
         cannot drift. */
      progress_percent INTEGER NOT NULL DEFAULT 0,
      start_date TEXT DEFAULT '',
      target_date TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      /* 0-100. Checked in the route layer, not by the schema: SQLite CHECK
         constraints are not added retroactively to an existing table, and a
         CHECK that silently does not apply is worse than none. */
      progress INTEGER NOT NULL DEFAULT 0,
      weight INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      reference TEXT DEFAULT '',
      /* stored in minor units (cents) to keep arithmetic exact; the UI
         divides by 100. A REAL column would accumulate float drift across
         repeated invoice math, which is the one place drift is unacceptable. */
      value_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'draft',
      signed_at TEXT DEFAULT '',
      starts_on TEXT DEFAULT '',
      ends_on TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      /* Optional attachment (scan/photo of the signed paper): a relative
         path produced by POST /admin/upload, e.g.
         images/uploads/1719-contract.pdf. Never an absolute URL — the file
         must live on this server so it restores with the backup. */
      file TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      /* NULL means broadcast: every signed-in user sees it. A specific
         user_id scopes it to one person (e.g. "your contract was signed").
         Read state for broadcasts is tracked per user in
         notification_reads, since one shared row cannot carry per-reader
         state. */
      user_id INTEGER,
      type TEXT NOT NULL DEFAULT 'news',
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, user_id),
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, position);
    CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);

    /* Two-way conversation between the team and one client. Unlike
       notifications (one-way announcements the admin fires and forgets),
       every row has a sender side, and is_read tracks the RECIPIENT's state:
       a client row with is_read = 0 is waiting for the admin, an admin row
       with is_read = 0 is waiting for the client. Either side marks its own
       incoming rows read when it opens the thread. */
    CREATE TABLE IF NOT EXISTS client_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender TEXT NOT NULL DEFAULT 'client',
      body TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_client_messages_user ON client_messages(user_id, created_at);

    /* Project activation requests: a client asks for a new engagement with
       structured preset data (category/budget/timeline) instead of a blank
       message. The admin triages them in Client Projects (approve/reject +
       one-click project creation); the client tracks the status on their
       dashboard. admin_note carries the reason shown for rejections. */
    CREATE TABLE IF NOT EXISTS project_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      budget TEXT DEFAULT '',
      timeline TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      admin_note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_requests_user ON project_requests(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_project_requests_status ON project_requests(status, created_at);
  `);

  /* Foreign keys are OFF by default in SQLite and must be enabled per
     connection. ON DELETE CASCADE above only fires when they are. */
  db.pragma('foreign_keys = ON');

  return {
    projects: 'projects',
    milestones: 'milestones',
    contracts: 'contracts',
    notifications: 'notifications',
    notificationReads: 'notification_reads',
  };
}

/* CLI use: `node scripts/create-client-portal-schema.js` opens its own
   connection so the schema can be applied without booting the server. */
if (require.main === module) {
  const Database = require('better-sqlite3');
  const config = require('../config');
  const own = new Database(config.DB_PATH);
  try {
    createPortalSchema(own);
    console.log('[portal-schema] ready (projects, milestones, contracts, notifications)');
  } finally {
    own.close();
  }
}

module.exports = { createPortalSchema };
