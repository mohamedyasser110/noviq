/* ============================================================
   NOVIQ — security posture tests
   ------------------------------------------------------------
   Static assertions over the hardening that ships to production. The
   runtime behaviour is proven by scripts/security-sandbox.js (npm run
   security); these pin the configuration so a future edit cannot quietly
   drop the flag, move the event log back into the image layer, or
   reintroduce the boot-time crash the sandbox uncovered.
   ============================================================ */
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

console.log('NOVIQ security posture\n');

/* ---- 1. code generation from strings: verified, deliberately not armed --
   It boots and serves locally (scripts/security-sandbox.js proves it), but
   arming it in the image took the deployed container down with a silent
   502. The suite asserts the documented state so nobody re-arms it blindly. */
{
  const dockerfile = read('Dockerfile');
  const railway = JSON.parse(read('railway.json'));
  ok(!/NODE_OPTIONS=--disallow-code-generation-from-strings/.test(
    dockerfile.replace(/^\s*#.*$/gm, '')),
  'code generation is not disabled in the image (container path unproven)');
  ok(!/--disallow-code-generation-from-strings/.test(railway.deploy.startCommand || ''),
    'Railway start command does not force the flag', railway.deploy.startCommand);
  ok(/DISABLED in the image/.test(dockerfile),
    'the Dockerfile records why the hardening is off');
  ok(/--disallow-code-generation-from-strings/.test(read('scripts', 'security-sandbox.js')),
    'the harness still exercises and verifies the flag');
}

/* ---- 2. the agent event log is not pinned to the image layer --------- */
{
  const bus = read('.agent-system', 'message-bus.js');
  ok(/AGENT_EVENTS_LOG/.test(bus), 'event log honours AGENT_EVENTS_LOG');
  ok(/AGENT_STORAGE_DIR \|\| process\.env\.STORAGE_DIR/.test(bus),
    'event log falls back to the persistent storage dir');
  ok(!/const EVENTS_LOG = path\.join\(__dirname, 'events', 'recent-events\.log'\);/.test(bus),
    'event log is no longer hardcoded inside the app directory');
  const dockerfile = read('Dockerfile');
  ok(/STORAGE_DIR=\/app\/storage/.test(dockerfile), 'STORAGE_DIR points at the volume');
}

/* ---- 3. the migration probe cannot crash the boot --------------------
   Discovered by the sandbox: under a restricted filesystem existsSync
   throws, and db/init.js assumed it returned false. A convenience
   migration must never stop the server from starting. */
{
  const init = read('db', 'init.js');
  ok(/LEGACY_DB/.test(init) && /try\s*\{\s*if \(!fs\.existsSync\(DB_PATH\)/.test(init),
    'the legacy-DB probe is wrapped so a denied read cannot abort boot');
}

/* ---- 4. the harness itself is wired up ------------------------------ */
{
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.scripts.security === 'node scripts/security-sandbox.js',
    'npm run security runs the harness', pkg.scripts.security);
  ok(pkg.scripts['security:signatures'] === 'npm audit signatures',
    'supply-chain signature audit has a script');
  ok(pkg.scripts['security:sbom'] && /cyclonedx/.test(pkg.scripts['security:sbom']),
    'SBOM generation has a script');
  ok(fs.existsSync(path.join(ROOT, 'scripts', 'security-sandbox-probe.js')),
    'the sandbox probe script exists');
  ok(/--allow-net/.test(read('scripts', 'security-sandbox.js')),
    'the harness documents why network egress is not sandboxable on Node 22');
  ok(/--frozen-intrinsics/.test(read('scripts', 'security-sandbox.js')),
    'the harness records the --frozen-intrinsics finding');
}

/* ---- 5. known dependency vulnerabilities are actually fixed ---------- */
{
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.dependencies.compression === '^1.8.2', 'compression is past the 1.8.2 DoS advisory',
    pkg.dependencies.compression);
  ok(pkg.dependencies.morgan === '^1.12.1', 'morgan is current', pkg.dependencies.morgan);
  ok(pkg.dependencies.nodemailer === '^10.0.15', 'nodemailer is on the fixed major',
    pkg.dependencies.nodemailer);
  ok(pkg.dependencies.qs === '^6.16.0', 'qs is past the array-limit bypass', pkg.dependencies.qs);
  ok(pkg.overrides && /^[\^~]?10\./.test(pkg.overrides['ip-address'] || ''),
    'ip-address is overridden past the SSRF advisories', JSON.stringify(pkg.overrides));
}

/* ---- 6. the audit itself must stay clean ---------------------------- */
{
  let out = '';
  try {
    out = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['audit', '--omit=dev', '--json'],
      { cwd: ROOT, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    /* npm exits 1 when findings exist; the JSON still carries them. */
    out = e.stdout || '';
  }
  let count = null;
  try { count = JSON.parse(out).metadata.vulnerabilities.total; } catch {}
  ok(count === 0, 'npm audit reports no vulnerabilities',
    count === null ? 'could not parse audit output' : `${count} found`);
}

console.log(failed ? `\n${failed} of ${passed + failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);