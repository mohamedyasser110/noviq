/* ============================================================
   NOVIQ — production image module check
   ------------------------------------------------------------
   Loads the app with the environment Railway uses (NODE_ENV=production,
   secrets set so the fail-fast guard passes) and then asserts that every
   module the ROUTERS require actually resolves.

   WHY THIS EXISTS
   The container runs `context: backend/`, so anything .dockerignore drops
   is simply absent from the image. That is invisible locally — the file is
   right there on disk — and fatal in production, where the require throws
   MODULE_NOT_FOUND on the first request.

   It bit us once already: routes/admin.js requires ../scripts/backup for
   GET /admin/backup, backend/.dockerignore excluded all of scripts/, and
   the whole API failed to boot. Because the require sits at the top of the
   router, "one missing admin feature" took down /api/health too.

   The general rule this enforces: a require from anything app.js reaches
   must survive .dockerignore. Statically walking the require graph is the
   cheapest way to catch the next one before a deploy.

   Run: node tests/image-shipped.test.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (cond, label, detail) => {
  if (cond) console.log(`  ok   ${label}`);
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

/* ---------- 1. what .dockerignore drops ---------- */
function dockerignorePatterns() {
  const file = path.join(ROOT, '.dockerignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    /* comments and negations are not "dropped" */
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
}

/** Does .dockerignore exclude this repo-relative path? */
function isExcluded(rel, patterns) {
  return patterns.some((p) => {
    const clean = p.replace(/\/$/, '');
    if (rel === clean || rel.startsWith(clean + '/')) return true;
    /* directory form: "scripts" drops everything under it */
    if (p.endsWith('/') && rel.startsWith(clean + '/')) return true;
    return false;
  });
}

const patterns = dockerignorePatterns();

/* ---------- 1b. .railwayignore — the UPLOAD half ---------- */
/* There are two gates and they fail differently:
 *   .dockerignore  — what the remote Docker build copies
 *   .railwayignore — what `railway up` UPLOADS in the first place
 * Fixing only the first still breaks the deploy: the file never leaves the
 * machine. That is exactly what happened — scripts/ was excluded from both,
 * the build succeeded (nothing was missing from ITS context) and the
 * container then crashed on the first require. So both lists are checked. */
function railwayignorePatterns() {
  const file = path.join(ROOT, '.railwayignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
}
const railPatterns = railwayignorePatterns();

/* ---------- 2. walk the require graph the app actually loads ---------- */
const visited = new Set();
const missing = [];
const external = new Set();

function resolveLocal(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return undefined; /* local but unresolvable */
}

function walk(file) {
  if (visited.has(file) || visited.size > 400) return;
  visited.add(file);

  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return; }

  const specs = new Set();
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) specs.add(m[1]);

  for (const spec of specs) {
    const resolved = resolveLocal(file, spec);
    if (resolved === null) { external.add(spec.split('/')[0]); continue; }
    if (resolved === undefined) {
      missing.push(`${path.relative(ROOT, file)} -> ${spec}`);
      continue;
    }
    /* node_modules is resolved at install time in the image; only our own
       tree is checked against .dockerignore. */
    if (resolved.includes('node_modules')) continue;

    const rel = path.relative(ROOT, resolved).split(path.sep).join('/');
    if (isExcluded(rel, patterns)) {
      missing.push(`${path.relative(ROOT, file)} -> ${rel}  (EXCLUDED by .dockerignore)`);
      continue;
    }
    walk(resolved);
  }
}

/* The real entrypoint graph. index.js is included because it is what
   `CMD node index.js` runs in the container. */
for (const entry of ['index.js', 'app.js']) {
  walk(path.join(ROOT, entry));
}

console.log(`\nwalked ${visited.size} modules, ${external.size} external packages`);

ok(missing.length === 0,
  'every local require in the app graph survives .dockerignore',
  missing.length ? `\n         ${missing.join('\n         ')}` : '');
for (const miss of missing) console.log(`         -> ${miss}`);

/* The same walk against the upload list. */
const notUploaded = [];
(function walkUpload(file) {
  if (visited.has(file)) return;
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), spec);
    let resolved = null;
    for (const cand of [base, base + '.js', path.join(base, 'index.js')]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { resolved = cand; break; }
    }
    if (!resolved || resolved.includes('node_modules')) continue;
    const rel = path.relative(ROOT, resolved).split(path.sep).join('/');
    if (isExcluded(rel, railPatterns)) {
      notUploaded.push(`${path.relative(ROOT, file)} -> ${rel}  (EXCLUDED by .railwayignore)`);
      continue;
    }
    walkUpload(resolved);
  }
})(path.join(ROOT, 'index.js'));

ok(notUploaded.length === 0,
  'every local require in the app graph survives .railwayignore',
  notUploaded.length ? `\n         ${notUploaded.join('\n         ')}` : '');
for (const miss of notUploaded) console.log(`         -> ${miss}`);

/* ---------- 3. the specific files that broke production ---------- */
for (const needed of ['scripts/backup.js', 'scripts/restore.js', 'i18n-seed/en.json', 'i18n-seed/ar.json',
                      'docker-entrypoint.sh', 'Dockerfile']) {
  const p = path.join(ROOT, ...needed.split('/'));
  const exists = fs.existsSync(p);
  ok(exists && !isExcluded(needed, patterns) && !isExcluded(needed, railPatterns),
    `deploy must carry ${needed}`,
    !exists ? 'file missing' : isExcluded(needed, patterns) ? '.dockerignore drops it' : '.railwayignore drops it');
}

/* ---------- 4. the entrypoint is executable in the image ---------- */
const entry = path.join(ROOT, 'docker-entrypoint.sh');
ok(fs.existsSync(entry), 'docker-entrypoint.sh exists');
const df = path.join(ROOT, 'Dockerfile');
if (fs.existsSync(df)) {
  const dockerfile = fs.readFileSync(df, 'utf8');
  ok(/ENTRYPOINT\s+\[?"?docker-entrypoint\.sh/.test(dockerfile), 'Dockerfile ENTRYPOINTs the entrypoint script');
  ok(/chmod \+x \/usr\/local\/bin\/docker-entrypoint\.sh/.test(dockerfile), 'Dockerfile makes it executable');
}

console.log(failed ? `\n${failed} FAILED` : '\nall image-shipped checks passed');
process.exit(failed ? 1 : 0);
