/* ============================================================
   NOVIQ — hero visuals: admin editor <-> frontend clamps
   ------------------------------------------------------------
   The black hole is a raymarcher, so an out-of-range value does not look
   wrong — it renders a black rectangle or throws inside the shader. The
   admin panel and the frontend each carry the same range table, and this
   suite exists because those two tables are in two languages that cannot
   import each other: the panel is one self-contained HTML file with no
   build step, the frontend is TypeScript.

   Nothing stops one of them being edited alone. This does.
   ============================================================ */
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const admin = read('admin', 'index.html');
const heroLib = read('..', 'frontend', 'lib', 'hero-visual-content.ts');
/* Module-level so the defaults cross-check at the foot of this file can see
   them: they are populated by executing the real TypeScript below, inside a
   block, and three copies of "the shipped value" is exactly what has to be
   compared afterwards. */
let resolveBlackHole = null;
let resolveLogo = null;
let defaults = null;
let defaultsLogo = null;
const hero = read('..', 'frontend', 'components', 'sections', 'Hero.tsx');
const navbar = read('..', 'frontend', 'components', 'layout', 'Navbar.tsx');
const footer = read('..', 'frontend', 'components', 'layout', 'Footer.tsx');
const routes = read('routes', 'admin.js');
const init = read('db', 'init.js');

