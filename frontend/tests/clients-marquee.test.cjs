/* ============================================================
   NOVIQ — Our Clients marquee: logo pass-through + click target
   ------------------------------------------------------------
   Three real bugs lived in this component and none of them showed up in
   a type check, because every one of them was a VALUE being dropped or a
   string that matched nothing:

     1. Hero passed `clients={source.map(c => c.name)}` — names only — so
        an uploaded logo never reached the marquee and never rendered.
     2. The marquee built a correct `toLogos()` with images and hrefs and
        then threw it away, calling `row.list.map((name) => ({ name }))`.
        Even after fixing (1), the rows would still be wordmarks.
     3. The CSS hover-pause targets `.noviq-clients`, which nothing in the
        component rendered — so the scroll never paused and the cells could
        not be clicked with a pointer.

   This asserts the three properties structurally, by reading the source,
   because they are all "a value silently discarded" bugs: there is no
   runtime assertion that catches a map() that drops a field.

   Run: npm run test:clients
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const marquee = fs.readFileSync(
  path.join(ROOT, 'components', 'OUR CLINTS', 'our-clints-marquee.tsx'),
  'utf8'
);
const hero = fs.readFileSync(path.join(ROOT, 'components', 'sections', 'Hero.tsx'), 'utf8');
const globals = fs.readFileSync(path.join(ROOT, 'styles', 'globals.css'), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. Hero must pass the whole entry, not just the name ---- */
const heroCall = hero.slice(hero.indexOf('<OurClintsMarquee'));
const heroBlock = heroCall.slice(0, heroCall.indexOf('/>') + 2);

