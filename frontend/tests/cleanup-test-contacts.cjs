/**
 * Removes contact rows created by the verification suites, so running the
 * tests does not leave junk leads in the dev database.
 *
 *   node tests/cleanup-test-contacts.cjs
 *
 * Matches only rows this repo's tests create (recognisable sender names /
 * addresses). Anything a real person submitted is left alone.
 */
// The Express API, not the Next.js UI. Matches NEXT_PUBLIC_API_URL in
// .env.local (see backend/.env for the authoritative port).
const API = process.env.API_URL || 'http://127.0.0.1:3001';
// The admin panel authenticates with a USERNAME (POST /api/admin/login),
// not an email — see backend/routes/admin.js and the project conventions.
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'noviq2026';

// Sender identities used by tests/contact-proxy.test.cjs and the manual
// smoke probes run during the migration.
const TEST_EMAILS = new Set([
  'smoke@test.local',
  'cors@test.local',
  'hdr@test.local',
  'proxy@test.local',
  'proxy-verify@test.local',
]);

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  let token;
  try {
    const r = await api('/api/admin/login', { method: 'POST', body: { username: USERNAME, password: PASSWORD } });
    token = r.json && r.json.token;
  } catch (e) {
    console.log('SKIP  backend unreachable at ' + API + ' (' + e.message + ')');
    process.exit(0);
  }

  if (!token) {
    console.log('SKIP  could not authenticate as admin — set ADMIN_USERNAME / ADMIN_PASSWORD to clean up');
    process.exit(0);
  }

  const listed = await api('/api/contact?limit=200', { token });
  const rows = Array.isArray(listed.json) ? listed.json : [];
  if (rows.length === 0) {
    console.log('SKIP  no contacts readable (or table empty)');
    process.exit(0);
  }

  const targets = rows.filter((r) => TEST_EMAILS.has(String(r.email || '').toLowerCase()));
  if (targets.length === 0) {
    console.log(`OK    no test rows to remove (${rows.length} contact(s) inspected, all real)`);
    process.exit(0);
  }

  let removed = 0;
  for (const row of targets) {
    const d = await api('/api/contact/' + row.id, { method: 'DELETE', token });
    if (d.status === 200 || d.status === 204) {
      removed++;
      console.log(`  removed id=${row.id} email=${row.email}`);
    } else {
      console.log(`  FAILED id=${row.id} -> ${d.status}`);
    }
  }
  console.log(`\n${removed} test contact row(s) removed.`);
})();
