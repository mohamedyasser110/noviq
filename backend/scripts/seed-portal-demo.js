/* ============================================================
   NOVIQ — seed demo client-portal data ("try it" fixture)
   ------------------------------------------------------------
   Creates ONE demo client plus a realistic project tree, so the two
   linked interfaces have something to show without any clicking:

     user        demo@noviq.local / Demo1234!  (role: user)
     project     "Noviq Corporate Website" (status: active)
     milestones  the 5 delivery steps below (mixed progress)
     contract    "Website Development Agreement" (status: active)
     messages    3 unread notifications (project/contract/message)

   IDEMPOTENT: every insert is guarded by "does this exact demo row
   already exist". Running it twice changes nothing — the second run
   reports `created: false` for everything. Safe to run on production
   (Railway volume) and on a developer machine alike.

   Usage:
       node scripts/seed-portal-demo.js            # human-readable
       node scripts/seed-portal-demo.js --json     # machine-readable

   Respects DB_PATH like everything else (tests point it at temp dirs).
   Refuses to run when the database file's folder does not exist, rather
   than creating a database in the wrong place.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const DEMO_EMAIL = 'demo@noviq.local';
const DEMO_PASSWORD = 'Demo1234!';
const PROJECT_NAME = 'Noviq Corporate Website';

/* The delivery steps the admin page and the client dashboard both render.
   Five steps, mixed states: two done, one mid-flight, one just started,
   one untouched — so progress bars, badges and the rollup all show
   something interesting on first login. Weights are 1 throughout, so the
   headline = the plain average (100+100+65+10+0)/5 = 55%. */
const DEMO_STEPS = [
  { title: 'Discovery & Scope', description: 'Requirements workshops, sitemap and technical scope sign-off.', progress: 100, status: 'done', dueDate: '2026-08-15' },
  { title: 'UI/UX Design', description: 'Homepage + inner pages designed in Figma, two revision rounds.', progress: 100, status: 'done', dueDate: '2026-09-05' },
  { title: 'Development', description: 'Next.js build, CMS wiring and Arabic/English content entry.', progress: 65, status: 'in-progress', dueDate: '2026-10-20' },
  { title: 'Testing & Review', description: 'QA pass, performance audit and client review round.', progress: 10, status: 'in-progress', dueDate: '2026-10-30' },
  { title: 'Launch & Handover', description: 'Production deploy, analytics handover and training session.', progress: 0, status: 'pending', dueDate: '2026-11-10' },
];

const DEMO_CONTRACT = {
  title: 'Website Development Agreement',
  reference: 'NOVIQ-2026-001',
  value: 4800.0,
  currency: 'USD',
  status: 'active',
  signedAt: '2026-09-01',
  startsOn: '2026-08-10',
  endsOn: '2026-11-10',
  notes: [
    'Scope: corporate website (EN/AR), CMS-driven content, contact + consultation flows.',
    'Milestone payments: 30% on design sign-off ($1,440) · 40% on development complete ($1,920) · 30% on launch ($1,440).',
    'Includes 30 days of post-launch support. Extra revisions billed at $60/hour.',
  ].join('\n'),
};

const DEMO_MESSAGES = [
  { type: 'project', title: 'New project: Noviq Corporate Website', body: 'Your project dashboard is ready — milestones, contract and progress all live here.' },
  { type: 'contract', title: 'Contract active: Website Development Agreement', body: 'Reference NOVIQ-2026-001 · $4,800.00 USD · valid 2026-08-10 → 2026-11-10.' },
  { type: 'message', title: 'Development is at 65%', body: 'Hi! The build phase just passed 65% — homepage and services pages are in review. Nothing needed from you yet.' },
];

/* A starter thread for the two-way conversation: the client's question is
   UNREAD (so the admin inbox demo has something waiting), the team's
   answer is already read (so the client badge demo stays exactly the 3
   announcement notifications above). */
const DEMO_THREAD = [
  { sender: 'client', body: 'Hi! Is the homepage copy final, or should we send revised text?', is_read: 0 },
  { sender: 'admin', body: 'Good timing — send the revised text whenever ready, we slot it in before Thursday\u2019s review.', is_read: 1 },
];

