/* ============================================================
   UNREFERENCED-FILE DETECTOR
   ------------------------------------------------------------
   Walks the frontend import graph from the real entry points and lists
   every source file that nothing can reach. Read-only.

   Entry points (anything the framework or a dev script can load):
     app/<route>/{page,layout,route,template,loading,error,
                  not-found,default,global-error}.tsx
     middleware.ts  next.config.mjs  tailwind.config.js  postcss.config.js
     tests/…        scripts/…       *.d.ts
   Resolution handles the "@/…" alias (tsconfig maps it to the project
   root), relative paths, the Next "app/…" form, and the .ts/.tsx/.js/
   .jsx/.mjs/.cjs + /index variants.

   A file is reported only when it is unreachable AND its basename is
   not mentioned anywhere in the tree — the second test catches files
   loaded by string path (readFileSync of a computed name), which a
   static import walk cannot see.

   Nothing is deleted here. This only produces the list.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const FE = 'C:/Downloads/Noviq - final/frontend';
const SRC_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIR = /(^|[\\/])(node_modules|\.next[\w.-]*|\.navtest-out|old-version|public|\.21st|\.git|test-results|playwright-report)([\\/]|$)/;
const APP_FILE = /^(page|layout|route|template|loading|error|not-found|default|global-error|providers)\.(tsx|ts|jsx|js)$/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (SKIP_DIR.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (SRC_EXT.includes(path.extname(e.name)) || e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

const all = walk(FE);
const rel = (p) => path.relative(FE, p).replace(/\\/g, '/');

/* ---- entry points ---- */
const entries = [];
for (const f of all) {
  const r = rel(f);
  if (r.startsWith('tests/') || r.startsWith('scripts/')) { entries.push(f); continue; }
  if (APP_FILE.test(path.basename(r))) { entries.push(f); continue; }
  /* Next discovers these by convention, never by import — the framework
     loads them directly, so an absent import proves nothing. */
  if (/^(sitemap|robots|manifest|opengraph-image|icon|apple-icon|not-found|global-error|symbol)\.(tsx|ts|jsx|js)$/.test(path.basename(r))) { entries.push(f); continue; }
  if (/^(middleware|next\.config|tailwind\.config|postcss\.config)\./.test(r)) { entries.push(f); continue; }
  if (r.endsWith('.d.ts')) { entries.push(f); continue; }
  if (!r.includes('/')) { entries.push(f); continue; }  /* root-level: i18n.ts, types.d.ts… */
  if (r === 'styles/globals.css') { entries.push(f); continue; }
}

/* ---- resolver ---- */
function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(FE, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = path.resolve(path.dirname(fromFile), spec);
  else if (spec.startsWith('app/') || spec.startsWith('components/') || spec.startsWith('lib/') ||
           spec.startsWith('data/') || spec.startsWith('styles/') || spec.startsWith('i18n/')) base = path.join(FE, spec);
  else return null;                                     /* bare package */
  const tries = [base, ...SRC_EXT.map((e) => base + e), ...SRC_EXT.map((e) => path.join(base, 'index' + e)),
                 base + '.css', base.replace(/\/$/, '') + '/index.tsx'];
  for (const t of tries) {
    try { const st = fs.statSync(t); if (st.isFile() && SRC_EXT.includes(path.extname(t))) return t; } catch {}
  }
  return null;
}

const IMPORT_RE = /(?:^|[\s;{(])(?:import|export)\s+(?:[\w*{}\n\r\t, $]+\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/* Windows paths are case-insensitive: components/ui/card.tsx and
   components/ui/Card.tsx are ONE file. The graph is therefore keyed on
   the lowercased path, and each key keeps the on-disk casing it was
   first seen with, so a live file can never be reported as a dead
   namesake. */
const key = (p) => path.resolve(p).toLowerCase();
const casing = new Map();
for (const f of [...all, ...entries]) if (!casing.has(key(f))) casing.set(key(f), f);
const reached = new Set();
const queue = [...entries];
const unresolved = new Map();
while (queue.length) {
  const file = queue.pop();
  const k = key(file);
  if (reached.has(k)) continue;
  reached.add(k);
  let src;
  try { src = fs.readFileSync(casing.get(k) || file, 'utf8'); } catch { continue; }
  /* strip block comments so commented-out imports don't count */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(code))) {
    const spec = m[1] || m[2] || m[3];
    if (!spec) continue;
    const hit = resolve(spec, casing.get(k) || file);
    if (hit) { const hk = key(hit); if (!reached.has(hk)) queue.push(hit); }
    else if (!spec.startsWith('.') && !spec.startsWith('@/')) {
      if (!unresolved.has(spec)) unresolved.set(spec, new Set());
      unresolved.get(spec).add(rel(casing.get(k) || file));
    }
  }
}

/* ---- second pass: string references anywhere in the tree ---- */
const corpusParts = [];
for (const f of all) { try { corpusParts.push(fs.readFileSync(f, 'utf8')); } catch {} }
for (const extra of ['package.json', 'tsconfig.json', 'next.config.mjs', 'STRUCTURE.md', 'middleware.ts']) {
  try { corpusParts.push(fs.readFileSync(path.join(FE, extra), 'utf8')); } catch {}
}
const corpus = corpusParts.join('\n');

const orphans = [];
for (const f of all) {
  if (reached.has(key(f))) continue;
  const r = rel(f);
  const base = path.basename(r);
  const stem = base.replace(/\.[^.]+$/, '');
  /* string-reference escape hatch: does anything name this file/module? */
  const mentioned = new RegExp('(^|[^\\w])' + stem.replace(/[$]/g, '\\$') + '([^.\\w]|$)').test(corpus);
  orphans.push({ file: r, mentioned, size: fs.statSync(f).size, lines: (() => { try { return fs.readFileSync(f, 'utf8').split('\n').length; } catch { return 0; } })() });
}

console.log('source files scanned : ' + all.length);
console.log('entry points         : ' + entries.length);
console.log('reachable            : ' + [...reached].length);
console.log('\nUNREACHABLE (' + orphans.length + ')');
console.log('"named" = the file/module name appears somewhere in the tree,');
console.log('so it may be loaded by a computed path — review those by hand.\n');
const named = orphans.filter((o) => o.mentioned);
const anon = orphans.filter((o) => !o.mentioned);
console.log('--- not referenced at all (' + anon.length + ')');
for (const o of anon.sort((a, b) => b.size - a.size)) console.log('  ' + o.size.toString().padStart(8) + 'B  ' + o.lines.toString().padStart(5) + 'L  ' + o.file);
console.log('\n--- named but not importable (' + named.length + ')');
for (const o of named.sort((a, b) => b.size - a.size)) console.log('  ' + o.size.toString().padStart(8) + 'B  ' + o.lines.toString().padStart(5) + 'L  ' + o.file);
console.log('\n--- unresolved bare specifiers (external packages only, first 20)');
console.log('  ' + [...unresolved.keys()].slice(0, 20).join(', '));
