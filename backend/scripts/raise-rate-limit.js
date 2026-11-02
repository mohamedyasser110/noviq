/* Raise the public API rate limit on a live deployment.

   WHY THIS IS NEEDED
   The default is 10 requests / 60s for the whole public /api/ surface.
   That is fine for a local single-user checkout and wrong in production:

     · one page render reads 4-6 content endpoints;
     · a revalidation burst (which is what an admin save triggers) re-renders
       many pages at once, so the calls arrive in a tight cluster;
     · the frontend DEGRADES SILENTLY on a failed read — lib/team-content.ts
       catches any error and falls back to the static seed list.

   So a 429 does not look like an error to the user. It looks like "my save
   did not take effect, let me press save again" — which is exactly the
   symptom that sent us looking here. The second attempt works because the
   window has rolled over by then.

   The admin/auth/imagegen limits stay tight: those guard real resources.
   Only the read-heavy public bucket is widened.

   Usage: node scripts/raise-rate-limit.js <api-origin> [max] */
const API = process.argv[2];
const MAX = parseInt(process.argv[3] || '600', 10);
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';

(async () => {
  const { token } = await (
    await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: PW }),
    })
  ).json();

  const before = await (
    await fetch(`${API}/api/admin/rate-limits`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  console.log('before:', JSON.stringify(before));

  const put = await fetch(`${API}/api/admin/rate-limits`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ api: { max: MAX, windowMs: 60_000 } }),
  });
  console.log(`PUT /api/admin/rate-limits -> ${put.status}`);

  const after = await (
    await fetch(`${API}/api/admin/rate-limits`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  console.log('after: ', JSON.stringify(after));
})();
