/* Discriminator for the stale-CMS problem.

   We know three things already:
     · the route is re-rendered on every request (x-nextjs-cache: MISS),
       so the page itself is not the stale layer;
     · the /api/revalidate purge logs as executed;
     · yet the page still shows old content.

   That leaves the fetch DATA cache as the only suspect. This measures the
   two candidate mechanisms against each other:

     t+0s    save + explicit tag purge   -> is it fresh?
     t+70s   no purge, just the 60s ISR  -> is it fresh now?

   If the second is fresh and the first was not, the tag purge is the thing
   that is broken and the ISR window is the thing that works.

   Usage: node scripts/diagnose-stale-cms.js <web-origin> <api-origin> */
const WEB = process.argv[2];
const API = process.argv[3];
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
const MARK = 'ZZMARKZZ';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { token } = await (
    await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: PW }),
    })
  ).json();

  const original = await (await fetch(`${API}/api/content/team`)).json();
  const members = original.members.map((m, i) =>
    i === 0 ? { ...m, bio: { ...(m.bio || {}), en: `${MARK} ${m.bio?.en || 'x'}` } } : m
  );

  try {
    const put = await fetch(`${API}/api/admin/content/team`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: { ...original, members } }),
    });
    console.log(`saved: PUT -> ${put.status}\n`);

    for (const [label, waitMs] of [['t+3s  (after purge)', 3000], ['t+30s', 27000], ['t+70s  (past ISR 60s)', 40000], ['t+100s', 30000]]) {
      await sleep(waitMs);
      const page = await (await fetch(`${WEB}/en/team`)).text();
      const cache = (await fetch(`${WEB}/en/team`, { method: 'HEAD' })).headers.get('x-nextjs-cache');
      console.log(`${label.padEnd(22)} page=${page.includes(MARK) ? 'FRESH' : 'stale'}  x-nextjs-cache=${cache}`);
    }
  } finally {
    await fetch(`${API}/api/admin/content/team`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: original }),
    });
    console.log('\nrestored original');
  }
})();
