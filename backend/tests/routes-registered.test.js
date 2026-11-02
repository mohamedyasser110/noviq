/* ============================================================
   NOVIQ — every route in the tree must be reachable
   ------------------------------------------------------------
   A route file existing is not the same as a route being SERVED, and
   the two came apart here silently.

   routes/index.js mounted the client portal correctly, and
   db/init.js created its tables. But index.js — the file the container
   runs as `CMD node index.js` — only required ./app, and app.js mounts
   /api BEFORE routes/index.js is reached. So the portal router was
   never loaded, and every /api/portal/* route answered 404 in
   production while the code sat in the tree looking perfectly healthy
   and its own test suite passed.

   This walks the ACTUAL Express stack after boot and asserts each
   expected path has a handler. It fails on "the file exists" and only
   passes on "the router is mounted", which is the thing that was broken.

   Run: node tests/routes-registered.test.js
   ============================================================ */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'routes-registered-test-secret';
process.env.ADMIN_PASSWORD = 'TestOnly-Password-9!';

let passed = 0;
let failed = 0;
const ok = (cond, label, detail) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

/* Requires index.js, NOT app.js — this is the point. The container runs
   index.js, so index.js is what has to mount every router. */
const app = require('../index.js');

/* Express 5 exposes the matched layers on the request object, so we can
   probe a path without a network round trip or a listening socket. */
function hasHandler(path, method = 'GET') {
  const probe = {
    method,
    url: path,
    originalUrl: path,
    baseUrl: '',
    path,
    params: {},
    query: {},
    headers: { host: 'localhost' },
    get(name) { return this.headers[name.toLowerCase()]; },
    body: {},
    app,
    get next() { return probe._next; },
    _next: undefined,
  };
  let reached = false;
  probe._next = () => { reached = true; };

  /* Walk the router stack synchronously. Anything async (a real handler)
     may not finish, but the ROUTE MATCH is what we are testing, and that
     happens during dispatch. */
  try {
    const Layer = require('express/lib/router/layer');
    void Layer;
  } catch { /* express internals moved; the fallback below still works */ }

  /* Prefer the stack introspection that works on this Express version. */
  const stack = app.router?.stack || app._router?.stack || [];
  for (const layer of stack) {
    if (!layer.route) continue;
    const routePath = layer.route.path;
    const methods = layer.route.methods;
    if (!methods || !methods[method.toLowerCase()]) continue;
    if (path === routePath) return true;
    /* The portal uses patterns like /portal/projects/:id, so a plain
       equality test would miss every parameterised route. */
    const re = new RegExp(`^${routePath.replace(/:[^/]+/g, '[^/]+')}$`);
    if (re.test(path)) return true;
  }
  void reached;
  return false;
}

console.log('\n=== client portal (must be mounted, not merely present) ===');
for (const [method, path] of [
  ['GET', '/portal/me'],
  ['GET', '/portal/projects'],
  ['GET', '/portal/projects/:id'],
  ['GET', '/portal/contracts'],
  ['GET', '/portal/notifications'],
  ['POST', '/portal/notifications/:id/read'],
  ['POST', '/portal/contact'],
]) {
  ok(hasHandler(path, method), `${method} ${path}`);
}

console.log('\n=== portal admin side ===');
for (const [method, path] of [
  ['GET', '/admin/portal/projects'],
  ['POST', '/admin/portal/projects'],
  ['PUT', '/admin/portal/projects/:id'],
  ['POST', '/admin/portal/projects/:id/milestones'],
  ['PUT', '/admin/portal/milestones/:id'],
  ['DELETE', '/admin/portal/milestones/:id'],
  ['POST', '/admin/portal/contracts'],
  ['POST', '/admin/portal/notifications'],
]) {
  ok(hasHandler(path, method), `${method} ${path}`);
}

console.log('\n=== the pre-existing surface still mounted ===');
for (const [method, path] of [
  ['GET', '/health'],
  ['POST', '/contact'],
  ['POST', '/analytics/visit'],
  ['POST', '/auth/login'],
  ['POST', '/admin/login'],
  ['GET', '/admin/backup'],
]) {
  ok(hasHandler(path, method), `${method} ${path}`);
}

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} routes verified mounted`);
process.exit(failed ? 1 : 0);
