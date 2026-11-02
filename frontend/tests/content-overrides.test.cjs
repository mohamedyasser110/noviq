/**
 * Unit test for the localStorage content-override merge logic.
 * Runs in plain Node — no test framework, no browser.
 *
 *   node tests/content-overrides.test.cjs
 *
 * The module under test is TypeScript, so we exercise the same
 * algorithm through a small harness that mirrors lib/content-admin.ts.
 * Keeping it dependency-free means it runs on this memory-constrained
 * machine without pulling in a test runner.
 */
const assert = require('assert');

/* ---- mirror of lib/content-admin.ts (applyContentOverrides) ---- */
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v);
    return out;
  }
  return value;
}

function applyContentOverrides(base, overrides) {
  const entries = Object.entries(overrides);
  if (entries.length === 0) return base;
  const result = cloneValue(base);
  for (const [path, replacement] of entries) {
    const segments = path.split('.').filter(Boolean);
    if (segments.length === 0) continue;
    let cursor = result;
    let reachable = true;
    for (let i = 0; i < segments.length - 1; i++) {
      if (cursor === null || typeof cursor !== 'object') { reachable = false; break; }
      cursor = cursor[segments[i]];
    }
    if (!reachable || cursor === null || typeof cursor !== 'object') continue;
    const last = segments[segments.length - 1];
    if (Array.isArray(cursor)) {
      const idx = Number(last);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) continue;
      cursor[idx] = cloneValue(replacement);
    } else {
      if (!(last in cursor)) continue;
      cursor[last] = cloneValue(replacement);
    }
  }
  return result;
}
/* ---- end mirror ---- */

const BASE = {
  hero: { title: 'Base title', desc: 'Base desc' },
  services: [{ title: 'A' }, { title: 'B' }],
  stats: [{ value: '1' }, { value: '2' }],
  footer: { tagline: 'Base tagline' },
};

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS  ' + name);
  } catch (e) {
    fail++;
    console.log('FAIL  ' + name + '\n      ' + e.message);
  }
}

check('empty patch returns the base by identity', () => {
  assert.strictEqual(applyContentOverrides(BASE, {}), BASE);
});

check('overrides a nested scalar', () => {
  const out = applyContentOverrides(BASE, { 'hero.title': 'New title' });
  assert.strictEqual(out.hero.title, 'New title');
  assert.strictEqual(out.hero.desc, 'Base desc', 'siblings untouched');
});

check('does not mutate the base', () => {
  const out = applyContentOverrides(BASE, { 'hero.title': 'X' });
  assert.strictEqual(BASE.hero.title, 'Base title');
  assert.notStrictEqual(out, BASE);
});

check('overrides by array index', () => {
  const out = applyContentOverrides(BASE, { 'services.1.title': 'B renamed' });
  assert.strictEqual(out.services[1].title, 'B renamed');
  assert.strictEqual(out.services[0].title, 'A');
  assert.strictEqual(out.services.length, 2);
});

check('ignores an out-of-range array index', () => {
  const out = applyContentOverrides(BASE, { 'services.9.title': 'ghost' });
  assert.strictEqual(out.services.length, 2, 'no phantom entry created');
});

check('ignores a non-integer array index', () => {
  const out = applyContentOverrides(BASE, { 'services.foo.title': 'x' });
  assert.strictEqual(out.services[0].title, 'A');
});

check('ignores an unknown key (no phantom fields)', () => {
  const out = applyContentOverrides(BASE, { 'hero.notAField': 'x' });
  assert.ok(!('notAField' in out.hero), 'phantom field was injected');
});

check('ignores an unknown top-level path', () => {
  const out = applyContentOverrides(BASE, { 'doesNotExist.anything': 1 });
  assert.ok(!('doesNotExist' in out));
});

check('ignores a path that walks through a scalar', () => {
  const out = applyContentOverrides(BASE, { 'hero.title.deeper': 'x' });
  assert.strictEqual(out.hero.title, 'Base title', 'scalar was corrupted');
});

check('ignores an empty path', () => {
  const out = applyContentOverrides(BASE, { '': 'x', '.': 'y' });
  assert.strictEqual(out.hero.title, 'Base title');
});

check('replaces an object wholesale', () => {
  const out = applyContentOverrides(BASE, { 'footer': { tagline: 'New', extra: 1 } });
  assert.strictEqual(out.footer.tagline, 'New');
  assert.strictEqual(out.footer.extra, 1);
});

check('multiple overrides in one patch all apply', () => {
  const out = applyContentOverrides(BASE, {
    'hero.title': 'T',
    'hero.desc': 'D',
    'services.0.title': 'A2',
  });
  assert.strictEqual(out.hero.title, 'T');
  assert.strictEqual(out.hero.desc, 'D');
  assert.strictEqual(out.services[0].title, 'A2');
});

check('override value is deep-cloned, not aliased', () => {
  const patch = { 'footer': { tagline: 'shared' } };
  const out = applyContentOverrides(BASE, patch);
  out.footer.tagline = 'mutated';
  assert.strictEqual(patch.footer.tagline, 'shared', 'patch object was aliased');
  assert.strictEqual(BASE.footer.tagline, 'Base tagline', 'base was aliased');
});

check('array elements are cloned, not aliased (non-empty patch)', () => {
  // NOTE: with an EMPTY patch the function intentionally returns `base` by
  // identity (fast path — no clone on every render). Cloning only happens
  // once a patch exists, which is the only case where a caller could
  // otherwise mutate shared state by accident.
  const out = applyContentOverrides(BASE, { 'hero.title': 'x' });
  out.services.push({ title: 'C' });
  assert.strictEqual(BASE.services.length, 2, 'base array was mutated');
  assert.notStrictEqual(out.services, BASE.services, 'array was aliased');
});

console.log(`\n${fail === 0 ? 'ALL TESTS PASSED' : fail + ' FAILED'} (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
