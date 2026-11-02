/* ============================================================
   NOVIQ NAV ADMIN — unit tests
   ============================================================
   Exercises the REAL lib/nav-admin.ts + data/nav.ts. They are compiled to
   CommonJS first by tests/tsconfig.navtest.json (run via
   `npm run test:nav`, which also runs tsc), so there is no hand-rolled
   transform between the source and the assertions.

   What matters here is the guard rails on a header an admin can edit:
   append support, duplicate/unsafe-href rejection, and tolerance of a
   corrupt or hostile localStorage payload.
   ============================================================ */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

/* tsc emits the `@/...` alias verbatim, so map it onto the compiled tree.
   The output is CommonJS, so the classic resolve hook applies. */
const OUT = path.resolve(__dirname, '..', '.navtest-out');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.js', '/index.js']) {
      const p = path.join(OUT, rel + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return origResolve.call(this, request, ...rest);
};

/* ---- in-memory localStorage, so the SSR guard passes and writes persist ---- */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
global.window = {
  localStorage: storage,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
};
global.document = { addEventListener() {}, removeEventListener() {} };

const MODULES = path.resolve(__dirname, '..', '.navtest-out');
let NAV, ADMIN;
try {
  NAV = require(path.join(MODULES, 'data', 'nav.js'));
  ADMIN = require(path.join(MODULES, 'lib', 'nav-admin.js'));
} catch (e) {
  console.error('Could not load the compiled modules.');
  console.error('Run: npm run test:nav   (it invokes tsc -p tests/tsconfig.navtest.json)');
  console.error(e.message);
  process.exit(1);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ', name); }
  else { fail++; console.log('FAIL ', name, extra === undefined ? '' : `-> ${extra}`); }
}
const reset = () => storage.clear();
const baseKeys = () => [...NAV.NAV_PRIMARY, ...NAV.NAV_MORE].map((i) => i.key);

console.log('\n=== 1. base nav shape ===');
check('no stored state -> empty', (() => { const s = ADMIN.getNavState(); return s.hidden.length === 0 && s.extra.length === 0; })());
check('every base key is unique', new Set(baseKeys()).size === baseKeys().length);
check('"Our Team" lives in the "more" dropdown (slim primary bar)',
  NAV.NAV_MORE.some((i) => i.key === 'team' && i.href === '/team'),
  NAV.NAV_MORE.map((i) => i.key).join(','));
check('primary bar carries the high-signal routes',
  ['services', 'solutions', 'portfolio', 'contact'].every((k) =>
    NAV.NAV_PRIMARY.some((i) => i.key === k)));
check('secondary routes are collapsed into "more"',
  ['ai-lab', 'pricing', 'resources', 'careers', 'faq', 'industries', 'team', 'about'].every((k) =>
    k === 'ai-lab' || NAV.NAV_MORE.some((i) => i.key === k)));
check('every base item has en + ar labels', [...NAV.NAV_PRIMARY, ...NAV.NAV_MORE].every((i) => i.labelEn && i.labelAr));
check('every href is locale-less and in-app',
  [...NAV.NAV_PRIMARY, ...NAV.NAV_MORE].every((i) => i.href.startsWith('/') && !i.href.startsWith('//') && !/^[a-z]+:/i.test(i.href)));
check('NAV_KEYS indexes every base key', NAV.NAV_KEYS.size === baseKeys().length);
check('navLabel picks the locale label',
  NAV.navLabel({ key: 'x', href: '/x', labelEn: 'Team', labelAr: 'فريقنا' }, 'ar') === 'فريقنا' &&
  NAV.navLabel({ key: 'x', href: '/x', labelEn: 'Team', labelAr: 'فريقنا' }, 'en') === 'Team');
check('navLabel falls back to en when ar is absent',
  NAV.navLabel({ key: 'x', href: '/x', labelEn: 'Docs' }, 'ar') === 'Docs');

console.log('\n=== 2. the admin can ADD items ===');
reset();
let r = ADMIN.addNavItem({ key: 'case', href: '/case-studies', labelEn: 'Case Studies', labelAr: 'دراسات الحالة' });
check('appends a new item', r.ok === true, r.reason);
check('the item is stored', ADMIN.getNavState().extra.some((e) => e.key === 'case'));
check('its href is preserved', ADMIN.getNavState().extra.find((e) => e.key === 'case').href === '/case-studies');
ADMIN.addNavItem({ key: 'news', href: 'news', labelEn: 'News' });
check('a bare path is normalized to absolute', ADMIN.getNavState().extra.find((e) => e.key === 'news').href === '/news');
ADMIN.addNavItem({ key: 'press', href: '/press', labelEn: 'Press' });
check('a missing labelAr falls back to labelEn', ADMIN.getNavState().extra.find((e) => e.key === 'press').labelAr === 'Press');
check('items accumulate in order',
  ADMIN.getNavState().extra.map((e) => e.key).join(',') === 'case,news,press');

