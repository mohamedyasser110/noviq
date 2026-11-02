const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const port = 3199;
const root = path.join(__dirname, '.tmp-pricing-test');
const frontend = path.join(root, 'frontend');
const password = 'test-pricing-2026';
let server;

function request(method, requestPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await request('GET', '/api/health');
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not start.');
}

(async () => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(frontend, { recursive: true });
  server = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(root, 'noviq.db'),
      FRONTEND_DIR: frontend,
      UPLOADS_DIR: path.join(frontend, 'images', 'uploads'),
      SERVE_FRONTEND: 'false',
      ADMIN_PASSWORD: password,
      JWT_SECRET: 'test-pricing-secret-with-sufficient-length',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let errors = '';
  server.stderr.on('data', chunk => { errors += chunk; });
  await waitForServer();

  const login = await request('POST', '/api/admin/login', { username: 'admin', password });
  assert.equal(login.status, 200, errors || login.raw);
  const token = login.json.token;

  /* ---- seed: plans sit in the $150-$250 band ---- */
  const pricing = await request('GET', '/api/admin/content/pricing', undefined, token);
  assert.equal(pricing.status, 200, pricing.raw);
  const prices = pricing.json.value.plans.map(p => p.price.en);
  assert.deepEqual(prices, ['$150', '$199', '$250'], `seed plans out of band: ${JSON.stringify(prices)}`);
  assert.equal(pricing.json.value.plans.find(p => p.id === 'professional').popular, true);

  /* ---- public surface serves the same ---- */
  const pub = await request('GET', '/api/content/pricing');
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.json.plans.map(p => p.price.en), ['$150', '$199', '$250']);

  /* ---- admin round-trip: edit a price, it persists and validates ---- */
  const edited = JSON.parse(JSON.stringify(pricing.json.value));
  edited.plans[0].price = { en: '$149', ar: '$149' };
  const save = await request('PUT', '/api/admin/content/pricing', { value: edited }, token);
  assert.equal(save.status, 200, save.raw);
  assert.equal(save.json.value.plans[0].price.en, '$149');
  const reread = await request('GET', '/api/admin/content/pricing', undefined, token);
  assert.equal(reread.json.value.plans[0].price.en, '$149');
  const bad = await request('PUT', '/api/admin/content/pricing', { value: { plans: 'nope' } }, token);
  assert.equal(bad.status, 400);

  /* ---- seed: solutions bill yearly ---- */
  const solutions = await request('GET', '/api/admin/content/solutions', undefined, token);
  assert.equal(solutions.status, 200, solutions.raw);
  assert.ok(Array.isArray(solutions.json.value) && solutions.json.value.length === 6, 'six solution cards');
  assert.ok(solutions.json.value.every(s => /\/year$/.test(s.price)), `not yearly: ${JSON.stringify(solutions.json.value.map(s => s.price))}`);
  const pubSol = await request('GET', '/api/content/solutions');
  assert.equal(pubSol.status, 200);
  assert.ok(pubSol.json.every(s => /\/year$/.test(s.price)));

  /* ---- solutions stay admin-editable (price is a plain string field) ---- */
  const solEdited = JSON.parse(JSON.stringify(solutions.json.value));
  solEdited[0].price = '$249/year';
  const solSave = await request('PUT', '/api/admin/content/solutions', { value: solEdited }, token);
  assert.equal(solSave.status, 200, solSave.raw);

  /* ---- pages placement: bar / more / hidden, all admin-driven ---- */
  const pages = await request('GET', '/api/admin/content/pages', undefined, token);
  assert.equal(pages.status, 200, pages.raw);
  assert.equal(pages.json.value.pricing.enabled, true);
  const moved = JSON.parse(JSON.stringify(pages.json.value));
  moved.pricing.placement = 'bar';
  moved.careers.placement = 'more';
  moved.toolkit.enabled = false;
  const pagesSave = await request('PUT', '/api/admin/content/pages', { value: moved }, token);
  assert.equal(pagesSave.status, 200, pagesSave.raw);
  assert.equal(pagesSave.json.value.pricing.placement, 'bar');
  const pubPages = await request('GET', '/api/content/pages');
  assert.equal(pubPages.status, 200);
  assert.equal(pubPages.json.pricing.placement, 'bar');
  assert.equal(pubPages.json.toolkit.enabled, false);
  const badPlacement = JSON.parse(JSON.stringify(moved));
  badPlacement.pricing.placement = 'sidebar';
  const badSave = await request('PUT', '/api/admin/content/pages', { value: badPlacement }, token);
  assert.equal(badSave.status, 400);

  console.log('\nall content-pricing checks passed');
  if (server) {
    await new Promise(resolve => {
      server.on('exit', resolve);
      server.kill();
      setTimeout(resolve, 500);
    });
  }
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {}
  process.exit(0);
})().catch(async (err) => {
  console.error('\nCONTENT-PRICING FAIL:', err.message);
  if (server) {
    await new Promise(resolve => {
      server.on('exit', resolve);
      server.kill();
      setTimeout(resolve, 500);
    });
  }
  try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  process.exit(1);
});
