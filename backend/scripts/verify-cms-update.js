/* End-to-end test of the "admin save -> live site" path, run against the
   live deployment. Reproduces the report that profile/projects edits need
   more than one attempt before they show up.

   Steps: snapshot `team` -> change one bio -> let the backend's own
   revalidate ping fire -> fetch the page and check whether the new text is
   there on the FIRST request -> restore the original.

   Usage: node scripts/verify-cms-update.js <web-origin> <api-origin> */
const WEB = process.argv[2];
const API = process.argv[3];
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
const SECRET = process.env.REVALIDATE_SECRET || '64aca333dd1744ccd169c22a00a2b795aed0a433c6766ab5';
const MARK = 'ZZTESTZZ';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let token, original;
  try {
    const login = await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: PW }),
    });
    ({ token } = await login.json());

    const cur = await (await fetch(`${API}/api/content/team`)).json();
    original = cur;
    const first = (cur.members || [])[0];
    if (!first) throw new Error('no team members to test with');
    console.log(`editing member: ${first.name?.en}\n`);

    /* 1. Is the revalidate endpoint even reachable + authorised? */
    const ping = await fetch(`${WEB}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': SECRET },
      body: JSON.stringify({ reason: 'verify-cms-update' }),
    });
    const pingBody = await ping.text();
    console.log(`POST ${WEB}/api/revalidate -> ${ping.status} ${pingBody.slice(0, 90)}`);

    /* 2. A bad secret must be refused (fail closed). */
    const bad = await fetch(`${WEB}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': 'wrong' },
      body: '{}',
    });
    console.log(`POST with wrong secret      -> ${bad.status} (must be 401)\n`);

    /* 3. Write the change through the admin API (this is what the
          dashboard does, and it triggers the backend's revalidate ping). */
    const members = original.members.map((m, i) =>
      i === 0 ? { ...m, bio: { ...(m.bio || {}), en: `${MARK} ${m.bio?.en || 'bio'}` } } : m
    );
    const put = await fetch(`${API}/api/admin/content/team`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: { ...original, members } }),
    });
    console.log(`PUT /api/admin/content/team -> ${put.status}`);

    /* 4. First request after the save. This is the number that matters:
          if the mark is already here, one save was enough. */
    await sleep(1500);
    const page = await (await fetch(`${WEB}/en/team`)).text();
    const firstHit = page.includes(MARK);
    console.log(`\nFIRST request after save    -> ${firstHit ? 'UPDATED' : 'STALE  <-- needs a 2nd attempt'}`);

    /* 5. What does the data layer say, independent of the page cache? */
    const apiNow = await (await fetch(`${API}/api/content/team`)).json();
    const apiHit = JSON.stringify(apiNow).includes(MARK);
    console.log(`API content/team            -> ${apiHit ? 'UPDATED' : 'STALE'}`);

    if (!firstHit) {
      const second = await (await fetch(`${WEB}/en/team`)).text();
      console.log(`SECOND request              -> ${second.includes(MARK) ? 'UPDATED' : 'STALE'}`);
      const third = await (await fetch(`${WEB}/en/team`)).text();
      console.log(`THIRD request               -> ${third.includes(MARK) ? 'UPDATED' : 'STALE'}`);
    }
  } finally {
    /* Always put the original content back. */
    if (token && original) {
      const back = await fetch(`${API}/api/admin/content/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: original }),
      });
      console.log(`\nrestored original team content -> ${back.status}`);
    }
  }
})();
