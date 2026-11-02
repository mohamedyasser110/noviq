/* End-to-end check of a production build: boots `next start` against the
   configured distDir, waits for it to answer, requests a spread of localized
   routes, then shuts it down.

   Usage (from frontend/):
     set NEXT_DIST_DIR=.next-run && node scripts/verify-prod-build.mjs
*/
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.VERIFY_PORT || 3013);
const distDir = process.env.NEXT_DIST_DIR || '.next';
const cwd = process.cwd();
const distPath = path.join(cwd, distDir);

if (!existsSync(path.join(distPath, 'BUILD_ID'))) {
  console.error(`FAIL  no BUILD_ID in "${distDir}" — build first.`);
  process.exit(1);
}
const buildId = readFileSync(path.join(distPath, 'BUILD_ID'), 'utf8').trim();
console.log(`Using distDir "${distDir}" (BUILD_ID ${buildId})`);

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)],
  { cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] }
);
let serverLog = '';
child.stdout.on('data', (d) => (serverLog += d));
child.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForReady(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(`http://127.0.0.1:${PORT}/en`, { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return false;
}

const ROUTES = [
  '/en', '/ar', '/en/services', '/ar/services/ai-solutions',
  '/en/pricing', '/en/contact', '/en/about', '/robots.txt', '/sitemap.xml',
];

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { console.log(`PASS  ${name}`); pass++; }
  else { console.error(`FAIL  ${name}${extra ? ' -> ' + extra : ''}`); fail++; }
};

try {
  const ready = await waitForReady();
  check('next start became ready', ready, serverLog.slice(-400));
  if (!ready) throw new Error('server never became ready');

  for (const route of ROUTES) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${route}`, { signal: ctl.signal });
      const body = await r.text();
      check(`GET ${route} -> 200`, r.status === 200, `got ${r.status}`);
      if (route === '/ar') {
        const dir = body.match(/<html[^>]*\bdir="([^"]+)"/);
        const lang = body.match(/<html[^>]*\blang="([^"]+)"/);
        check('  /ar is RTL', dir?.[1] === 'rtl', `dir=${dir?.[1]}`);
        check('  /ar lang=ar', lang?.[1] === 'ar', `lang=${lang?.[1]}`);
        check('  /ar contains Arabic script', /[\u0600-\u06FF]/.test(body));
      }
      if (route === '/en') {
        const dir = body.match(/<html[^>]*\bdir="([^"]+)"/);
        check('  /en is LTR', dir?.[1] === 'ltr', `dir=${dir?.[1]}`);
      }
    } catch (e) {
      check(`GET ${route}`, false, e.message);
    } finally {
      clearTimeout(t);
    }
  }
} catch (e) {
  console.error('FATAL', e.message);
  fail++;
} finally {
  child.kill('SIGTERM');
  await sleep(1500);
  if (child.exitCode === null) child.kill('SIGKILL');
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);
