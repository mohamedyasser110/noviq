/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Integrity check for the ported black hole component.

   The .txt -> .tsx conversion went through PowerShell string handling, so this
   proves the file survived: valid UTF-8, no replacement characters or
   mojibake, all six GLSL shader blocks intact and brace-balanced, and every
   uniform the JS writes actually declared by a shader (a mistyped uniform
   binds to null and is silently ignored by the driver — the one corruption
   that would be invisible until the picture came out wrong).

   Run: node scripts/verify-blackhole-src.mjs                                         */
import { readFileSync } from 'node:fs';

const P = PORTABLE_FRONTEND + '/components/hero3d/BlackHoleHeroSection.tsx';
const buf = readFileSync(P);

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  OK   ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${n}${extra ? '  ' + extra : ''}`); }
};

console.log('\nBlackHoleHeroSection.tsx — source integrity');
console.log('-'.repeat(62));

/* 1. BOM-free. A stray BOM ahead of the directive is harmless, but know it. */
check('no UTF-8 BOM', !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf));

/* 2. Decodes as strict UTF-8 — invalid bytes would have become U+FFFD. */
let text = null;
try {
  text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  check('decodes as strict UTF-8', true, `${buf.length} bytes`);
} catch (e) {
  check('decodes as strict UTF-8', false, e.message.slice(0, 60));
  process.exit(1);
}

/* 3. No replacement characters, no classic mojibake. */
const fffd = (text.match(/�/g) || []).length;
check('no U+FFFD replacement characters', fffd === 0, fffd ? `${fffd} found` : '');
const mojibake = (text.match(/[ÂÃ][ -¿]/g) || []).length;
check('no mojibake (A-tilde / A-circumflex sequences)', mojibake === 0, mojibake ? `${mojibake} found` : '');

/* 4. The directive must be the first statement in the file. */
const firstStatement = text
  .split('\n')
  .map((l) => l.trim())
  .find((l) => l && !l.startsWith('/*') && !l.startsWith('*') && !l.startsWith('//'));
check("first statement is 'use client'", firstStatement === "'use client';", JSON.stringify(firstStatement));

/* 5. All six GLSL shader blocks present. */
for (const name of ['VERT', 'SCENE_FRAG', 'BLEND_FRAG', 'BRIGHT_FRAG', 'BLUR_FRAG', 'COMPOSITE_FRAG']) {
  check(`  ${name} shader present`, text.includes(`const ${name} = `));
}

/* 6. Shader internals that are easy to mangle in transit. */
const internals = [
  ['MAX_STEPS 460', '#define MAX_STEPS 460'],
  ['WIND_CYCLE 28.0', '#define WIND_CYCLE 28.0'],
  ['hash13', 'float hash13(vec3 p)'],
  ['fbm', 'float fbm(vec3 p, float lod)'],
  ['gasAt', 'void gasAt(vec3 p, float rd, float dt, out float dens'],
  ['starField', 'vec3 starField(vec3 d)'],
  ['gravity term', 'vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);'],
  ['golden-ratio step jitter', 'jitter = fract(jitter + 0.6180339887);'],
  ['aces tonemap', 'vec3 aces(vec3 x) {'],
  ['doppler beaming', 'pow(max(g, 0.02), 3.0 * uDoppler)'],
  ['hexToLinear', 'function hexToLinear(hex: string)'],
  ['giveUp', 'function giveUp(why: string) {'],
  ['software-renderer guard', 'swiftshader|llvmpipe|softpipe'],
  ['settle()', 'function settle(passes: number) {'],
  ['context loss handler', 'webglcontextlost'],
  ['context restore handler', 'webglcontextrestored'],
  ['reduced motion', 'prefers-reduced-motion'],
  ['visibility pause', 'visibilitychange'],
  ['export default', 'export default BlackHoleHeroSection;'],
];
for (const [label, token] of internals) {
  check(`  ${label}`, text.includes(token));
}

/* 7. Parse the shader blocks, check braces, and cross-check uniforms.
      The backtick pattern is built from a char code: a literal backtick in a
      PowerShell-authored file is fragile, and a broken regex here reports
      "every uniform is missing" rather than failing loudly. */
const BT = String.fromCharCode(96);
const blockRe = new RegExp('const (\\w+) = ' + BT + '([\\s\\S]*?)' + BT + ';', 'g');
const blocks = [...text.matchAll(blockRe)];
check('6 template-literal shader blocks parsed', blocks.length === 6, `${blocks.length} found`);

const declared = new Set();
for (const [, name, body] of blocks) {
  const ob = (body.match(/{/g) || []).length;
  const cb = (body.match(/}/g) || []).length;
  check(`  ${name}: braces balanced`, ob === cb, `${ob} open / ${cb} close`);
  for (const m of body.matchAll(/uniform\s+\w+\s+(u\w+)/g)) declared.add(m[1]);
}
check('  GLSL uniforms collected', declared.size > 30, `${declared.size} declared`);

/* Every uniform the JS writes must be declared by SOME shader. Scoping this
   per program is unreliable because the scene pass aliases its map to a local
   `u`, so the comparison is global. */
const written = new Set();
for (const m of text.matchAll(/\.(u[A-Z]\w*)!/g)) written.add(m[1]);
for (const m of text.matchAll(/^\s*gl!?\.uniform\w*f?\(\s*u\.(u\w+)!/gm)) written.add(m[1]);
const missing = [...written].filter((u) => !declared.has(u));
check('every uniform the JS writes is declared in a shader', missing.length === 0,
  missing.length ? `missing: ${missing.join(', ')}` : `${written.size} written / ${declared.size} declared`);

/* 8. Line count sanity: source body plus the header comment added on port. */
const lines = text.split('\n').length;
/* A sanity bound, not an exact pin: it catches a truncated or concatenated
   copy without breaking every time a comment is added. */
check('line count matches source + header', lines >= 1180 && lines <= 1340, `${lines} lines`);

console.log(`\n${'-'.repeat(62)}\n  ${pass} passed / ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
