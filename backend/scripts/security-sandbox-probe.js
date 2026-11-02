/* ============================================================
   Sandbox probe — runs INSIDE a --permission child
   ------------------------------------------------------------
   Spawned by scripts/security-sandbox.js. Kept as a real file rather
   than `node -e "<code>"`: on this platform the inline form exited 0
   without executing or reporting anything when spawned from a parent
   that had already started children, which made correct sandbox
   behaviour indistinguishable from a probe that never ran.

   Usage: node scripts/security-sandbox-probe.js <verdictFile> <check>
   It writes exactly one line to <verdictFile> and exits. The parent
   reads that file; absence of the file means the probe never ran.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , verdictFile, check] = process.argv;

function say(message) {
  try {
    fs.writeFileSync(verdictFile, String(message));
  } catch {
    /* nothing else to do: the parent will report a missing verdict */
  }
}

/* Exit explicitly after reporting. Loading app.js leaves the SQLite handle
   and the backup timer on the event loop, so without this the parent waits
   out its whole timeout on a probe that already finished its work. */
function finish(message) {
  say(message);
  process.exit(0);
}

/* A permission failure says "use --allow-fs-write" without naming the path.
   The top frames are what turns "the app cannot load" into "the app tries
   to write X", which is the difference between a fix and a shrug. */
function where(e) {
  const frames = String((e && e.stack) || '')
    .split('\n')
    .slice(1, 4)
    .map((l) => l.trim())
    .join(' <- ');
  return frames ? ' | ' + frames : '';
}

const code = (e) => e && (e.code || e.name) || 'no-error-code';

try {
  switch (check) {
    case 'escape-read':
      // No read grant for the home directory.
      try {
        fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_rsa'), 'utf8');
        say('LEAKED');
      } catch (e) {
        say(code(e));
      }
      break;

    case 'escape-write':
      // No write grant for the project root.
      try {
        fs.writeFileSync(path.join(process.env.PROBE_ROOT, 'pwned.txt'), 'x');
        say('WROTE');
      } catch (e) {
        say(code(e));
      }
      break;

    case 'child-process':
      try {
        require('child_process').execSync('echo hi');
        say('SPAWNED');
      } catch (e) {
        say(code(e));
      }
      break;

    case 'worker':
      try {
        new (require('worker_threads').Worker)('require("path")', { eval: true });
        say('WORKER RAN');
      } catch (e) {
        say(code(e));
      }
      break;

    case 'load-app':
      // The real app: DB init, migrations, seed, all under a minimal
      // allowlist. If anything in the tree reaches outside it, the load
      // fails here and the parent reports it.
      process.env.NODE_ENV = 'test';
      try {
        require(path.join(process.env.PROBE_ROOT, 'app.js'));
        finish('APP LOADED UNDER SANDBOX');
      } catch (e) {
        finish('LOAD FAILED: ' + String(e && e.message).slice(0, 160) + where(e));
      }
      break;

    default:
      finish('unknown check: ' + check);
  }
} catch (e) {
  finish('PROBE THREW: ' + String(e && e.message).slice(0, 160) + where(e));
}