ok(/clients=\{source\.map\(\(c\)\s*=>\s*\(?\{/.test(heroBlock),
  'Hero passes an object per client, not a bare name',
  'clients= is still a name-only projection');
ok(/img:\s*c\.img/.test(heroBlock),
  'Hero forwards c.img so an uploaded logo is not dropped');

ok(/clientsHref=/.test(heroBlock),
  'Hero passes clientsHref so cells link to Our Clients');
ok(/clientsHref=\{`\/\$\{locale\}\/clients`\}/.test(heroBlock),
  'clientsHref points at the locale-aware /clients route');

/* ---- 2. the marquee must use toLogos() when rendering ---- */
const render = marquee.slice(marquee.indexOf('<FlowingLogos'));
const renderBlock = render.slice(0, render.indexOf('/>') + 2);

ok(/data=\{toLogos\(row\.list\)\}/.test(renderBlock),
  'FlowingLogos is fed toLogos(row.list)',
  renderBlock.match(/data=\{[^}]*\}/)?.[0] || 'no data= prop found');
ok(!/row\.list\.map\(\s*\(\s*name\s*\)/.test(renderBlock),
  'no name-only projection reaches FlowingLogos');

/* toLogos must actually carry both fields through. */
const toLogos = marquee.slice(marquee.indexOf('const toLogos'));
const toLogosBlock = toLogos.slice(0, toLogos.indexOf(');'));
ok(/image:\s*e\.img/.test(toLogosBlock), 'toLogos maps name -> image');
ok(/href:\s*clientsHref/.test(toLogosBlock), 'toLogos maps the destination');

/* Every row renders the mixed variant: artwork where it exists, wordmark
   where it does not — logos scattered among names in the same row. */
ok(/variant="mixed"/.test(renderBlock),
  'every row renders variant="mixed"');
ok(!/variant=\{/.test(renderBlock),
  'no per-row variant switch remains');
ok(!/["']wide["']/.test(renderBlock) && !/["']logo["']/.test(renderBlock),
  'neither the boxed "wide" nor the segregated "logo" variant is used here');

/* ---- logos live inside the name rows, never on a row of their own ---- */
ok(!/withLogos/.test(marquee),
  'no separate logo-only list is built');
ok(!/logoRow/.test(marquee),
  'no logoRow flag, row, or band remains anywhere in the marquee');
ok(/shuffled\(entries,\s*\d+\)/.test(marquee),
  'each row shuffles the full entry list with a fixed seed');
/* Fixed seeds — never a nondeterministic RNG: the server render and the first
   client render must produce the identical order or React reports a hydration
   mismatch on every load. Comments are stripped first so the explanatory
   prose naming the forbidden call does not trip its own assertion. */
const marqueeCode = marquee
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
ok(!/Math\.random\s*\(/.test(marqueeCode),
  'no Math.random() in row ordering (SSR-safe shuffle only)');
ok(/mulberry32|seed/i.test(marqueeCode),
  'the shuffle is seeded (deterministic across server and client)');

/* ---- the bare variant must not reintroduce the tile ---- */
const flowing = fs.readFileSync(
  path.join(ROOT, 'components', 'ui', 'logo-cloud-marquee-utils', 'flowing-logos.tsx'),
  'utf8'
);
/* The bare artwork element is defined once as `bareImageEl` and shared by
   the `logo` and `mixed` branches. Assert on the definition itself rather
   than slicing between branches — branch order in the ternary is an
   implementation detail and prose comments contain the same keywords. */
const bareDefStart = flowing.indexOf('const bareImageEl');
const bareDefEnd = flowing.indexOf('/>', bareDefStart);
const bareDef = bareDefStart > 0 && bareDefEnd > bareDefStart
  ? flowing.slice(bareDefStart, bareDefEnd + 2)
  : '';

ok(bareDefStart > 0, 'the bare image element is defined once and shared');
ok(/flowing-logo-img--bare/.test(bareDef), 'the bare image element uses the bare image class');
ok(!/className=\{cn\(/.test(bareDef),
  'the bare image element has no cn() wrapper to build a box');
ok(!/<span/.test(bareDef),
  'the bare image element emits no wrapper <span> at all');
/* `mixed` no longer shows the bare mark alone: a client WITH artwork gets
   the round logo PLUS its name in one pill (the name stays visible as
   before), a client WITHOUT keeps the wordmark. */
ok(/src \? brandEl : wordmarkEl/.test(flowing),
  'mixed picks round-logo-plus-name when artwork exists, the wordmark otherwise');
ok(!/src \? bareImageEl : wordmarkEl/.test(flowing),
  'mixed no longer renders the bare mark without its name');
ok(/flowing-logo-cell/.test(flowing.slice(flowing.indexOf(') : (') + 6, flowing.indexOf('if (!logo.href)'))),
  'the boxed cell is still what wide/square render (unchanged behaviour)');
ok(!/flowing-logo-glyph/.test(bareDef),
  'no initial-glyph fallback on the bare artwork element');
/* The arrow is gone from the JSX entirely, not conditionally suppressed.
   `.flowing-logo-arrow` had no CSS rule anywhere, so it rendered as a raw
   "→" glyph between every wordmark and beside every logo — a screenshot showed
   the section as a grid of arrows rather than a cloud of marks. Its only
   remaining occurrence must be the comment explaining the removal. */
const arrowInJsx = flowing
  .split('\n')
  .filter((l) => l.includes('flowing-logo-arrow'))
  .filter((l) => !/^\s*(\*|\/\*)/.test(l));
ok(arrowInJsx.length === 0,
  'no flowing-logo-arrow element remains in the JSX',
  arrowInJsx.join(' | '));
ok(!/className="flowing-logo-arrow"/.test(flowing),
  'the arrow element itself is not rendered');
ok(!/\.flowing-logo-arrow\s*\{/.test(globals),
  'and has no CSS rule to resurrect it');

/* ---- the brand pill: round logo + name, never a bare mark ---- */
const brandStart = flowing.indexOf('const brandEl');
const brandEnd = brandStart > 0 ? flowing.indexOf(');', brandStart) : -1;
const brandDef = brandStart > 0 && brandEnd > brandStart
  ? flowing.slice(brandStart, brandEnd + 2)
  : '';
ok(brandStart > 0, 'the brand pill element is defined for mixed rows');
ok(/flowing-brand-img/.test(brandDef), 'the pill carries the round logo image');
ok(/flowing-brand-name/.test(brandDef), 'the pill keeps the company name visible beside its logo');
ok(/\{logo\.name\}/.test(brandDef), 'the pill renders the actual company name, not a placeholder');
ok(/alt=""/.test(brandDef), 'the pill image has empty alt (the visible name announces the brand once)');
/* The standalone `logo` variant still uses the bare mark for other callers:
   slice between the two branch markers so branch order/comments cannot
   matter, then assert the bare element is what that branch renders. */
{
  const logoBranchStart = flowing.indexOf("variant === 'logo' ? (");
  const mixedBranchStart = flowing.indexOf("variant === 'mixed' ? (");
  const logoBranch = logoBranchStart > 0 && mixedBranchStart > logoBranchStart
    ? flowing.slice(logoBranchStart, mixedBranchStart)
    : '';
  ok(/bareImageEl/.test(logoBranch),
    'the standalone logo variant still renders the bare mark');
}

/* ---- the pill CSS: circle crop, white seat, pill shell ---- */
const brandImgRule = globals.match(/\.flowing-brand-img\s*\{([^}]*)\}/)?.[1] || '';
ok(/border-radius:\s*999px/.test(brandImgRule), 'pill logos are cropped to a circle', brandImgRule.trim());
ok(/object-fit:\s*cover/.test(brandImgRule), 'pill logos cover the circle without distortion');
ok(/background:\s*#fff/.test(brandImgRule), 'pill logos sit on white (legible over the dark page)');
const brandRule = globals.match(/\.flowing-brand\s*\{([^}]*)\}/)?.[1] || '';
ok(/border-radius:\s*999px/.test(brandRule), 'the pill itself is fully rounded', brandRule.trim());
ok(/\.flowing-logos-group:has\(\.flowing-brand\)/.test(globals),
  'brand-pill rows get their own track gap');
ok(/\.flowing-brand-name:lang\(ar\)/.test(globals),
  'the pill name drops letter-spacing for genuinely Arabic names');

/* ---- edge fade: mask only, no colour overlays ----
   The per-row `flowing-fade` gradient divs painted a solid dark block on
   the sides in dark mode. The canopy mask already fades both edges without
   any colour, identically in both themes — so the overlays are gone.
   Comments name the removed divs, so strip them first like the RNG guard
   below does — otherwise the explanation trips its own assertion. */
const marqueeStripped = marquee
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
ok(!/flowing-fade/.test(marqueeStripped),
  'no flowing-fade overlay divs remain in the marquee');
ok(!/from-white\/60|dark:from-background/.test(marquee),
  'no white/dark gradient fade utilities remain in the marquee');
ok(/\.flowing-logos-canopy\s*\{[^}]*mask-image:/.test(globals),
  'the canopy mask still fades both edges (colour-agnostic, both themes)');

/* ---- a name row must render a NAME, never the artwork ----
   The `&& !src` guard on the wordmark branch meant a client WITH an uploaded
   logo fell through to the boxed cell inside a name row, so the two bands
   looked identical and the logo appeared welded to its name. The wordmark
   branch must therefore be selected by variant alone. */
const wordmarkBranchStart = flowing.indexOf('variant === \'wordmark\' ? (');
ok(wordmarkBranchStart > 0, 'the wordmark branch is reachable');
const afterWordmark = flowing.slice(wordmarkBranchStart, wordmarkBranchStart + 260);
ok(!/&& !src/.test(afterWordmark),
  'the wordmark branch no longer requires src to be ABSENT',
  'variant === "wordmark" && !src — a client with a logo renders artwork in a name row');
ok(/variant === 'mixed' \? \(/.test(flowing),
  'a mixed branch picks per cell: artwork where it exists, wordmark where not');
ok(/variant === 'logo' \? \(/.test(flowing),
  'the standalone logo variant still exists for other callers');

/* ---- the bare CSS must not re-add a box ---- */
/* Read the whole rule block, since the selector list and the declarations are
   separate matches and the declarations are what carry the intent. */
const bareRule = globals.match(/\.flowing-logo-img--bare\s*\{([^}]*)\}/)?.[1] || '';
ok(/height:\s*2\.75rem/.test(bareRule), 'bare logos get their own height', bareRule.trim());
ok(/max-width:\s*10rem/.test(bareRule), 'bare logos keep the intrinsic aspect ratio via a max-width');
ok(!/border\s*:/.test(bareRule), 'bare logo rule adds no border', bareRule.trim());
ok(!/background\s*:/.test(bareRule), 'bare logo rule adds no background', bareRule.trim());
/* The base rule greyscales + dims the logo for the TILED variant. With the
   tile gone that turns a brand mark into a grey rectangle that reads as a
   broken image, so the bare variant must cancel both. */
ok(/filter:\s*none/.test(bareRule), 'bare logos are NOT greyscaled (brand colour is the signal)');
ok(/opacity:\s*0\.9/.test(bareRule), 'bare logos are near-full opacity', bareRule.trim());
/* A tile used to supply its own padding; without one the marks would touch. */
ok(/\.flowing-logos-group:has\(\.flowing-logo-img--bare\)/.test(globals),
  'the artwork row gets its own wider gap');
ok(/focus-visible \.flowing-logo-img--bare\s*\{[^}]*outline/.test(globals),
  'keyboard focus still visible on a borderless mark');

/* ---- 3. the hover-pause class must actually be rendered ---- */
ok(/["']noviq-clients[\s"']/.test(marquee),
  'the section renders className="noviq-clients"');
ok(/\.noviq-clients:hover\s+\.noviq-clients-track/.test(globals),
  'globals.css still keys the pause on that class (unchanged)');
ok(/animation-play-state:\s*paused/.test(globals),
  'the pause rule exists');
ok(!/classes=\{cn\(\s*["']relative mt-20/.test(marquee),
  'the old class-only section opener is gone');

/* ---- a11y: cells stay links, the standalone CTA button is gone ---- */
ok(!/from ["']next\/link["']/.test(marquee),
  'marquee no longer imports Link (the text fallback button was deleted)');
ok(!/See all our clients<\/Link>|ctaLabel\}\s*\n?\s*<span/.test(marquee),
  'no CTA button block remains under the cloud');
ok(/href:\s*clientsHref/.test(toLogosBlock),
  'cells themselves still navigate to Our Clients when clicked');

/* ctaLabel must mention the destination so a cell link announces meaning. */
ok(/linkLabel:/.test(toLogosBlock) && /ctaLabel/.test(toLogosBlock),
  'each cell link carries a descriptive label, not a bare name');

/* ---- dead-code guard: the interface must still document the image field ---- */
ok(/img\?:\s*string/.test(marquee),
  'OurClintsEntry still declares img?: string');

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
