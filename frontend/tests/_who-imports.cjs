/* Who imports what from components/ui, and the rest of the suspects.
   Read-only. */
const fs = require('fs');
const path = require('path');
const FE = 'C:/Downloads/Noviq - final/frontend';
const DIRS = ['app', 'components', 'lib', 'data', 'styles', 'tests', 'scripts'];
const files = [];
(function walk(d) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(x.name)) files.push(p);
  }
})(FE);
const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const rel = (f) => path.relative(FE, f).replace(/\\/g, '/');

console.log('=== every import that targets components/ui');
for (const [f, s] of src) {
  const re = /from\s+['"]([^'"]*components\/ui[^'"]*)['"]/g;
  let m;
  while ((m = re.exec(s))) console.log('  ' + rel(f).padEnd(52) + ' -> ' + m[1]);
}

const NAMES = ['badge', 'button', 'card', 'demo', 'input', 'label', 'textarea', 'logo-cloud-marquee', 'Lookout', 'index'];
console.log('\n=== bare-name mentions of the ui kit (any file, any form)');
for (const n of NAMES) {
  const re = new RegExp("[/'\"]" + n + "['\"]|/" + n + "|\\b" + n + "\\b");
  const hit = [...src.entries()].filter(([f, s]) => {
    if (rel(f) === 'components/ui/' + n + '.tsx') return false;  /* not itself */
    return re.test(s);
  }).map(([f]) => rel(f));
  console.log('  ' + n.padEnd(22) + (hit.length ? hit.join(', ') : 'NOT MENTIONED ANYWHERE'));
}

const SUSPECTS = [
  'components/shared/useContentOverrides.ts', 'components/shared/ContentOverrideBridge.tsx',
  'components/shared/Loading.tsx', 'components/sections/index.tsx', 'lib/navigation.ts',
  'app/i18n/routing.ts', 'lib/i18n/routing.ts', 'app/globals.css', 'styles/globals.css',
  'data/content.ar.js', 'components/ui/demo.tsx', 'middleware.ts', 'i18n.ts', 'lib/i18n.ts',
];
console.log('\n=== suspects: mentioned by name anywhere?');
for (const s of SUSPECTS) {
  const abs = path.join(FE, s);
  if (!fs.existsSync(abs)) { console.log('  ' + s.padEnd(46) + ' (does not exist)'); continue; }
  const stem = path.basename(s).replace(/\.[^.]+$/, '');
  const hit = [...src.entries()].filter(([f, t]) => {
    if (path.resolve(f) === path.resolve(abs)) return false;
    return new RegExp('[/"\']' + stem + '["\']|/' + stem + '\\b').test(t);
  }).map(([f]) => rel(f));
  console.log('  ' + s.padEnd(46) + (hit.length ? hit.join(', ') : 'NOT MENTIONED'));
}

console.log('\n=== small file contents');
for (const s of ['components/ui/demo.tsx', 'app/globals.css', 'lib/i18n/routing.ts']) {
  const abs = path.join(FE, s);
  if (!fs.existsSync(abs)) { console.log('  ' + s + ': missing'); continue; }
  console.log('  --- ' + s);
  console.log(fs.readFileSync(abs, 'utf8').split('\n').slice(0, 12).map((l) => '      ' + l).join('\n'));
}
