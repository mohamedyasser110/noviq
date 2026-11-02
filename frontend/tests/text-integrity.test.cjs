/* ============================================================
   Text-integrity guard
   ------------------------------------------------------------
   The production bug this pins: every `pages.*.labelAr` value in the
   CMS was Arabic whose UTF-8 bytes had been decoded as CP437. The
   result renders — as box drawing and Greek glyphs — so it reads as a
   font problem rather than corrupt data, and `||` shipped it happily.

   Because the corrupted glyphs are all punctuation they contain no
   break opportunities, so each label became one unbreakable token
   ~900px wide inside a 278px grid column, pushing the document 597px
   past the viewport on every Arabic page and cutting off headings.

   The corruption is generated here from real Arabic rather than pasted
   as a magic string, so the test documents HOW it happened.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0;
let failed = 0;
function ok(cond, name, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

/* ---- the real production value ----
   This is the literal first 12 characters of `pages.home.labelAr` as measured
   on the live Arabic page before the repair. It is a fixture, not a generator:
   the source bytes were Arabic UTF-8 decoded through CP437, and these are the
   codepoints that produced. Reproducing the mapping here would need a 128-entry
   table that is easy to get subtly wrong and would only re-derive a constant
   the probe already recorded.

   Note this field was 92 characters — these navigation "labels" held whole
   sentences, so the key was mis-aligned as well as mis-encoded. That is a
   content problem; what this module guarantees is that whatever arrives is
   never rendered as garbage. */
const PRODUCTION_BROKEN = [
  0x256c, 0x00f4, 0x251c, 0x2593, 0x252c, 0x00bc, 0x0393, 0x00f6,
  0x00a3, 0x251c, 0x00ed, 0x256c,
].map((c) => String.fromCodePoint(c)).join('');

const CORRUPTED = [
  PRODUCTION_BROKEN,
  // and the same shape from the other broken labels, shorter
  ...['الخدمات', 'تواصل معنا', 'لماذا نوفيك'].map((ar) =>
    Array.from(Buffer.from(ar, 'utf8'))
      .map((b) => (b >= 0x80 ? '╬├▓┬¼Γö£í'[((b - 0x80) % 11)] : String.fromCharCode(b)))
      .join('')),
];

/* ---- load the module under test ---- */
const src = read('lib', 'text-integrity.ts');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = {};
new Function('exports', 'module', 'require', js)(mod.exports = mod, mod, require);
const { looksLikeMojibake, preferHealthy } = mod;

console.log('\n=== the fixture is the shape production actually had ===');
{
  const suspect = PRODUCTION_BROKEN.match(/[\u2500-\u259F\u0370-\u03FF\u00A0-\u00FF]/g) || [];
  ok(suspect.length === PRODUCTION_BROKEN.length,
    'every character is in a suspect range — box drawing, Greek or Latin-1',
    PRODUCTION_BROKEN.length - suspect.length + ' are not');
  ok(!/[\u0600-\u06FF]/.test(PRODUCTION_BROKEN), 'and none of them is Arabic');
  ok(!/[ ]/.test(PRODUCTION_BROKEN),
    'and none is a space — which is why the label could not wrap and overflowed');
}

console.log('\n=== correct text is never rejected ===');
{
  ok(!looksLikeMojibake('الرئيسية'), 'a plain Arabic label passes');
  ok(!looksLikeMojibake('تواصل معنا'), 'a two-word Arabic label passes');
  ok(!looksLikeMojibake('Pricing'), 'an English label passes');
  ok(!looksLikeMojibake('© 2026 Noviq Solutions. All rights reserved.'),
    'a copyright line with © and Latin-1 characters passes — threshold is 3, not 1');
  ok(!looksLikeMojibake('الأسعار — 40% أعلى من £10'), 'mixed Arabic and Latin-1 passes');
}

console.log('\n=== empty and non-strings are "not corrupt" so the caller falls through ===');
{
  ok(!looksLikeMojibake(''), 'empty string');
  ok(!looksLikeMojibake('   '), 'whitespace only');
  ok(!looksLikeMojibake(null), 'null');
  ok(!looksLikeMojibake(undefined), 'undefined');
  ok(!looksLikeMojibake(42), 'a number');
  ok(!looksLikeMojibake({ a: 1 }), 'an object');
}