/* A pending activation request: the admin triage demo starts with work
   waiting (badge + requests tab), the client dashboard demo shows the
   "under review" state. Guarded like everything else. */
const DEMO_REQUEST = {
  title: 'Mobile App for Field Sales',
  category: 'mobile-app',
  budget: '$5k–$10k',
  timeline: '3–6 months',
  description: 'Offline-first Android app for the field team: visit check-ins, order capture and daily sync.',
};

function fail(msg) {
  console.error(`[seed-portal-demo] ${msg}`);
  process.exit(1);
}

/* The fixture as a reusable function: the CLI below calls it with the
   booted database, and routes/portal.js exposes it as POST
   /api/admin/portal/seed-demo (admin-only) so production can be seeded
   with one authenticated call instead of container SSH. Returns the same
   `out` summary object either way. */
function seedPortalDemo(db, hashPassword) {
  const out = { user: null, project: null, milestones: 0, contract: null, notifications: 0, created: {} };

  /* --- user --- */
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
  if (!user) {
    const r = db.prepare('INSERT INTO users (first_name, last_name, email, password) VALUES (?,?,?,?)')
      .run('Demo', 'Client', DEMO_EMAIL, hashPassword(DEMO_PASSWORD));
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    out.created.user = true;
  }
  out.user = { id: user.id, email: user.email };

  /* --- project --- */
  let project = db.prepare('SELECT * FROM projects WHERE user_id = ? AND name = ?').get(user.id, PROJECT_NAME);
  if (!project) {
    const r = db.prepare(
      'INSERT INTO projects (user_id, name, summary, status, start_date, target_date) VALUES (?,?,?,?,?,?)'
    ).run(user.id, PROJECT_NAME,
      'Corporate website rebuild: bilingual marketing site with CMS-driven content and lead capture.',
      'active', '2026-08-10', '2026-11-10');
    project = db.prepare('SELECT * FROM projects WHERE id = ?').get(r.lastInsertRowid);
    out.created.project = true;
  }
  out.project = { id: project.id, name: project.name };

  /* --- milestones (the steps) --- */
  const existing = db.prepare('SELECT count(*) AS n FROM milestones WHERE project_id = ?').get(project.id).n;
  if (existing === 0) {
    const ins = db.prepare(
      'INSERT INTO milestones (project_id, title, description, progress, weight, status, due_date, position, completed_at) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    DEMO_STEPS.forEach((s, i) => {
      ins.run(project.id, s.title, s.description, s.progress, 1, s.status, s.dueDate, i,
        s.status === 'done' ? s.dueDate : '');
    });
    out.created.milestones = true;
  }
  /* Recompute the headline exactly like routes/portal.js does (equal
     weights → plain average), so the seed never disagrees with the API. */
  const rows = db.prepare('SELECT progress, weight FROM milestones WHERE project_id = ?').all(project.id);
  const totalW = rows.reduce((s, r) => s + Math.max(1, r.weight), 0);
  const pct = Math.round(rows.reduce((s, r) => s + r.progress * Math.max(1, r.weight), 0) / totalW);
  db.prepare('UPDATE projects SET progress_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pct, project.id);
  out.milestones = db.prepare('SELECT count(*) AS n FROM milestones WHERE project_id = ?').get(project.id).n;
  out.progress = pct;

  /* --- contract --- */
  let contract = db.prepare('SELECT * FROM contracts WHERE user_id = ? AND reference = ?').get(user.id, DEMO_CONTRACT.reference);
  if (!contract) {
    const r = db.prepare(
      `INSERT INTO contracts (project_id, user_id, title, reference, value_cents, currency, status, signed_at, starts_on, ends_on, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(project.id, user.id, DEMO_CONTRACT.title, DEMO_CONTRACT.reference,
      Math.round(DEMO_CONTRACT.value * 100), DEMO_CONTRACT.currency, DEMO_CONTRACT.status,
      DEMO_CONTRACT.signedAt, DEMO_CONTRACT.startsOn, DEMO_CONTRACT.endsOn, DEMO_CONTRACT.notes);
    contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(r.lastInsertRowid);
    out.created.contract = true;
  }
  out.contract = { id: contract.id, reference: contract.reference, status: contract.status };

  /* --- notifications (left UNREAD: the dashboard badge is the demo) --- */
  const haveNotes = db.prepare("SELECT count(*) AS n FROM notifications WHERE user_id = ? AND title LIKE 'New project: Noviq Corporate Website%'").get(user.id).n;
  if (haveNotes === 0) {
    const ins = db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)');
    for (const m of DEMO_MESSAGES) ins.run(user.id, m.type, m.title, m.body, '/en/account');
    out.created.notifications = true;
  }
  out.notifications = db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(user.id).n;
  out.login = { email: DEMO_EMAIL, password: DEMO_PASSWORD };

  /* --- two-way thread (guarded like everything else: top-up only) --- */
  const haveThread = db.prepare('SELECT count(*) AS n FROM client_messages WHERE user_id = ?').get(user.id).n;
  if (haveThread === 0) {
    const ins = db.prepare("INSERT INTO client_messages (user_id, sender, body, is_read) VALUES (?,?,?,?)");
    for (const m of DEMO_THREAD) ins.run(user.id, m.sender, m.body, m.is_read);
    out.created.thread = true;
  }
  out.thread = db.prepare('SELECT count(*) AS n FROM client_messages WHERE user_id = ?').get(user.id).n;
  out.threadUnreadForAdmin = db.prepare("SELECT count(*) AS n FROM client_messages WHERE user_id = ? AND sender = 'client' AND is_read = 0").get(user.id).n;

  /* --- activation request (pending triage) --- */
  const haveRequest = db.prepare('SELECT count(*) AS n FROM project_requests WHERE user_id = ? AND title = ?').get(user.id, DEMO_REQUEST.title).n;
  if (haveRequest === 0) {
    db.prepare('INSERT INTO project_requests (user_id, title, category, budget, timeline, description) VALUES (?,?,?,?,?,?)')
      .run(user.id, DEMO_REQUEST.title, DEMO_REQUEST.category, DEMO_REQUEST.budget, DEMO_REQUEST.timeline, DEMO_REQUEST.description);
    out.created.request = true;
  }
  const reqRow = db.prepare('SELECT id, status FROM project_requests WHERE user_id = ? AND title = ?').get(user.id, DEMO_REQUEST.title);
  out.request = { id: reqRow.id, status: reqRow.status };
  return out;
}

function main() {
  const asJson = process.argv.includes('--json');

  const config = require('../config');
  const dbFile = config.DB_PATH;
  if (!fs.existsSync(path.dirname(dbFile))) {
    fail(`database folder does not exist: ${path.dirname(dbFile)} (refusing to seed the wrong place)`);
  }

  /* Requiring db/init boots the full schema (including the portal tables
     via create-client-portal-schema) — the fixture can never run ahead of
     its own tables. */
  const db = require('../db/init');
  const { hashPassword } = require('../middleware/auth');
  const out = seedPortalDemo(db, hashPassword);

  if (asJson) {
    console.log(JSON.stringify(out));
  } else {
    console.log('[seed-portal-demo] demo fixture ready:');
    console.log(`  login    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`  project  #${out.project.id} "${out.project.name}" — ${out.milestones} steps, ${out.progress}%`);
    console.log(`  contract ${out.contract.reference} (${out.contract.status})`);
    console.log(`  notes    ${out.notifications} notification(s)`);
    console.log(`  thread   ${out.thread} message(s), ${out.threadUnreadForAdmin} unread for the team`);
    console.log(`  request  #${out.request.id} "${DEMO_REQUEST.title}" (${out.request.status})`);
    const fresh = Object.keys(out.created);
    console.log(fresh.length ? `  created  ${fresh.join(', ')}` : '  created  nothing (already seeded)');
  }
}

if (require.main === module) main();

module.exports = { seedPortalDemo, DEMO_EMAIL, DEMO_PASSWORD, PROJECT_NAME, DEMO_STEPS, DEMO_CONTRACT, DEMO_THREAD, DEMO_REQUEST };