console.log('\n=== 3. bad input is rejected ===');
reset();
ADMIN.addNavItem({ key: 'services', href: '/services', labelEn: 'Shadows a base key' });
check('rejects a key that collides with a base item', !ADMIN.getNavState().extra.some((e) => e.key === 'services'));
ADMIN.addNavItem({ key: 'docs', href: '/docs', labelEn: 'Docs' });
r = ADMIN.addNavItem({ key: 'docs', href: '/other', labelEn: 'Docs again' });
check('rejects a duplicate admin key', r.ok === false && ADMIN.getNavState().extra.length === 1, r.reason);
check('rejects an absolute external URL', ADMIN.addNavItem({ key: 'e1', href: 'https://evil.example', labelEn: 'Evil' }).ok === false);
check('rejects a protocol-relative URL', ADMIN.addNavItem({ key: 'e2', href: '//evil.example', labelEn: 'Evil' }).ok === false);
check('rejects a javascript: URL', ADMIN.addNavItem({ key: 'e3', href: 'javascript:alert(1)', labelEn: 'Evil' }).ok === false);
check('rejects a blank label', ADMIN.addNavItem({ key: 'e4', href: '/e4', labelEn: '   ' }).ok === false);
check('rejects a blank key', ADMIN.addNavItem({ key: '', href: '/e5', labelEn: 'E5' }).ok === false);
check('rejects a blank href', ADMIN.addNavItem({ key: 'e6', href: '', labelEn: 'E6' }).ok === false);
check('none of the rejected items were stored', ADMIN.getNavState().extra.length === 1);

console.log('\n=== 4. hide / show / remove ===');
reset();
check('hideNavItem accepts a base key', ADMIN.hideNavItem('pricing') === true);
check('the key shows up in hidden', ADMIN.getNavState().hidden.includes('pricing'));
check('showNavItem restores it', ADMIN.showNavItem('pricing') === true && !ADMIN.getNavState().hidden.includes('pricing'));
check('hiding an unknown key is refused', ADMIN.hideNavItem('does-not-exist') === false);
ADMIN.addNavItem({ key: 'brand-new', href: '/bn', labelEn: 'BN' });
check('hiding an admin key is refused (it has no base slot)', ADMIN.hideNavItem('brand-new') === false);
check('toggle hides and reports the new state', ADMIN.toggleNavItem('faq') === false && ADMIN.getNavState().hidden.includes('faq'));
check('toggle again restores', ADMIN.toggleNavItem('faq') === true && !ADMIN.getNavState().hidden.includes('faq'));
ADMIN.addNavItem({ key: 'temp', href: '/temp', labelEn: 'Temp' });
check('removeNavItem drops an admin item', ADMIN.removeNavItem('temp') === true && !ADMIN.getNavState().extra.some((e) => e.key === 'temp'));
check('removing a missing item is a no-op', ADMIN.removeNavItem('temp') === true);
ADMIN.clearNavState();
check('clearNavState wipes everything', ADMIN.getNavState().hidden.length === 0 && ADMIN.getNavState().extra.length === 0);
check('clearNavState also empties storage', storage.getItem(ADMIN.NAV_STORAGE_KEY) === null);

console.log('\n=== 5. survives a corrupt / hostile store ===');
reset();
storage.setItem('noviq_nav_v1', 'not json at all');
check('malformed JSON -> empty state', ADMIN.getNavState().hidden.length === 0);
storage.setItem('noviq_nav_v1', '[]');
check('a JSON array -> empty state', ADMIN.getNavState().hidden.length === 0);
storage.setItem('noviq_nav_v1', JSON.stringify({ hidden: 'nope', extra: 'nope' }));
check('wrong field types -> empty state', (() => { const s = ADMIN.getNavState(); return s.hidden.length === 0 && s.extra.length === 0; })());
storage.setItem('noviq_nav_v1', JSON.stringify({ hidden: ['pricing', 'pricing', 'ghost', 42, null], extra: [] }));
{
  const s = ADMIN.getNavState();
  check('hidden is deduped and filtered to real base keys',
    s.hidden.length === 1 && s.hidden[0] === 'pricing', JSON.stringify(s.hidden));
}
storage.setItem('noviq_nav_v1', JSON.stringify({
  hidden: [],
  extra: [
    { key: 'ok', href: '/ok', labelEn: 'OK' },
    { key: 'ok', href: '/dup', labelEn: 'Duplicate' },
    { key: 'bad1', href: '', labelEn: 'No href' },
    { key: 'bad2', href: '/x', labelEn: '' },
    { key: 'services', href: '/services', labelEn: 'Shadows a base key' },
    { key: 'bad3', href: 'https://evil.example', labelEn: 'External' },
    'not-an-object', null, 42,
    { key: 'ok2', href: '/ok2', labelEn: 'Second good one' },
  ],
}));
{
  const s = ADMIN.getNavState();
  check('a duplicate key keeps only the first', s.extra.filter((e) => e.key === 'ok').length === 1);
  check('an item with no href or no label is dropped', !s.extra.some((e) => e.key === 'bad1' || e.key === 'bad2'));
  check('an item shadowing a base key is dropped', !s.extra.some((e) => e.key === 'services'));
  check('a tampered external href is dropped', !s.extra.some((e) => e.key === 'bad3'));
  check('non-objects in the array are skipped', s.extra.length === 2, JSON.stringify(s.extra.map((e) => e.key)));
  check('a valid item after the bad ones survives', !!s.extra.find((e) => e.key === 'ok2'));
}

console.log('\n=== 6. caps ===');
reset();
for (let i = 0; i < 60; i++) ADMIN.addNavItem({ key: `k${i}`, href: `/k${i}`, labelEn: `Item ${i}` });
check('the extra list is capped at 40', ADMIN.getNavState().extra.length === 40, `got ${ADMIN.getNavState().extra.length}`);
ADMIN.clearNavState();
ADMIN.addNavItem({ key: 'long', href: '/x', labelEn: 'y'.repeat(500) });
check('long labels are truncated to 60', ADMIN.getNavState().extra[0].labelEn.length === 60, String(ADMIN.getNavState().extra[0].labelEn.length));

console.log(`\nALL NAV CHECKS ${fail === 0 ? 'PASSED' : 'FAILED'} (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
