/**
 * Full-stack route verification.
 * Boots `next start` against the existing production build, waits for readiness,
 * probes every localized route + API + redirects, then shuts the server down.
 *
 * Usage:  node tests/verify-routes.cjs
 * Env:    PORT (default 4321 to avoid clashing with a dev server on 3000)
 */
const { spawn } = require('child_process');
const net = require('net');

const PORT = Number(process.env.PORT || 4321);
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const SERVER = process.platform === 'win32' ? 'node_modules\\.bin\\next.cmd' : 'node_modules/.bin/next';

const PAGES = [
  '', '/about', '/account', '/builder', '/careers', '/contact',
  '/faq', '/industries', '/login', '/portfolio', '/pricing', '/resource',
  '/resources', '/services', '/signup', '/solutions', '/team', '/toolkit',
  '/why', '/solutions',
  '/services/ai-solutions', '/services/custom-software', '/services/erp-systems',
  '/services/crm-platforms', '/services/saas-development',
  '/services/web-applications', '/services/api-development',
  '/services/automation', '/services/digital-transformation',
];

/* Pages the admin deliberately retired. They are switched off in the CMS
   (`pages.<slug>.enabled === false`), so 404 is the correct answer and
   expecting 200 would report a false failure on every run. */
const RETIRED = ['/ai-lab'];

const LOCALES = ['en', 'ar'];
const STATIC_ROUTES = [
  ['/api/health', 200],
  ['/robots.txt', 200],
  ['/sitemap.xml', 200],
  ['/en/this-route-does-not-exist', 404],
  ['/ar/this-route-does-not-exist', 404],
];
const REDIRECT_ROUTES = [
  ['/', '/en'],
  ['/services', '/en/services'],
  ['/about', '/en/about'],
  ['/contact', '/en/contact'],
  // /stack is a permanent 308 to /toolkit, which the next-intl middleware then
  // prefixes with the active locale — so the final landing page is /en/toolkit.
  ['/stack', '/en/toolkit'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const http = require('http');

/** Single request, no redirect following. Resolves once the body is drained. */
function requestOnce(path) {
  return new Promise((resolve) => {
    const req = http.request(
      BASE + path,
      { method: 'GET', headers: { 'user-agent': 'noviq-verify' } },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location || null }));
      }
    );
    req.on('error', (e) => resolve({ status: 'ERR', error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
    req.end();
  });
}

/** Follow up to `maxHops` redirects; report the final status + the chain. */
async function probe(path, { follow = true, maxHops = 5 } = {}) {
  let current = path;
  const chain = [];
  for (let i = 0; i <= maxHops; i++) {
    let res = await requestOnce(current);
    // One retry guards against a transient socket reset while `next dev`
    // recompiles a route on first hit.
    if (res.status === 'ERR') res = await requestOnce(current);
    chain.push(`${res.status}`);
    const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
    if (follow && isRedirect && res.location) {
      current = res.location;
      continue;
    }
    return { ...res, chain: chain.join(' -> '), finalPath: current };
  }
  return { status: 'TOO_MANY_HOPS', chain: chain.join(' -> '), finalPath: current };
}

function waitForPort(port, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.connect({ port, host: HOST }, () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('server never became ready'));
        else setTimeout(attempt, 500);
      });
      sock.setTimeout(2000, () => sock.destroy());
    };
    attempt();
  });
}

(async () => {
  // ATTACH=1 probes an already-running server instead of spawning one.
  // Needed on memory-constrained machines where a production build/start is
  const isPortInUse = await new Promise((resolve) => {
    const s = net.connect({ port: PORT, host: HOST }, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.setTimeout(1000, () => { s.destroy(); resolve(false); });
  });

  const attach = process.env.ATTACH === '1' || isPortInUse;
  let child = null;
  let log = '';

  if (!attach) {
    console.log(`Starting production server on ${BASE} ...`);
    child = spawn(SERVER, ['start', '-p', String(PORT)], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    child.stdout.on('data', (d) => { log += d.toString(); });
    child.stderr.on('data', (d) => { log += d.toString(); });
  } else {
    console.log(`Attaching to already-running server at ${BASE} ...`);
  }

  let failures = 0;
  const record = (ok, label, detail) => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  };

  try {
    await waitForPort(PORT);
    console.log('Server ready.\n');

    console.log('--- Localized pages (expect 200) ---');
    const seen = new Set();
    for (const locale of LOCALES) {
      for (const page of PAGES) {
        if (seen.has(page)) continue;
        seen.add(page);
        const path = `/${locale}${page}`;
        const { status } = await probe(path);
        record(status === 200, `/${locale}${page}`, `-> ${status}`);
      }
    }

    console.log('\n--- Retired pages (must 404 while closed in the CMS) ---');
    for (const locale of LOCALES) {
      for (const page of RETIRED) {
        const { status } = await probe(`/${locale}${page}`);
        record(status === 404, `/${locale}${page}`, `-> ${status} (expect 404)`);
      }
    }

    console.log('\n--- Static + API routes ---');
    for (const [path, expect] of STATIC_ROUTES) {
      const { status } = await probe(path);
      record(status === expect, path, `-> ${status} (expect ${expect})`);
    }

    console.log('\n--- Redirects (must land on the expected target) ---');
    for (const [from, to] of REDIRECT_ROUTES) {
      const res = await probe(from);
      const ok = res.finalPath === to && res.status === 200;
      record(ok, from, `-> ${res.chain}  landed on ${res.finalPath} (expect ${to} / 200)`);
    }
  } catch (err) {
    failures++;
    console.error('\nFATAL:', err.message);
  } finally {
    if (log.trim()) {
      console.log('\n--- server log tail ---');
      console.log(log.split('\n').slice(-15).join('\n'));
    }
    if (child) {
      /* On Windows we spawn next.cmd, so child.kill() only kills the batch
         wrapper and leaves the real `node next start` grandchild alive holding
         the port. taskkill /T takes down the whole tree. */
      try {
        if (process.platform === 'win32' && child.pid) {
          require('child_process').execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } else {
          child.kill();
        }
      } catch {}
    }
  }

  console.log(`\n${failures === 0 ? '*** ALL CHECKS PASSED ***' : `*** ${failures} CHECK(S) FAILED ***`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
