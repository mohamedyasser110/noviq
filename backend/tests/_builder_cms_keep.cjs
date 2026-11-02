/* The builder page is a CLIENT component, so its CMS-driven options only exist
   after hydration. A plain fetch() of the HTML cannot see them — this check runs
   a real browser to prove the admin values actually reach the rendered page. */
const { chromium } = require('playwright');
const API = 'http://127.0.0.1:4322';
const SITE = 'http://127.0.0.1:4321';

const MARK_SB = 'ZZMARKERSBZZ';
const MARK_SBOPT = 'ZZMARKERSBOPTZZ';
const MARK_CE = 'ZZMARKERCEZZ';

(async () => {
  const login = await (
    await fetch(API + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'noviq2026' }),
    })
  ).json();
  const H = { Authorization: 'Bearer ' + login.token, 'Content-Type': 'application/json' };
  const get = async (k) => (await (await fetch(API + '/api/admin/content/' + k, { headers: H })).json()).value;
  const put = (k, v) => fetch(API + '/api/admin/content/' + k, { method: 'PUT', headers: H, body: JSON.stringify({ value: v }) });

  const sbSnap = JSON.parse(JSON.stringify(await get('solutionBuilder')));
  const ceSnap = JSON.parse(JSON.stringify(await get('costEstimator')));
  console.log('solutionBuilder.steps[0] keys : ' + Object.keys(sbSnap.steps?.[0] || {}).join(', '));
  console.log('costEstimator.features[0] keys: ' + Object.keys(ceSnap.features?.[0] || {}).join(', '));

  /* Mark: a costEstimator feature label, a solutionBuilder STEP label (the
     group heading) and one of its OPTION labels (a scale choice). */
  const sb = JSON.parse(JSON.stringify(sbSnap));
  if (sb.steps && sb.steps[0]) {
    sb.steps[0].label = MARK_SB;
    if (sb.steps[0].options && sb.steps[0].options[0]) sb.steps[0].options[0].label = MARK_SBOPT;
  }
  console.log('PUT solutionBuilder -> ' + (await put('solutionBuilder', sb)).status);

  const ce = JSON.parse(JSON.stringify(ceSnap));
  if (ce.features && ce.features[0]) ce.features[0].label = MARK_CE;
  console.log('PUT costEstimator   -> ' + (await put('costEstimator', ce)).status);

  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(SITE + '/en/builder', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const body = await page.evaluate(() => document.body.innerText);
  await browser.close();

  const sawSB = body.includes(MARK_SB);
  const sawSBOpt = body.includes(MARK_SBOPT);
  const sawCE = body.includes(MARK_CE);
  console.log('\ncostEstimator feature label rendered   : ' + sawCE);
  console.log('solutionBuilder step label rendered    : ' + sawSB);
  console.log('solutionBuilder option label rendered  : ' + sawSBOpt);

  /* restore */
  await put('solutionBuilder', sbSnap);
  await put('costEstimator', ceSnap);
  await new Promise((r) => setTimeout(r, 2000));

  const b2 = await chromium.launch();
  const p2 = await b2.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.goto(SITE + '/en/builder', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  const after = await p2.evaluate(() => document.body.innerText);
  await b2.close();
  const clean = !after.includes(MARK_SB) && !after.includes(MARK_CE) && !after.includes(MARK_SBOPT);
  console.log('restored (markers gone)                : ' + clean);

  const ok = sawCE && sawSB && sawSBOpt && clean;
  console.log('\n' + (ok ? 4 : 0) + '/4 checks passed');
  process.exit(ok ? 0 : 1);
})();
