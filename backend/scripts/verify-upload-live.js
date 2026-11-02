/* End-to-end check of the admin upload -> site display path, run against
   the LIVE Railway deployment. Not a unit test: it performs a real login,
   uploads a real PNG, then tries to fetch that image from the public web
   domain exactly the way a browser would.

   Usage: node scripts/verify-upload-live.js https://web-domain https://api-domain */
const API = process.argv[3] || 'https://api-production-adb9.up.railway.app';
const WEB = process.argv[2] || 'https://web-production-ba81f.up.railway.app';
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';

let n = 0;
const ok = (m) => { n++; console.log(`  ok ${n}  ${m}`); };
const bad = (m) => { console.log(`  FAIL ${m}`); process.exitCode = 1; };

/* A real 1x1 PNG, magic bytes and all. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

(async () => {
  console.log(`api ${API}\nweb ${WEB}\n`);

  const login = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  if (!login.ok) { bad(`login failed: ${login.status}`); return; }
  const { token } = await login.json();
  ok('admin login');

  const up = await fetch(`${API}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      filename: 'probe.png',
      data: `data:image/png;base64,${PNG.toString('base64')}`,
    }),
  });
  const body = await up.json();
  if (!up.ok) { bad(`upload failed: ${up.status} ${JSON.stringify(body)}`); return; }
  ok(`upload accepted -> ${body.path}`);

  const file = body.path.split('/').pop();
  const apiUrl = `${API}/images/uploads/${file}`;
  const webUrl = `${WEB}/images/uploads/${file}`;

  const a = await fetch(apiUrl);
  a.ok ? ok(`API serves it: ${apiUrl} (${a.status})`)
      : bad(`API 404: ${apiUrl} (${a.status})`);

  /* This is the one the visitor's browser hits. */
  const w = await fetch(webUrl);
  if (w.ok) {
    const buf = Buffer.from(await w.arrayBuffer());
    buf.equals(PNG)
      ? ok(`WEB serves identical bytes: ${webUrl} (${w.status}, ${buf.length} B)`)
      : bad(`WEB returned ${buf.length} B, expected ${PNG.length} B — corrupt`);
  } else {
    bad(`WEB 404/502: ${webUrl} (${w.status})`);
  }
})();
