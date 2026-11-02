/* Precise import check for the last undecided files. Read-only. */
const fs = require('fs');
const path = require('path');
const FE = 'C:/Downloads/Noviq - final/frontend';
const files = [];
(function walk(d) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    if (/^(node_modules|\.next|\.next-v2|\.navtest-out|old-version|public|\.21st)$/.test(x.name)) continue;
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(x.name)) files.push(p);
  }
})(FE);

const CHECKS = [
  'app/i18n/routing', 'lib/i18n/routing', '@/app/i18n/config', 'app/i18n/config',
  'components/sections', 'sections/index', 'ui/index', 'components/ui',
  'logo-cloud-marquee-utils', 'flowing-logos', 'useContentOverrides',
  'shared/Loading', 'lib/navigation', 'content.ar', 'content-admin',
];
for (const c of CHECKS) {
  const re = new RegExp("from\\s+['\"][^'\"]*" + c.replace(/[/]/g, '\\/') + "['\"]|require\\(\\s*['\"][^'\"]*" + c.replace(/[/]/g, '\\/') + "['\"]");
  const hits = files.filter((f) => re.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(FE, f).replace(/\\/g, '/'));
  console.log(c.padEnd(30) + (hits.length ? 'imported by: ' + hits.join(', ') : 'NO IMPORTERS'));
}
console.log('\napp/i18n contents:');
try { for (const f of fs.readdirSync(path.join(FE, 'app/i18n'))) console.log('  ' + f); } catch (e) { console.log('  missing'); }
console.log('\ncomponents/ui/logo-cloud-marquee-utils contents:');
try { for (const f of fs.readdirSync(path.join(FE, 'components/ui/logo-cloud-marquee-utils'))) console.log('  ' + f); } catch (e) { console.log('  missing'); }
