/* ============================================================
   BACKEND TEST RUNNER
   ------------------------------------------------------------
   Runs every backend test suite in its own process (the suites each
   `require('../app')` and bind their own port, so they must not share
   a process) and aggregates the results.

       node tests/run-all.js            # all suites
       node tests/run-all.js security   # only suites matching "security"
   ============================================================ */
const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  /* Read-only and standalone: no port bound, no app instance, temp dirs
     only. Both run FIRST because they guard the two things that are
     expensive to discover later — a stale i18n seed means the admin opens
     the editor on strings the site is not serving, and a broken
     backup/restore is only noticed when the database is already gone. */
  'i18n-seed.test.js',
  /* A .dockerignore entry can delete a module the app requires, and that
     only shows up as a boot-crash on the server. Cheap to check statically. */
  'image-shipped.test.js',
  /* The dashboard is unbundled inline JS/CSS: nothing type-checks it, so
     interface regressions are silent until an admin clicks. */
  'admin-ui.test.js',
  'backup-store.test.js',
  'backup-restore.test.js',
  /* Binds its own port against a temp database, so it must run AFTER the
     two standalone suites above and not share a process with them. */
  'admin-backup-routes.test.js',
  'portal.test.js',
  'portal-admin-extra.test.js',
  'portal-messages-profile.test.js',
  'portal-avatar-requests.test.js',
  'portal-demo-seed.test.js',
  'prompt-builder.test.js',
  'imagegen-route.test.js',
  'security.test.js',
  'security-posture.test.js',
  'content-visuals.test.js',
  /* The CMS is admin-editable data, not code: corruption arrives as stored
     rows (mojibake labels once pushed every Arabic page 597px off-screen),
     which no static test can see. The detector itself is unit-tested here
     offline; the live run is `npm run audit:content`. */
  'content-audit.test.js',
  /* Footer columns, contact and the dedicated editor (mojibake-era lesson:
     the editor must match what the footer renders, or edits go nowhere). */
  'footer-content.test.js',
  'admin-content.test.js',
  'content-pricing.test.js',
  'agent-bus-smoke.test.js',
  /* chatbot.test.js removed 2026-09-27 with the chatbot itself */
];

const filter = process.argv[2];
const selected = filter ? SUITES.filter((s) => s.includes(filter)) : SUITES;

if (selected.length === 0) {
  console.error(`No suites match "${filter}". Available: ${SUITES.join(', ')}`);
  process.exit(1);
}

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      resolve({ file, ok: code === 0, ms: Date.now() - started });
    });
    child.on('error', () => resolve({ file, ok: false, ms: Date.now() - started }));
  });
}

(async () => {
  console.log(`\nRunning ${selected.length} backend test suite(s)\n${'='.repeat(52)}`);
  const results = [];
  for (const suite of selected) {
    console.log(`\n>>> ${suite}`);
    results.push(await run(suite));
  }

  console.log(`\n${'='.repeat(52)}\nSUMMARY\n${'='.repeat(52)}`);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.file.padEnd(28)} ${(r.ms / 1000).toFixed(1)}s`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} suites passed\n`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