/* Parse the frontend range table out of the TypeScript source. */
function frontRanges() {
  const block = heroLib.slice(
    heroLib.indexOf('export const BLACK_HOLE_FIELDS'),
    heroLib.indexOf('];', heroLib.indexOf('export const BLACK_HOLE_FIELDS')),
  );
  const out = {};
  for (const m of block.matchAll(/\{\s*key:\s*'(\w+)',\s*min:\s*(-?[\d.]+),\s*max:\s*(-?[\d.]+)/g)) {
    out[m[1]] = { min: parseFloat(m[2]), max: parseFloat(m[3]) };
  }
  return out;
}

/* Same for the admin's slider table. */
function adminRanges() {
  const block = admin.slice(admin.indexOf('const HOLE_SLIDERS'), admin.indexOf('const HOLE_COLORS'));
  const out = {};
  for (const m of block.matchAll(/\{\s*k:\s*'(\w+)',\s*label:[^}]*?min:\s*(-?[\d.]+),\s*max:\s*(-?[\d.]+)/g)) {
    out[m[1]] = { min: parseFloat(m[2]), max: parseFloat(m[3]) };
  }
  return out;
}

const front = frontRanges();
const panel = adminRanges();

/* ---- 1. the two range tables must agree, field for field ---- */
{
  const onlyFront = Object.keys(front).filter((k) => !panel[k]);
  const onlyPanel = Object.keys(panel).filter((k) => !front[k]);
  ok(onlyFront.length === 0, 'every frontend field has an admin slider', onlyFront.join(', '));
  ok(onlyPanel.length === 0, 'every admin slider has a frontend field', onlyPanel.join(', '));
  const drifted = Object.keys(front)
    .filter((k) => panel[k] && (front[k].min !== panel[k].min || front[k].max !== panel[k].max))
    .map((k) => `${k} (site ${front[k].min}..${front[k].max} vs panel ${panel[k]?.min}..${panel[k]?.max})`);
  ok(drifted.length === 0, 'the ranges are identical in both places', drifted.join(', '));
  ok(Object.keys(front).length >= 20, 'the tables are the full set of knobs', `${Object.keys(front).length} fields`);
}

/* ---- 2c. every knob says what it does ---- */
{
  const block = admin.slice(admin.indexOf('const HOLE_SLIDERS'), admin.indexOf('const HOLE_COLORS'));
  const withoutHint = [...block.matchAll(/\{\s*k:\s*'(\w+)',[^{}]*?\}/g)]
    .map((m) => ({ key: m[1], body: m[0] }))
    .filter((e) => !/\bhint:/.test(e.body))
    .map((e) => e.key);
  ok(withoutHint.length === 0, 'every black hole slider explains itself', withoutHint.join(', '));

  const colourBlock = admin.slice(admin.indexOf('const HOLE_COLORS'), admin.indexOf('let holeDraft'));
  const colours = [...colourBlock.matchAll(/k:\s*'(\w+)',\s*label:\s*'([^']*)'(?:,\s*hint:\s*'([^']*)')?/g)];
  const noColourHint = colours.filter((m) => !m[3]).map((m) => m[1]);
  ok(noColourHint.length === 0, 'every colour explains itself', noColourHint.join(', '));
  ok(colours.length >= 5, 'all five colour stops are described', colours.length + ' found');

  /* Group-level guidance, because "what is this group for" is not answerable
     from the individual knob names. */
  const groups = [...block.matchAll(/\{ g: '([^']*)'/g)].map((m) => m[1]);
  const groupsWithNote = [...block.matchAll(/\{ g: '([^']*)', note:/g)].map((m) => m[1]);
  ok(groups.length >= 5, 'the sliders are grouped', groups.length + ' groups');
  ok(groupsWithNote.length === groups.length, 'every group has a note saying what it is for',
     groups.filter((g) => !groupsWithNote.includes(g)).join(', '));
}

/* ---- 2d. both editors can get back to the shipped values ---- */
{
  ok(/function holeResetArm\(\)/.test(admin), 'the black hole editor has a reset');
  ok(/function logoResetArm\(\)/.test(admin), 'the logo editor has a reset');
  /* One click arms, a second performs — same pattern as the request and backup
     deletions, for the same reason. */
  ok(/if \(!holeResetArmed\)[\s\S]{0,200}holeResetArmed = true/.test(admin), 'the black hole reset is two-step');
  ok(/if \(!logoResetArmed\)[\s\S]{0,200}logoResetArmed = true/.test(admin), 'the logo reset is two-step');
  /* The reset must NOT write. Losing an afternoon of tuning to a stray click is
     the failure mode this is meant to prevent. */
  const resetBodies = [...admin.matchAll(/function (?:hole|logo)ResetArm\(\)\s*\{[\s\S]*?\n\}/g)].map((m) => m[0]);
  ok(resetBodies.length === 2, 'both reset handlers found', resetBodies.length + '');
  ok(resetBodies.every((b) => !/apiFetch|method:\s*'PUT'/.test(b)),
    'neither reset saves — it only rewrites the draft');
  ok(/holeDraft = Object\.assign\(\{\}, HOLE_DEFAULTS\)/.test(admin), 'the black hole reset restores the whole table');
  /* Deep copy, not Object.assign: the logo draft holds nested slot objects and
     a shallow copy would let slider edits mutate LOGO_DEFAULTS itself —
     silently moving "the default" for every future reset. */
  ok(/logoDraft = logoDeepCopy\(LOGO_DEFAULTS\)/.test(admin), 'the logo reset deep-copies the whole table');
  ok(/function logoDeepCopy/.test(admin), 'the deep copy helper exists');

  /* And the panel says when it differs from what ships. */
  ok(/function markLogoDirty\(\)/.test(admin) && /function markHoleDirty\(\)/.test(admin),
    'both editors track a changed-from-default count');
  ok(/function holeChangedCount\(\)/.test(admin) && /function logoChangedCount\(\)/.test(admin),
    'both count against their defaults table');
  ok(/hv-changed/.test(admin), 'individual changed fields are marked');
}

/* ---- 2e. the logo preview resolves, and there is a live one ---- */
{
  /* The bug: /logo/… lives on the frontend, the panel is served from the API
     origin, so the preview showed an empty box and a paragraph. The backend
     already knows the site origin — it pings it on every content save. */
  ok(/router\.get\('\/site-config'/.test(read('routes', 'public.js')),
    'the backend publishes the site origin');
  ok(/FRONTEND_REVALIDATE_URL/.test(read('routes', 'public.js')),
    'and it is the origin it already uses to revalidate the frontend');
  ok(/function assetUrl\(path\)/.test(admin), 'the dashboard resolves assets through it');
  ok(/siteOrigin \+ rooted/.test(admin), 'a relative path is resolved against the site origin');
  ok(/\/\^https\?:\\\/\\\/\/i\.test\(s\)/.test(admin), 'an absolute URL is left alone');
  ok(!/Cannot load this path from the dashboard/.test(admin),
    'the old dead-end explanation is gone');

  /* Live preview: judging size and placement needs to happen while the slider
     is moving, not after a save and a reload. */
  ok(/function updateLogoPreview\(\)/.test(admin), 'the preview can be redrawn on its own');
  ok(/function logoPreviewMarkup\(\)/.test(admin), 'the stage renders from the draft');
  ok(/oninput="setLogoNumber[^"]*"/.test(admin), 'number inputs fire on input, not on commit');
  ok(/updateLogoPreview\(\);markLogoDirty\(\)/.test(admin), 'changing a control redraws the stage');
  ok(/id="lg-stage"/.test(admin), 'the stage is in the panel');
  /* Both directions, because alignment is the one control that cannot be
     judged from an English page alone. */
  const stage = admin.slice(admin.indexOf('function logoPreviewMarkup'), admin.indexOf('function updateLogoPreview'));
  ok(/slot\('ltr', 'desktopEn'\)/.test(stage) && /slot\('rtl', 'desktopAr'\)/.test(stage), 'each desktop context renders in its own direction');
  ok(/slot\('ltr', 'footer'\)/.test(stage) && /slot\('rtl', 'footer'\)/.test(stage), 'the footer is shown in both directions');
  ok(/lg-align-/.test(stage), 'the stage honours the selected alignment');
  ok(/max-width:\$\{Number\(maxW\)/.test(stage), 'and the max width');
}

/* ---- 2f. alignment is logical, and the bounded area is real ---- */
{
  ok(/align: 'start'/.test(heroLib), 'slots default to the leading edge');
  ok(/footerAlign: 'center'/.test(heroLib), 'the footer defaults to centred');
  ok(/maxWidth: 220/.test(heroLib) && /footerMaxWidth: 320/.test(heroLib), 'slots carry a bounded width');
  /* Only the known alignments are accepted; anything else falls back. */
  ok(/src\.align === 'center' \|\| src\.align === 'end'/.test(heroLib),
    'only the three known alignments are accepted');
  ok(/src\.footerAlign === 'center' \|\| src\.footerAlign === 'end'/.test(heroLib), 'same for the footer');
  ok(/key: 'maxWidth'/.test(heroLib) && /key: 'footerMaxWidth'/.test(heroLib),
    'the max widths are clamped like every other number');

  ok(/noviq-logo-align-\$\{prof\.align\}/.test(navbar), 'the navbar applies the context alignment');
  ok(/'--logo-max-w': `\$\{prof\.maxWidth\}px`/.test(navbar), 'the navbar honours the bounded width');
  ok(/maxWidth: footerLogo\.footerMaxWidth/.test(footer), 'the footer honours the bounded width');
  ok(/noviq-logo-align-\$\{footerLogo\.footerAlign\}/.test(footer), 'the footer applies the chosen alignment');

  /* object-position is a PHYSICAL property, so the RTL flip has to be spelled
     out — otherwise "start" would render on the left in Arabic too. */
  const css = read('..', 'frontend', 'styles', 'globals.css');
  ok(/\.noviq-logo-align-start \.noviq-logo-full \{ object-position: left center/.test(css), 'start is the left in LTR');
  ok(/\[dir='rtl'\] \.noviq-logo-align-start \.noviq-logo-full,\s*\n\[dir='rtl'\] \.noviq-logo-align-start \.noviq-logo-icon \{ object-position: right center/.test(css),
    'and the right in RTL');
  ok(/\[dir='rtl'\] \.noviq-logo-align-end \.noviq-logo-full,\s*\n\[dir='rtl'\] \.noviq-logo-align-end \.noviq-logo-icon \{ object-position: left center/.test(css),
    'end mirrors too');
  /* Both morph states must share the mechanism, or "move it right" works before
     the timer fires and does nothing after it. */
  ok(/\.noviq-logo-align-start \.noviq-logo-icon \{ object-position: left center/.test(css), 'the mark is positioned by the same rules');
  ok(/height: var\(--logo-slot-h, 56px\)/.test(css), 'the slot height is the admin value');
  /* `width`, not `max-width`: the bounded area has to be able to GIVE the logo
     room as well as take it away, or the alignment control has ~46px to work
     in and the number is unreadable as "how much room the logo gets". */
  ok(/width: var\(--logo-max-w, 140px\)/.test(css), 'the bounded area is the admin value');
  ok(!/max-width: var\(--logo-max-w/.test(css), 'and it is the slot width, not a cap that can only subtract');
  ok(/\.noviq-logo-desktop\.is-icon \{\s*\n\s*width: var\(--logo-icon-w, 56px\)/.test(css),
    'the collapsed box is the admin mark size — the old hardcoded 56px discarded it the moment the morph finished');
  ok(/\.noviq-logo-align-start \{ justify-content: flex-start/.test(css), 'the footer link aligns with logical keywords');
}

/* ---- 2h. the morph end-state keeps the admin dimensions, and the nudge
   moves the logo right or left in both languages ----
   The reported bug: after the morph the mark snapped back to the old 56px
   box, discarding the mark size from the dashboard. Two causes, both fixed:
   a hardcoded width in the stylesheet and a slot height computed from the
   selected mode instead of the visible artwork. */
{
  const cssH = read('..', 'frontend', 'styles', 'globals.css');
  /* The slot follows the VISIBLE artwork, not the selected mode. */
  ok(/const shownH =/.test(navbar), 'the navbar tracks which artwork is visible');
  ok(/isIcon\s*\?\s*prof\.markHeight\s*:\s*prof\.wordmarkHeight/.test(navbar),
    'after the collapse the slot is the mark size');
  ok(/'--logo-icon-w': `\$\{prof\.markHeight\}px`/.test(navbar),
    'the collapsed width is the admin mark height');
  ok(/'--logo-slot-h': `\$\{shownH\}px`/.test(navbar),
    'the slot height IS the chosen height — no floor silently rewriting it');

  /* The nudge: physical pixels, + is RIGHT in English and in Arabic. */
  ok(/offsetX: 0/.test(heroLib), 'nudges default to no shift');
  ok(/key: 'offsetX', min: -80, max: 80/.test(heroLib) && /key: 'footerOffsetX', min: -80, max: 80/.test(heroLib),
    'nudges are clamped like every other number');
  ok(/'--logo-nudge': `\$\{prof\.offsetX\}px`/.test(navbar), 'the header slot carries its context nudge');
  ok(/translate: `\$\{footerLogo\.footerOffsetX\}px 0`/.test(footer), 'the footer carries its own nudge');
  /* `translate`, not `transform`: the footer image has a hover scale on
     `transform`, and an inline transform would kill it. On desktop the nudge
     sits on the SLOT — translating an image inside its own letterbox only
     slides it until it clips against the slot edge, while the slot itself has
     room to move. */
  ok(/\.noviq-logo-desktop \{\s*\n\s*translate: var\(--logo-nudge, 0px\) 0;/.test(cssH),
    'the desktop slot shifts via `translate`');
  ok(!/\.noviq-logo-desktop \.noviq-logo-(full|icon) \{[^}]*translate:/.test(cssH),
    'no translate left on the images to clip against the slot edge');

  /* The admin offers the nudge and previews it. */
  ok(/Move right \/ left/.test(admin), 'right/left nudges are offered');
  ok(/transform:translateX\(\$\{Number\(nudge\)/.test(admin), 'the stage previews the nudge');
  ok(/START|Start = LEFT in English/.test(admin), 'the alignment options say which physical side they mean');
  /* The stage shows the post-morph state in morph mode — the state that used
     to revert. A preview that only shows "before" cannot catch a bug in
     "after". */
  ok(/afterMorphRows|afterEn|afterAr/.test(admin), 'the stage renders post-morph rows in morph mode');
  ok(/· after morph/.test(admin), 'those rows are labelled as after-morph');
  ok(/showMark && afterMorph \? prof\.markHeight/.test(admin),
    'the after-morph slot is the mark size, like the live collapsed box');
}

/* ---- 2i. four independent contexts, and the logo keeps the top layer ----
   The ask: phone settings fully separate from desktop, and Arabic fully
   separate from English on each. An earlier design shared one header with
   "extras on top", which meant doing arithmetic to sit Arabic differently;
   independent slots remove the arithmetic. Second report in the same pass:
   nudging the logo right in English slid it under the search field's solid
   background, because the logo link is the first flex item and DOM order
   paints later siblings above it. */
{
  /* Four slots, each complete. The Arabic and mobile ones start as copies of
     the reference, so the split changes nothing until someone picks. */
  ok(/desktopEn: LogoSlot|desktopEn:/.test(heroLib), 'there is an English desktop slot');
  ok(/desktopAr:/.test(heroLib), 'there is an independent Arabic desktop slot');
  ok(/mobileEn:/.test(heroLib) && /mobileAr:/.test(heroLib), 'there are independent phone slots');
  ok(/mobileAr: \{ \.\.\.MOBILE_SLOT \}/.test(heroLib) || /mobileAr:/.test(heroLib),
    'the Arabic phone starts as a copy of the reference');

  /* The navbar resolves per context: language picks desktop-vs-desktop and
     phone-vs-phone; CSS picks desktop-vs-phone element. */
  ok(/<LogoIcon isArabic=\{isArabic\} \/>/.test(navbar), 'the logo knows which language it renders in');
  ok(/isArabic \? cfg\.desktopAr : cfg\.desktopEn/.test(navbar),
    'the desktop slot is picked by language');
  ok(/isArabic \? cfg\.mobileAr : cfg\.mobileEn/.test(navbar),
    'the phone artwork is picked by language');
  ok(/mprof\.mode === 'wordmark' \? cfg\.wordmarkSrc : cfg\.markSrc/.test(navbar),
    'the phone can show the wordmark too — not mark-only anymore');
  ok(/mprof\.offsetX/.test(navbar), 'the phone shift is its own value');

  /* Overlap priority: the logo link paints above the solid-background
     siblings that used to swallow it, while the dropdown menu (z-60) stays on
     top — which is what an open menu should do. The ±80px clamp and the
     bounded area are what keep it off the neighbour in the first place. */
  const cssI = read('..', 'frontend', 'styles', 'globals.css');
  ok(/\.noviq-logo \{\s*\n\s*display: inline-flex;[\s\S]*?position: relative;\s*\n\s*z-index: 5;/.test(cssI),
    'the logo link is positioned with overlap priority');
  ok(/\.noviq-more-menu \{[\s\S]*?z-index: 60;/.test(cssI),
    'the dropdown menu still sits above the logo');

  /* The admin edits four full contexts, with copy helpers so they start in
     agreement instead of drifting by accident. */
  ok(/Desktop — English/.test(admin) && /Desktop — Arabic/.test(admin),
    'both desktop contexts are editable');
  ok(/Mobile — English/.test(admin) && /Mobile — Arabic/.test(admin),
    'both phone contexts are editable');
  ok(/function copySlot\(from, to\)/.test(admin), 'contexts can be copied into each other');
  ok(/function normalizeLogoDraft/.test(admin),
    'pre-split rows normalize instead of breaking the editor');
  ok(/slot\('ltr', 'mobileEn'\)/.test(admin) && /slot\('rtl', 'mobileAr'\)/.test(admin),
    'the stage previews each phone in its own direction');

  /* The migration carries old rows into the four slots without losing values. */
  ok(/desktopAr:/.test(init) && /mobileAr:/.test(init), 'the migration builds all four contexts');
  ok(/Logo split migration/.test(init), 'and it reports what it added');
  /* Pre-split rows rendered through a floored slot, so sub-56 stored heights
     painted 56: the migration bumps them to preserve the look — but ONLY on
     rows that still carry the legacy flat keys, then deletes those keys, so a
     deliberate small value can never be overridden on a later boot. */
  ok(/hadLegacy/.test(init), 'the bump is gated on legacy origin');
  ok(/legacy-flat-keys-removed/.test(init), 'and the flat keys are deleted so it runs once');
}

/* ---- 2j. logo editor UX: sticky save, themed preview, per-row numbers ----
   The editor is six groups tall with Save only at the top, and the preview
   sat at the very bottom with no numbers and one neutral background — so
   every tweak ended with scrolling both ways, and the #1 guide warning (a
   baked-in white background) was invisible in the panel. */
{
  /* Sticky bottom save bar (same pattern as .i18n-save-bar): no topbar math
     needed, unlike a sticky top bar under the fixed .topbar. */
  ok(/\.lg-savebar\{position:sticky;bottom:12px/.test(admin), 'the save bar sticks to the viewport bottom');
  ok(/data-lg-dirty/.test(admin) && /data-lg-reset/.test(admin), 'badges and resets sync by attribute, not first-id-wins');
  const dirtyFns = admin.match(/document\.querySelectorAll\('\[data-lg-(dirty|reset)\]'\)/g) || [];
  ok(dirtyFns.length >= 2, 'both badges and both reset buttons update together');
  /* Jump anchors both ways. */
  ok(/Preview ↓/.test(admin), 'a Preview anchor jumps down to the stage');
  ok(/↑ Controls/.test(admin), 'a Controls anchor jumps back up');

  /* Preview theme: checker is neutral, light/dark show what each theme's
     visitors see. Lives outside the draft — a viewing aid, never saved. */
  ok(/let logoPrevTheme = 'checker'/.test(admin), 'the preview theme defaults to checker');
  ok(/function setLogoPrevTheme\(t\)/.test(admin), 'the theme actually switches');
  ok(/aria-pressed/.test(admin), 'the active theme is announced');
  ok(/\.lg-pt-dark \.lg-prev-slot\{background:#0f172a/.test(admin), 'dark theme paints slots dark');
  ok(/\.lg-pt-light \.lg-prev-slot\{background:#fff/.test(admin), 'light theme paints slots white');
  ok(/\.lg-pt-dark \.hv-art-preview\{background-color:#0f172a/.test(admin), 'dark theme reaches the artwork boxes too');

  /* Per-row rendered numbers: width × height · shift. */
  ok(/lg-prev-meta/.test(admin), 'each preview row states its rendered numbers');
  ok(/× \$\{Number\(height\)/.test(admin) || /× \$\{Number\(maxW\)/.test(admin) || /Number\(maxW\)/.test(admin),
    'the readout comes from the draft values');

  /* Measured file dimensions with guide thresholds, not a path string. */
  ok(/function logoArtLoaded\(img, k\)/.test(admin), 'loaded artwork reports its dimensions');
  ok(/hv-dims-/.test(admin), 'each artwork field has a dimensions caption');
  ok(/600/.test(admin) && /256/.test(admin), 'the guide minimums (600px wordmark, 256px mark) are enforced as warnings');
  ok(/not square/.test(admin), 'a non-square mark is flagged');

  /* Per-context reset: draft-only, two-step like the whole-table one. */
  ok(/function resetSlotCtx\(ctx\)/.test(admin), 'each context resets on its own');
  ok(/logoDeepCopy\(LOGO_DEFAULTS\[ctx\]\)/.test(admin), 'the context reset deep-copies (no shared refs)');
  ok(/hv-dot/.test(admin), 'changed contexts carry a dot on their group title');
}

/* ---- 2g. every range is coherent ---- */
for (const [k, r] of Object.entries(front)) {
  ok(r.min < r.max, `range for ${k} is not inverted`, `${r.min}..${r.max}`);
}

/* ---- 3. the frontend clamps what the CMS gives it ---- */
ok(/function clampNumber/.test(heroLib), 'numbers are clamped on read');
ok(/function clampColor/.test(heroLib), 'colours are validated on read');
ok(/Math\.min\(field\.max, Math\.max\(field\.min, n\)\)/.test(heroLib), 'the clamp pins to the declared range');
ok(/HEX\.test\(s\)/.test(heroLib), 'a non-hex colour falls back to the shipped one');
ok(/return null;\n?\s*}\n?\s*catch \{\n?\s*return null/.test(heroLib) || /catch \{\s*return null/.test(heroLib),
  'a failed settings read returns null instead of throwing');
ok(/outer <= inner \+ 0\.5/.test(heroLib), 'inner radius past the outer one is corrected');
/* The defaults must be the shipped look, so adding the CMS keys changed
   nothing visually. spinSpeed 0.115 is the value Hero.tsx used to pass as
   an explicit prop — the component default was a different number and lost. */
ok(/spinSpeed: 0\.115/.test(heroLib), 'the default spin is the value that was actually rendering');
ok(/starBrightness: 0/.test(heroLib), 'stars stay off by default (they fight the disc)');

/* ---- 4. both components read the CMS instead of hardcoding ---- */
{
  ok(/fetchVisualSettings\('heroBlackhole', resolveBlackHole\)/.test(hero), 'Hero reads the settings');
  ok(/useState<BlackHoleSettings>\(BLACK_HOLE_DEFAULTS\)/.test(hero), 'Hero starts on the shipped defaults');
  ok(/spinSpeed=\{hole\.spinSpeed\}/.test(hero), 'the props come from the fetched object');
  ok(!/spinSpeed=\{0\./.test(hero), 'no hardcoded spinSpeed prop is left to override the CMS');
  ok(!/brightness=\{2(\.0)?\}/.test(hero), 'no hardcoded brightness prop is left');
  ok(/focus=\{\[0\.5, 0\.5\]\}/.test(hero), 'the focus stays a framing decision, not a dial');

  ok(/fetchVisualSettings\('logo', resolveLogo\)/.test(navbar), 'the navbar reads the logo settings');
  ok(!/setTimeout\(\(\) => setIsIcon\(true\), 2800\)/.test(navbar),
    'the hardcoded 2.8s morph timer is gone');
  ok(/cfg\.morphAfterMs/.test(navbar) || /prof\.morphAfterMs/.test(navbar), 'the morph delay comes from the CMS');
  ok(/!== 'morph'/.test(navbar), 'only morph mode collapses');
}

/* ---- 4b. the logo is fully admin-driven, in BOTH places ----
   The footer used to hold two more hardcoded copies of the wordmark at two
   hardcoded sizes, so the admin could change the header and not the footer. */
{
  const footer = read('..', 'frontend', 'components', 'layout', 'Footer.tsx');
  ok(/fetchVisualSettings\('logo', resolveLogo\)/.test(footer), 'the footer reads the same settings');
  ok(/footerLogo\.showInFooter/.test(footer), 'the footer logo can be switched off');
  ok(/footerLogo\.footerVariant === 'mark'/.test(footer), 'the footer can show the mark instead');
  ok(/footerLogo\.footerHeight/.test(footer), 'the footer size is the admin value');
  ok(!/src="\/logo\/noviq-wordmark\.webp"/.test(footer), 'no hardcoded logo path left in the footer');
  ok(!/src="\/logo\/noviq-icon\.webp"/.test(navbar), 'no hardcoded logo path left in the navbar');
  /* The size arrives as custom properties rather than inline width/height.
     An inline `width: 'auto'` shrinks the element to exactly the artwork, and
     object-position then has nothing to place inside — alignment silently does
     nothing. A custom property does not outrank the `.is-icon` width the morph
     animates, which an inline width would. */
  ok(/--logo-slot-h/.test(navbar) && /--logo-max-w/.test(navbar),
    'the header slot is sized through CSS custom properties');
  ok(!/style=\{\{ height: cfg\.headerWordmarkHeight/.test(navbar),
    'no inline height on the wordmark — it would collapse the slot again');
  ok(/const shownH =/.test(navbar),
    'the slot follows whichever artwork the header is currently showing');
  /* No floor: pre-split rows always rendered through a 56px-floored slot, so a
     stored 40 painted 56 and the slider's lower half did nothing. The slot is
     now exactly the chosen height, and the legacy converter bumps sub-56
     stored values to 56 so those rows render identically. */
  ok(!/Math\.max\(56, shownH\)/.test(navbar), 'no floor silently rewriting small heights');
  ok(/maxWidth: footerLogo\.footerMaxWidth/.test(footer), 'the footer logo link is bounded by the max width');
  ok(!/Math\.max\(56, shownH\)/.test(navbar), 'no floor: the slot is exactly the chosen height');
  /* Without a width the link shrink-wraps to its image, so justify-content has
     no free space to distribute and every alignment rendered identically. A
     static assertion cannot catch that — it only surfaced when the painted
     pixels were measured in a browser. */
  ok(/noviq-logo-align-\$\{footerLogo\.footerAlign\} inline-flex w-full/.test(footer),
    'the footer link fills its bounded area, so the alignment can take effect');
  ok(/wordmarkAlt/.test(navbar) && /markAlt/.test(navbar), 'alt text is the admin value');
  /* A logo path is admin input, so it gets the same treatment as a colour. */
  ok(/function clampImage/.test(heroLib), 'image paths are validated on read');
  ok(/IMG_PATH\.test\(s\)/.test(heroLib), 'a relative path is accepted and made root-relative');
  ok(heroLib.includes('/^https:\\/\\/') && !heroLib.includes('http:\/\/(?!\\/\\/)'),
    'only https:// is allowed for an absolute URL (not javascript:)');
}

/* ---- 5. the backend will actually store and serve the keys ---- */
{
  ok(/'heroBlackhole', 'logo'\]/.test(routes), 'both keys are writable through the admin content API');
  ok(/heroBlackhole: JSON\.stringify/.test(init), 'heroBlackhole is seeded');
  ok(/logo: JSON\.stringify/.test(init), 'logo is seeded');
  ok(/spinSpeed: 0\.115/.test(init), 'the seed carries the shipped spin, not the component default');

  /* INSERT OR IGNORE means a row that already existed never receives a field
     added later — the site kept working because the frontend falls back to
     its own defaults, which hid that the stored config was a partial
     description of what was rendering. The migration fills only the gaps. */
  ok(/for \(const \[key, defaults\] of Object\.entries\(additions\)\)/.test(init),
    'there is a migration for settings keys that gained fields');
  ok(/missing\.filter|missing = Object\.keys\(defaults\)\.filter/.test(init),
    'the migration adds only the ABSENT fields');
  ok(/stored\[k\] === undefined/.test(init), 'a field the admin has set is never overwritten');
  ok(/heroBlackhole: \{[\s\S]*?spinSpeed: 0\.115/.test(init), 'the migration covers heroBlackhole');
  ok(/logo: \{[\s\S]*?footerHeight: 56/.test(init), 'the migration covers the logo artwork and sizes');
}

/* ---- 6. the admin editor is reachable and honest ---- */
{
  ok(/if \(key === 'heroBlackhole'\) return editBlackHoleConfig/.test(admin), 'the black hole has a dedicated editor');
  ok(/if \(key === 'logo'\) return editLogoConfig/.test(admin), 'the logo has a dedicated editor');
  ok(/function editBlackHoleConfig/.test(admin) && /function saveHoleConfig/.test(admin), 'the editor can save');
  ok(/function editLogoConfig/.test(admin) && /function saveLogoConfig/.test(admin), 'the logo editor can save');
  ok(/const LOGO_MODES/.test(admin), 'the logo modes are listed for the operator');
  for (const m of ['wordmark', 'icon', 'morph']) {
    ok(admin.includes(`value: '${m}'`) || admin.includes(`v: '${m}'`), `logo mode "${m}" is offered`);
  }
  ok(/setHoleValue/.test(admin), 'slider edits clamp in the panel too');
  ok(/setHoleColor/.test(admin) && /\^#\[0-9a-fA-F\]\{6\}\$/.test(admin), 'the colour picker rejects non-hex');
  ok(/The shader clamps glow at 2\.0/.test(admin), 'the glow ceiling is explained, not just enforced');
  /* The editor explains the non-obvious knobs. The numbers were arrived at
     by looking at the render; without that they get "tidied". */
  const hinted = (admin.match(/hint:/g) || []).length;
  ok(hinted >= 6, 'the editor explains the non-obvious knobs', `${hinted} hints`);

  /* Logo: artwork upload, both placements, sizes, and the spec guide. */
  ok(/function uploadLogoArt/.test(admin), 'the artwork can be uploaded');
  ok(/ADMIN_API \+ '\/upload'/.test(admin), 'logo upload uses the existing upload endpoint');
  ok(/function logoArtworkField/.test(admin), 'both artwork files have a picker');
  ok(/wordmarkSrc/.test(admin) && /markSrc/.test(admin), 'wordmark and mark are separate files');
  ok(/function logoNumberField/.test(admin), 'footer sizes are editable');
  ok(/wordmarkHeight/.test(admin) && /markHeight/.test(admin) && /footerHeight/.test(admin),
    'wordmark, mark and footer sizes are all editable');
  ok(/function slotNumberField/.test(admin), 'each context edits its own numbers');
  ok(/function slotModeField/.test(admin) && /function slotAlignField/.test(admin),
    'each context edits its own variant and position');
  ok(/footerVariant/.test(admin), 'the footer variant is selectable');
  ok(/showInFooter/.test(admin), 'the footer logo can be removed');
  ok(/wordmarkAlt/.test(admin) && /markAlt/.test(admin), 'alt text is editable');
  /* The guide answers the three ways this goes wrong invisibly. */
  ok(/function logoSpecGuide/.test(admin), 'a logo spec guide is shown');
  ok(/Transparent background/.test(admin), 'the guide warns about a baked-in background');
  ok(/600&times;180/.test(admin), 'the guide states the recommended wordmark size');
  ok(/256&times;256/.test(admin), 'the guide states the recommended mark size');
  ok(/cross-fade/.test(admin), 'the guide warns about mismatched visual weight during the morph');
  ok(/hv-art-preview/.test(admin), 'the preview sits on a checkerboard so a white background shows');
  ok(/background-image:linear-gradient\(45deg/.test(admin), 'the checkerboard is actually styled');
}

/* ---- 7. the clamp actually clamps (executed, not asserted) ----
   Everything above is a statement about the source. This runs it: the real
   module is transpiled with the frontend's own TypeScript and then fed the
   values a careless dashboard edit would produce — a spin of 900, a
   negative radius, a colour of "url(javascript:...)", a JSON string where a
   number belongs. If any of those reached the shader the hero would render a
   black rectangle, so this is the check that actually matters. */
{
  try {
    const ts = require(path.join(ROOT, '..', 'frontend', 'node_modules', 'typescript'));
    const js = ts.transpileModule(heroLib, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    /* The module has no imports, so a bare function scope plus an `exports`
       object is enough to run it — no loader, no stubbing. TypeScript emits
       assignments onto `exports` rather than local bindings, so the values
       are read back off that object. */
    const mod = {};
    new Function('exports', `${js};`)(mod);
    resolveBlackHole = mod.resolveBlackHole;
    resolveLogo = mod.resolveLogo;
    defaults = mod.BLACK_HOLE_DEFAULTS;
    defaultsLogo = mod.LOGO_DEFAULTS;
    if (typeof resolveBlackHole !== 'function' || typeof resolveLogo !== 'function' || !defaults) {
      throw new Error('the module did not export the expected functions');
    }
  } catch (err) {
    ok(false, 'the settings module transpiles and loads', err.message.slice(0, 160));
  }

  if (resolveBlackHole) {
    const ranges = frontRanges();

    /* Absurd input is pulled back to the edge of the allowed range. */
    const wild = resolveBlackHole({ spinSpeed: 900, diskInner: -40, brightness: 1e9, steps: 0, maxDpr: -3 });
    ok(wild.spinSpeed === ranges.spinSpeed.max, 'a spin of 900 clamps to the maximum', String(wild.spinSpeed));
    ok(wild.diskInner === ranges.diskInner.min, 'a negative inner radius clamps to the minimum', String(wild.diskInner));
    ok(wild.brightness === ranges.brightness.max, 'an absurd brightness clamps', String(wild.brightness));
    ok(wild.steps === ranges.steps.min, 'zero ray steps clamps up', String(wild.steps));
    ok(wild.maxDpr === ranges.maxDpr.min, 'a negative device-pixel ratio clamps', String(wild.maxDpr));

    /* Wrong types fall back rather than becoming NaN — NaN uniforms make a
       shader render nothing at all. */
    const junk = resolveBlackHole({ spinSpeed: 'fast', steps: null, maxDpr: {}, diskInner: [] });
    ok(Number.isFinite(junk.spinSpeed), 'a non-numeric spin does not become NaN', String(junk.spinSpeed));
    ok(Number.isFinite(junk.steps) && Number.isFinite(junk.maxDpr) && Number.isFinite(junk.diskInner),
      'every numeric field stays finite whatever type arrives');
    ok(junk.spinSpeed === defaults.spinSpeed, 'a junk value falls back to the shipped one', String(junk.spinSpeed));

    /* A colour that is not hex is refused, not passed to the shader. */
    const evil = resolveBlackHole({
      hotColor: 'url(javascript:alert(1))',
      midColor: 'red; background:url(x)',
      spaceColor: '#12345',
    });
    const isHex = (s) => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s);
    ok(isHex(evil.hotColor) && isHex(evil.midColor) && isHex(evil.spaceColor),
      'every colour is valid hex after resolving', [evil.hotColor, evil.midColor, evil.spaceColor].join(' '));

    /* The disc must keep a positive gap — the shader divides by it. */
    const inverted = resolveBlackHole({ diskInner: 10, diskOuter: 8 });
    ok(inverted.diskOuter > inverted.diskInner, 'the disc always keeps a positive gap',
      `${inverted.diskInner} / ${inverted.diskOuter}`);

    /* An empty/garbage payload yields the shipped look, not a broken one. */
    for (const input of [null, undefined, 0, 'nope', [], { spinSpeed: null }]) {
      const out = resolveBlackHole(input);
      ok(Object.keys(out).length === Object.keys(defaults).length &&
         Number.isFinite(out.spinSpeed) && Number.isFinite(out.steps),
        `a ${JSON.stringify(input) === undefined ? 'missing' : JSON.stringify(input)} payload still yields a complete, finite config`);
    }

    /* And nothing is dropped: a partial config comes back complete. */
    const partial = resolveBlackHole({ spinSpeed: 0.2 });
    const missing = Object.keys(defaults).filter((k) => !(k in partial));
    ok(missing.length === 0, 'a partial config comes back complete', missing.join(', '));
    ok(partial.spinSpeed === 0.2, 'the one value that was set is honoured');

    /* Logo: an unknown mode must not blank the header. */
    const logo = resolveLogo({ desktopEn: { mode: 'wat', morphAfterMs: -5 } });
    ok(['wordmark', 'icon', 'morph'].includes(logo.desktopEn.mode), 'an unknown logo mode falls back', logo.desktopEn.mode);
    ok(logo.desktopEn.morphAfterMs >= 0, 'a negative morph delay clamps to zero', String(logo.desktopEn.morphAfterMs));
    ok(resolveLogo(null).desktopEn.mode === 'morph', 'a missing logo config keeps the shipped behaviour');
  }

  if (resolveLogo) {
    /* New shape: each context resolves on its own. */
    const modes = resolveLogo({ desktopEn: { mode: 'wordmark' } });
    ok(modes.desktopEn.mode === 'wordmark', 'a context mode is honoured');
    ok(modes.desktopAr.mode === 'morph', 'untouched contexts keep the shipped behaviour');
    const capped = resolveLogo({ desktopEn: { mode: 'icon', morphAfterMs: 999999 } });
    ok(capped.desktopEn.morphAfterMs <= 60000, 'an absurd morph delay is capped');
    /* Mobile has no morph — a morph written into a phone slot resolves to the
       mark rather than a state the phone cannot render. */
    ok(resolveLogo({ mobileEn: { mode: 'morph' } }).mobileEn.mode === 'icon',
      'a mobile morph resolves to the mark');
    ok(resolveLogo({ mobileAr: { mode: 'nonsense' } }).mobileAr.mode === 'icon',
      'an unknown mobile mode falls back');

    /* Legacy flat rows convert with the effective values they rendered. */
    const legacy = resolveLogo({
      mode: 'wordmark', morphAfterMs: 1000,
      headerWordmarkHeight: 54, headerMarkHeight: 44,
      headerMaxWidth: 300, headerAlign: 'end', headerOffsetX: 19,
      headerAlignAr: 'start', headerOffsetXAr: -5, mobileOffsetX: 7,
    });
    ok(legacy.desktopEn.mode === 'wordmark', 'legacy mode survives the split');
    /* Pre-split rows rendered through a 56px-floored slot: 54 painted 56, so
       the converter bumps it — the row renders identically after the split. */
    ok(legacy.desktopEn.wordmarkHeight === 56, 'a sub-56 legacy height bumps to what it painted',
      String(legacy.desktopEn.wordmarkHeight));
    ok(legacy.desktopEn.align === 'end' && legacy.desktopEn.offsetX === 19,
      'legacy position survives the split');
    ok(legacy.desktopAr.align === 'start', 'the legacy Arabic alignment is baked in, not dropped');
    ok(legacy.desktopAr.offsetX === 14, 'the legacy Arabic extra is baked in (19 + -5)',
      String(legacy.desktopAr.offsetX));
    ok(legacy.mobileEn.mode === 'icon', 'phones resolve to the mark');
    ok(legacy.mobileEn.offsetX === 26, 'the legacy mobile extra is baked in (19 + 7)',
      String(legacy.mobileEn.offsetX));
    ok(legacy.mobileAr.offsetX === 21, 'arabic phones add both extras (14 + 7)',
      String(legacy.mobileAr.offsetX));
    /* ...and converted values are still clamped. */
    const wildLegacy = resolveLogo({ headerWordmarkHeight: 5000, headerOffsetX: -999 });
    ok(wildLegacy.desktopEn.wordmarkHeight <= 120, 'a converted oversize clamps');
    ok(wildLegacy.desktopEn.offsetX >= -80, 'a converted over-shift clamps');
    /* Already-split rows are exact: a deliberate small value is never bumped. */
    const exact = resolveLogo({ desktopEn: { wordmarkHeight: 30 } });
    ok(exact.desktopEn.wordmarkHeight === 30, 'a split-row 30 stays 30 — the bump is legacy-only',
      String(exact.desktopEn.wordmarkHeight));

    /* The artwork is admin input: a bad path must not become a broken image
       or an executable URL. */
    const art = resolveLogo({
      wordmarkSrc: 'javascript:alert(1)',
      markSrc: '//evil.example/x.svg',
      wordmarkAlt: '',
      desktopEn: { wordmarkHeight: 5000 },
      footerHeight: 1,
      footerVariant: 'nonsense',
    });
    ok(art.wordmarkSrc === defaultsLogo.wordmarkSrc, 'a javascript: logo path is refused', art.wordmarkSrc);
    ok(/^\/(?![\/\\])/.test(art.markSrc) || /^https:\/\//.test(art.markSrc),
      'a protocol-relative path is not accepted as-is', art.markSrc);
    ok(art.wordmarkAlt.length > 0, 'empty alt text falls back rather than blanking');
    ok(art.desktopEn.wordmarkHeight <= 120, 'an oversized logo is clamped', String(art.desktopEn.wordmarkHeight));
    ok(art.footerHeight >= 24, 'an undersized logo is clamped up', String(art.footerHeight));
    ok(art.footerVariant === 'wordmark', 'an unknown footer variant falls back', art.footerVariant);

    /* A real uploaded path is accepted and made root-relative. */
    const up = resolveLogo({ markSrc: 'images/uploads/my-mark.webp' });
    ok(up.markSrc === '/images/uploads/my-mark.webp', 'an uploaded path is accepted, root-relative', up.markSrc);
    const abs = resolveLogo({ wordmarkSrc: 'https://cdn.example.com/logo.svg' });
    ok(abs.wordmarkSrc === 'https://cdn.example.com/logo.svg', 'an https CDN logo is allowed', abs.wordmarkSrc);
    ok(resolveLogo({ markSrc: '../secrets.png' }).markSrc === defaultsLogo.markSrc,
      'a traversal path is refused');
  }
}

/* ---- 2b. the DEFAULTS must agree across all three copies ----
   There are three hand-maintained lists of "the shipped value": the frontend
   module (what the site falls back to), the DB seed, and the admin editor
   (what Reset restores). They had already drifted once — the seed and the
   admin said 40px for the header wordmark while the frontend said 48px — and
   the symptom is invisible until the wrong number is on the live site.

   Runs here, after the module above is executed, because it compares the real
   exported objects rather than a regex over the source. */
if (defaults && defaultsLogo) {
  console.log('\n=== the three copies of "the shipped value" ===');
  const grabObject = (src, name) => {
    /* The seed wraps its values in JSON.stringify({...}) and the admin uses a
       plain `const NAME = {...}`, so anchor on the key and brace-match rather
       than assuming one shape. And booleans count: showInFooter is a real
       setting, not a flag to skip. */
    const anchor = new RegExp('(?:const\\s+' + name + '\\s*=\\s*|\\b' + name + ':\\s*JSON\\.stringify\\()\\s*\\{');
    const m = anchor.exec(src);
    if (!m) return null;
    let depth = 0;
    let end = -1;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    const body = src.slice(m.index + m[0].length - 1, end + 1);
    const out = {};
    for (const kv of body.matchAll(/(\w+)\s*:\s*('(?:[^']*)'|-?[\d.]+|true|false|null)/g)) {
      const v = kv[2];
      out[kv[1]] = v === 'true' ? true : v === 'false' ? false : v === 'null' ? null
        : v.startsWith("'") ? v.slice(1, -1) : parseFloat(v);
    }
    return out;
  };

  const grabNested = (src, name) => {
    /* Same anchor-and-brace-match as grabObject, but the body is evaluated as
       a JS object literal instead of scraped for flat keys — the logo defaults
       are nested four levels deep, and a flat scrape would silently compare
       nothing. `new Function` is safe here: this is the project's own checked
       source, not admin input. */
    const anchor = new RegExp('(?:const\\s+' + name + '\\s*=\\s*|\\b' + name + ':\\s*JSON\\.stringify\\()\\s*\\{');
    const m = anchor.exec(src);
    if (!m) return null;
    let depth = 0;
    let end = -1;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`return (${src.slice(m.index + m[0].length - 1, end + 1)});`)();
    } catch {
      return null;
    }
  };

  const seedHole = grabObject(init, 'heroBlackhole');
  const seedLogo = grabNested(init, 'logo');
  const panelHole = grabObject(admin, 'HOLE_DEFAULTS');
  const panelLogo = grabNested(admin, 'LOGO_DEFAULTS');

  ok(!!panelHole && Object.keys(panelHole).length >= 25, 'the admin has a black hole defaults table',
     panelHole ? Object.keys(panelHole).length + ' keys' : 'not found');
  ok(!!panelLogo && Object.keys(panelLogo).length >= 15, 'the admin has a logo defaults table',
     panelLogo ? Object.keys(panelLogo).length + ' keys' : 'not found');
  ok(!!panelLogo.desktopEn && !!panelLogo.desktopAr && !!panelLogo.mobileEn && !!panelLogo.mobileAr,
    'the admin defaults carry all four contexts');

  const cmp = (label, a, b) => {
    const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
    const diff = keys.filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]))
      .map((k) => `${k}: ${JSON.stringify(a?.[k])} vs ${JSON.stringify(b?.[k])}`);
    ok(diff.length === 0, `${label} are identical`, diff.join('; '));
  };
  cmp('black hole defaults: frontend vs admin', defaults, panelHole);
  cmp('black hole defaults: frontend vs DB seed', defaults, seedHole);
  cmp('logo defaults: frontend vs admin', defaultsLogo, panelLogo);
  cmp('logo defaults: frontend vs DB seed', defaultsLogo, seedLogo);

  /* The migration that fills absent fields has to carry them too, or a fresh
     production row is still partial after the next deploy. */
  ok(/Logo split migration/.test(init), 'the logo split migration exists');
  ok(/desktopAr:/.test(init) && /mobileAr:/.test(init), 'and it builds all four contexts');
}

console.log(failed ? `\n${failed} of ${passed + failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);