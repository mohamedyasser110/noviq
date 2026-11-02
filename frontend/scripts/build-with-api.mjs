/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Build the frontend with the backend API running, so the /team page
   resolves CMS content at build time. Retries the flaky build.
   Run: node scripts/build-with-api.mjs                                                */
import { spawn, execSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRONTEND = PORTABLE_FRONTEND;
const BACKEND = PORTABLE_BACKEND;

console.log('→ starting backend API on :4322 ...');
const server = spawn(process.execPath, ['-e', `
  process.chdir('${BACKEND.replace(/\\/g, '/')}');
  require('${BACKEND.replace(/\\/g, '/')}/app').listen(4322, '127.0.0.1', () => console.log('API_UP'));
`], { cwd: BACKEND, stdio: ['ignore', 'pipe', 'pipe'] });

let up = false;
server.stdout.on('data', (d) => { if (String(d).includes('API_UP')) up = true; });
server.stderr.on('data', (d) => process.stderr.write(`[api] ${d}`));

for (let i = 0; i < 30 && !up; i++) await sleep(500);
console.log(up ? '→ API up' : '→ API did NOT start');

if (up) {
  try {
    const r = await fetch('http://127.0.0.1:4322/api/content/team');
    const j = await r.json();
    console.log(`→ /api/content/team members=${j?.members?.length}`);
  } catch (e) { console.log('→ team fetch failed:', e.message); }
}

let ok = false;
for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
  console.log(`→ next build (attempt ${attempt}) ...`);
  try {
    execSync('npx next build', { cwd: FRONTEND, stdio: 'inherit', timeout: 1_200_000 });
    ok = true;
  } catch (e) {
    console.log(`   attempt ${attempt} failed — machine write flake, retrying`);
  }
}

console.log(ok ? '→ BUILD OK' : '→ BUILD FAILED');
try { server.kill('SIGKILL'); } catch {}
process.exit(ok ? 0 : 1);
