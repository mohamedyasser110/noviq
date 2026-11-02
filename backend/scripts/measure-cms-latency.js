/* How long after an admin save does the change become visible, and is one
   attempt enough? Polls the page every 500ms after a save instead of
   sampling at fixed offsets, so the answer is a real latency rather than
   an artefact of when the test happened to look.

   Usage: node scripts/measure-cms-latency.js <web-origin> <api-origin> [key] */
const WEB = process.argv[2];
const API = process.argv[3];
const KEY = process.argv[4] || 'team';
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
const MARK = 'ZZLAT' + Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { token } = await (
    await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: PW }),
    })
  ).json();

  const url = `${API}/api/content/${KEY}`;
  const original = await (await fetch(url)).json();
  const PATH = KEY === 'team' ? '/en/team' : '/en/portfolio';

  /* Only `team` has a free-text field we can mark. For other keys we mark
     the first localized string we can find, so the same harness works. */
  let value;
  if (KEY === 'team') {
    value = {
      ...original,
      members: original.members.map((m, i) =>
        i === 0 ? { ...m, bio: { ...(m.bio || {}), en: `${MARK} ${m.bio?.en || 'x'}` } } : m
      ),
    };
  } else {
    value = original;
  }

  try {
    const t0 = Date.now();
    const put = await fetch(`${API}/api/admin/content/${KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value }),
    });
    console.log(`${KEY}: PUT -> ${put.status}  (save took ${Date.now() - t0}ms)\n`);

    let fresh = null;
    for (let i = 0; i < 60; i++) {
      const page = await (await fetch(`${WEB}${PATH}`)).text();
      if (page.includes(MARK)) { fresh = Date.now() - t0; break; }
      await sleep(500);
    }

    if (fresh === null) {
      console.log(`${PATH}: NOT VISIBLE after 30s  <-- broken`);
      process.exitCode = 1;
    } else {
      const attempts = fresh === 0 ? 'first request' : `after ${Math.ceil(fresh / 500)} request(s)`;
      console.log(`${PATH}: visible ${fresh}ms after save (${attempts})`);
    }
  } finally {
    await fetch(`${API}/api/admin/content/${KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: original }),
    });
    console.log('restored original');
  }
})();