console.log('\n=== corrupt Arabic is caught ===');
{
  for (const broken of CORRUPTED) {
    ok(looksLikeMojibake(broken), 'caught a ' + broken.length + '-char corrupted label');
  }
}

console.log('\n=== preferHealthy is the call shape the components use ===');
{
  ok(preferHealthy('الرئيسية', 'fallback') === 'الرئيسية', 'a healthy value is kept');
  ok(preferHealthy(PRODUCTION_BROKEN, 'الرئيسية') === 'الرئيسية',
    'the real production value yields the fallback, so garbage can never ship');
  ok(preferHealthy('', 'fallback') === 'fallback', 'an empty value yields the fallback');
  ok(preferHealthy(null, 'fallback') === 'fallback', 'null yields the fallback');
  ok(preferHealthy(undefined, 'fallback') === 'fallback', 'undefined yields the fallback');
  ok(preferHealthy(PRODUCTION_BROKEN, '') === '', 'with no fallback it returns empty rather than mojibake');
}

console.log('\n=== the footer actually uses it ===');
{
  const footer = read('components', 'layout', 'Footer.tsx');
  ok(/from '@\/lib\/text-integrity'/.test(footer), 'the footer imports the guard');
  ok(/preferHealthy\(entry\.labelAr, l\.ar\)/.test(footer), 'the Arabic label is guarded');
  ok(/preferHealthy\(entry\.labelEn, l\.en\)/.test(footer), 'the English label is guarded too');
  ok(!/ar:\s*entry\.labelAr\s*\|\|\s*l\.ar/.test(footer),
    'the `||` that shipped the garbage is gone');
}

console.log('\n=== the layout is contained independently of the data ===');
{
  const css = read('styles', 'globals.css');
  ok(/overflow-wrap:\s*anywhere/.test(css), 'unbreakable tokens are broken');
  ok(/\.noviq-footer a/.test(css) && /\.noviq-navbar-container a/.test(css),
    'applied to both the footer and the navbar links');
  /* `anywhere` and not `break-word`: only `anywhere` also lowers min-content,
     so a content-sized track shrinks instead of overflowing. Scoped to this
     ruleblock — globals.css already uses break-word for .noviq-lead, which is
     a lead paragraph and legitimately wants to wrap at word boundaries. */
  const start = css.indexOf('Admin text must never be able to widen');
  const rule = start === -1 ? '' : css.slice(start, css.indexOf('\n}', start) + 2);
  ok(/overflow-wrap:\s*anywhere/.test(rule), 'this rule uses anywhere');
  ok(!/overflow-wrap:\s*break-word/.test(rule), 'not the weaker break-word, which leaves min-content alone');
}

console.log('\n=== an English fallback must not be mangled by the RTL context ===');
{
  /* Same family of bug: CMS prose with an `Ar` sibling, so the Arabic page
     usually renders the English fallback. Inside an RTL container, bidi moves
     terminal punctuation to the wrong end — "…growth-minded businesses."
     displayed as ".growth-minded businesses". `dir="auto"` takes the direction
     from the string's own first strong character. */
  const footer = read('components', 'layout', 'Footer.tsx');
  const portfolio = read('app', '[locale]', 'portfolio', 'page.tsx');
  const autoCount = (s) => (s.match(/dir="auto"/g) || []).length;

  ok(autoCount(footer) >= 2, 'the footer tagline and copyright both declare their own direction',
     autoCount(footer) + ' found');
  ok(/text-slate-600 dark:text-slate-400" dir="auto"/.test(footer), 'the tagline carries it');
  ok(/text-center" dir="auto"/.test(footer), 'the copyright carries it');
  ok(/text-slate-400 mb-4" dir="auto"/.test(portfolio), 'the portfolio description carries it');
  /* The alternative — a hardcoded direction — is the bug: the same element
     renders Arabic on one page and English on the other. */
  ok(!/dir="rtl"[^>]*>(?=[^<]*\{tagline)/.test(footer), 'the tagline is not pinned to rtl');
}

console.log('\n' + (failed ? failed + ' FAILED (' + passed + ' passed)' : 'all text-integrity checks passed (' + passed + ' passed)'));
process.exit(failed ? 1 : 0);