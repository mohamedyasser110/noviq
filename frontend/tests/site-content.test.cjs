/* ============================================================
   NOVIQ — site content surface: industries, pricing, solutions,
   updates paging, nav placement
   ------------------------------------------------------------
   Static assertions over files (no browser): every item here broke
   silently once — a dead CTA button, prices outside the band the admin
   promised, monthly costs shown as yearly, an unpaged feed, nav items
   the admin cannot place. Run: npm run test:site-content
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const industries = read('components', 'sections', 'Industries.tsx');
const pricingPage = read('app', '[locale]', 'pricing', 'page.tsx');
const pricingLib = read('lib', 'pricing-content.ts');
const solutionsPage = read('app', '[locale]', 'solutions', 'page.tsx');
const account = read('app', '[locale]', 'account', 'page.tsx');
const navbar = read('components', 'layout', 'Navbar.tsx');
const adminHtml = read('..', 'backend', 'admin', 'index.html');
const globalsCss = () => read('styles', 'globals.css');
const pricingPageSrc = () => read('app', '[locale]', 'pricing', 'page.tsx');
const solutionsPageSrc = () => read('app', '[locale]', 'solutions', 'page.tsx');

/* Recursively list the .tsx files under a directory. Used to sweep the
   whole site for CTAs that still bypass the shared contact chooser. */
function walk(dir) {
  const out = [];
  const visit = (d) => {
    for (const entry of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const rel = path.join(d, entry.name);
      if (entry.isDirectory()) visit(rel);
      else if (entry.name.endsWith('.tsx')) out.push(rel);
    }
  };
  visit(dir);
  return out;
}

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. industries cards: elevated, not flat boxes ---- */
ok(/group-hover:bg-primary/.test(industries), 'icon chip fills on hover');
ok(/String\(i \+ 1\)/.test(industries), 'cards carry an index number');
ok(/rounded-2xl/.test(industries), 'cards use the 2xl radius (was lg)');

/* Scroll-in stagger for the industry cards, in order — one reveal path for
   desktop and mobile.
   The subtle part: motion leaves an inline `transform` behind, which
   outranks the stylesheet, so a CSS hover translate would stop lifting the
   card the moment the reveal finished. The hover has to be expressed through
   the same motion value — which is why there is deliberately NO
   `hover:-translate` class on the card. */
ok(/motion\.article/.test(industries), 'cards are motion components');
ok(/whileInView=\{\{ opacity: 1, y: 0, scale: 1 \}\}/.test(industries), 'cards reveal on scroll into view');
ok(/whileHover=\{reduced \? undefined : \{ y: -6, scale: 1\.03 \}\}/.test(industries),
  'the hover lift is owned by motion, not the stylesheet');
ok(!/hover:-translate/.test(industries),
  'no stylesheet translate anywhere on the card to be overridden by the inline transform');
ok(/viewport=\{\{ once: true/.test(industries), 'the reveal plays once, not on every pass');
ok(/delay: reduced \? 0 : i \* STAGGER_MS/.test(industries), 'the delay is per-card index (staggered in order)');
ok(/const STAGGER_MS = 0\.1/.test(industries), 'the stagger step is a named constant');

/* Scroll-driven hover wave: on scroll into view each card holds the full
   hover look in turn, in order — desktop and mobile alike (phones never
   hover, so without this they never see the effect). Runs once like the
   reveal; the mouse keeps working normally throughout. */
ok(/WAVE_STEP_MS|industry-hot/.test(industries), 'a hover wave exists');
ok(/querySelectorAll\('\.industry-card'\)/.test(industries), 'the wave addresses the cards in DOM order');
ok(/classList\.add\('industry-hot'\)/.test(industries), 'each card lights in turn');
ok(/classList\.remove\('industry-hot'\)/.test(industries), 'each card releases after its hold');
ok(/WAVE_HOLD_MS/.test(industries), 'the hold time is a named constant, not a magic number');
ok(/io\.disconnect\(\)/.test(industries), 'the wave observer disconnects after firing once');
ok(/timers\.forEach\(clearTimeout\)/.test(industries), 'pending wave timers clean up on unmount');
ok(/if \(reduced\) return/.test(industries), 'reduced-motion visitors get no wave');
/* The wave styling mirrors every group-hover rule — utilities only match
   while hovering, so these win by specificity whenever the class is on. */
{
  const css = read('styles', 'globals.css');
  ok(/\.industry-card\.industry-hot\s*\{/.test(css), 'the hot state styles the card');
  ok(/\.industry-card\.industry-hot > span\[class\*="inset-0"\]/.test(css), 'the gradient sweep lights');
  ok(/\.industry-card\.industry-hot > span\[class\*="inset-x-6"\]/.test(css), 'the accent lines draw');
  ok(/\.industry-card\.industry-hot \.industry-icon-wrap \{/.test(css), 'the icon chip fills');
  ok(/\.industry-card\.industry-hot \.industry-icon-wrap svg/.test(css), 'the glyph scales');
  ok(/\.industry-card\.industry-hot h3/.test(css), 'the title takes the brand color');
  ok(!/\.industry-card\.industry-hot[^{]*\{[^}]*!important/.test(css), 'no !important — specificity already wins');
}
ok(/useReducedMotion\(\)/.test(industries) && /initial=\{reduced \? false :/.test(industries),
  'reduced-motion visitors get the cards immediately, with no stagger');

/* ---- 2. pricing: working CTAs, $150-$250 band ---- */
ok(!/<button[^>]*>\s*\{plan\.cta\}/.test(pricingPage), 'no dead CTA button remains');
/* The plan CTA is a ContactCta now, not a plain link — the assertion follows
   the architecture so it keeps testing the same promise: every plan leads
   somewhere the visitor can act on. */
ok(/<ContactCta[\s\S]*?\{plan\.cta\}/.test(pricingPage), 'every plan CTA opens the contact chooser');
const seedPrices = [...pricingLib.matchAll(/price:\s*\{\s*en:\s*'([^']+)'/g)].map((m) => m[1]);
ok(seedPrices.length === 3, `seed ships 3 plans (got ${seedPrices.length})`);
ok(seedPrices.every((p) => /^\$\d+$/.test(p)), 'all seed prices are fixed dollars (no Custom)', seedPrices.join(','));
ok(
  seedPrices.every((p) => { const n = Number(p.slice(1)); return n >= 150 && n <= 250; }),
  'seed plans sit in the $150-$250 band',
  seedPrices.join(',')
);
ok(/professional/.test(pricingLib) && /popular:\s*true/.test(pricingLib), 'a popular plan still exists');

/* ---- 3. solutions bill yearly ---- */
const fallbackPrices = [...solutionsPage.matchAll(/price:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
ok(fallbackPrices.length >= 12, `fallbacks carry prices (EN+AR, got ${fallbackPrices.length})`);
ok(fallbackPrices.every((p) => /\/year$/.test(p) || /\/سنة$/.test(p)), 'every fallback price is yearly', fallbackPrices.join(','));
ok(!/\/mo['"]/.test(solutionsPage), 'no monthly suffix remains on the solutions page');

/* ---- 4. updates feed pages with show more/less ---- */
ok(/updatesShown/.test(account), 'feed pages through updatesShown state');
ok(/setUpdatesShown\(\(c\) => c \+ 5\)/.test(account), 'show more reveals 5 at a time');
ok(/showMore|Show more|عرض المزيد/.test(account), 'show-more control exists');
ok(/showLess|Show less|عرض أقل/.test(account), 'list collapses back with show-less');
ok(/setUpdatesShown\(5\)/.test(account), 'filter change resets paging');

/* ---- 5. nav placement: admin bar / MORE / hidden ---- */
ok(/pagePlacement/.test(navbar), 'Navbar reads per-page placement');
ok(/placementOf|pagePlacement\[i\.key\]/.test(navbar), 'placement consulted per item');
ok(/isBarPlaced|=== 'bar'/.test(navbar) && /isMorePlaced|=== 'more'/.test(navbar), 'both directions supported (MORE→bar, primary→MORE)');
ok(/setPagePlacement/.test(adminHtml), 'admin Pages editor writes placement');
ok(/Header bar/.test(adminHtml) && /MORE menu/.test(adminHtml), 'editor offers bar vs MORE');

/* ---- 6. mobile dashboard: compact stats, full-width actions, zero-space fab ---- */
const navbarSrc = read('components', 'layout', 'Navbar.tsx');
ok(/DashboardFab/.test(navbarSrc), 'mobile dashboard shortcut component exists');
/* Fixed-position inside <nav> would pin to the header: the navbar's
   backdrop-filter makes it a containing block for fixed descendants. */
{
  const ret = navbarSrc.slice(navbarSrc.indexOf('id="navbar"'));
  ok(ret.indexOf('</nav>') !== -1 && ret.indexOf('</nav>') < ret.indexOf('<DashboardFab'),
    'shortcut renders as a sibling of <nav>, never inside it');
}
ok(/!user\) return null/.test(navbarSrc) || /loading \|\| !user/.test(navbarSrc), 'shortcut renders for signed-in visitors only');
ok(/\.noviq-dash-fab\s*\{[^}]*position:\s*fixed/.test(globalsCss()), 'shortcut is fixed (zero layout space)');
ok(/max-width:\s*1023px\)\s*\{[^}]*\.noviq-dash-fab\s*\{\s*display:\s*inline-flex/.test(globalsCss()), 'shortcut shows on phones only');
ok(!/\.noviq-logout-btn\s*\{/.test(globalsCss()), 'dead logout-button CSS removed with the button');
ok(/tabular-nums/.test(account), 'stat numbers use tabular figures (no jitter)');
ok(/grid w-full grid-cols-2/.test(account), 'header actions sit in a two-column grid on phones');
ok(/w-full sm:w-auto/.test(account), 'each action fills its grid cell, auto width on desktop');

/* ---- 7. display currency on every priced surface ---- */
const currencyLib = read('lib', 'currency.ts');
const currencyUi = read('components', 'pricing', 'currency.tsx');
for (const code of ['USD', 'EUR', 'EGP']) {
  ok(new RegExp(`code:\\s*'${code}'`).test(currencyLib), `currency ${code} supported`);
}
ok(/convertUsd|parseUsd/.test(currencyLib), 'conversion + parsing helpers exist');
ok(/export function CurrencySwitcher/.test(currencyUi), 'CurrencySwitcher exists');
ok(/export function Price/.test(currencyUi), 'Price display component exists');
ok(/CurrencySwitcher/.test(pricingPageSrc()) && /CurrencySwitcher/.test(solutionsPageSrc()), 'switcher mounted on pricing + solutions');
ok(/<Price/.test(pricingPageSrc()) && /<Price/.test(solutionsPageSrc()), 'both pages render through Price');

/* ---- 8. the ONE contact chooser, used by every CTA ---- */
{
  const solPage = solutionsPageSrc();
  const cta = read('components', 'contact', 'ContactCta.tsx');
  ok(/Negotiable/.test(solPage), 'price carries the Negotiable note');
  ok(/قابل للتفاوض/.test(solPage), 'Arabic negotiable note present');
  ok(/ContactCta/.test(solPage), 'solutions page renders the chooser');
  ok(/Request a project|طلب مشروع/.test(cta), 'chooser offers a project request');
  ok(/\/signup/.test(cta) && /\/login/.test(cta), 'visitors are routed to register/sign-in');
  ok(/account#project-requests/.test(cta), 'signed-in clients land on the request form');
  ok(/useAuth/.test(cta), 'chooser branches on session state');
  ok(/id="project-requests"/.test(read('app', '[locale]', 'account', 'page.tsx')), 'account exposes the requests anchor');

  /* EVERY button that leads to contact must open the chooser, otherwise the
     behaviour is inconsistent: some project-sized CTAs still lose the visitor
     in a generic form. This walks the whole app tree, so a new page with a
     plain /contact link fails the build rather than shipping the old flow. */
  const offenders = [];
  const walked = walk('app').concat(walk('components'));
  for (const f of walked) {
    const src = fs.readFileSync(f, 'utf8');
    /* A real link to contact: href to /contact, in JSX or in an href string. */
    const direct = src.match(/href=\{?\s*[`'"]\/(\$\{locale\})?contact[`'"]/g);
    if (direct) offenders.push(`${path.relative(ROOT, f)} (${direct.length})`);
  }
  ok(offenders.length === 0, 'no CTA links straight to contact any more', offenders.join(', '));

  const ctaSites = walked.filter((f) => /<ContactCta[\s>]/.test(fs.readFileSync(f, 'utf8')));
  ok(ctaSites.length >= 14, 'the chooser is wired across the site', `${ctaSites.length} files`);
  /* A chooser trigger with no className renders as a naked browser button —
     the codemod that introduced these dropped 10 string classNames once. */
  const bareTriggers = ctaSites.filter((f) =>
    /<ContactCta\s+locale=\{locale\}\s*>/.test(fs.readFileSync(f, 'utf8'))
  );
  ok(bareTriggers.length === 0, 'every chooser trigger keeps its styling', bareTriggers.map((f) => path.relative(ROOT, f)).join(', '));
}

/* ---- 9. portfolio result chips come from the CMS ----
   The pills (4M+ Daily Txns / Zero Downtime / PCI DSS Compliant) are one
   comma-separated admin field, `results`, with an Arabic sibling. They used
   to be hardcoded in the page, so editing them in the admin did nothing. */
{
  const portfolio = read('app', '[locale]', 'portfolio', 'page.tsx');
  ok(/str\(p\.results\)/.test(portfolio), 'chips read the CMS `results` field');
  ok(/str\(p\.resultsAr\)/.test(portfolio), 'Arabic page reads the `resultsAr` sibling');
  ok(/\.split\(','\)/.test(portfolio), 'one comma-separated field becomes one chip per part');
  ok(/project\.results\.map/.test(portfolio), 'chips render from the fetched value');
  ok(/ContactCta[\s\S]*?\{viewCaseStudy\}/.test(portfolio), '"View Case Study" opens the contact chooser');
  ok(/subject=\{project\.title\}/.test(portfolio), 'the chooser names the project');
}

/* ---- 9c. the project link is the third dead field, now wired ----
   `link` sat in the Projects model with an editable box and no reader — same
   shape as challenge/solution before them. It renders as a SECONDARY external
   link beside the chooser CTA (which stays primary), only when an admin
   pasted one, and only for https:// URLs. */
{
  const portfolio = read('app', '[locale]', 'portfolio', 'page.tsx');
  const en = read('i18n', 'en.json');
  const ar = read('i18n', 'ar.json');
  ok(/link: \/\^https:/.test(portfolio), 'the link is accepted only over https');
  ok(/project\.link \? \(/.test(portfolio), 'the link renders only when set — empty cards are byte-identical');
  ok(/target="_blank"/.test(portfolio) && /rel="noopener noreferrer"/.test(portfolio),
    'external links open safely in a new tab');
  ok(/\{liveProjectLabel\}/.test(portfolio), 'the label is dictionary-driven like the other card copy');
  ok(/"liveProject": "Live project"/.test(en) && /"liveProject": "المشروع المباشر"/.test(ar),
    'the label exists in both dictionaries');
  ok(/ContactCta[\s\S]{0,400}\{viewCaseStudy\}[\s\S]*?\{liveProjectLabel\}/.test(portfolio),
    'the chooser CTA still comes first — the link is secondary, not a replacement');
}

/* ---- 9b. the case study fields are no longer dead admin fields ----
   `challenge`, `solution`, `challengeAr` and `solutionAr` have been in the
   Projects content model with Arabic variants from the start, and the admin
   has always let you type into them — but the card read none of them. Every
   shipped project had them empty, so the fields looked plausible and did
   nothing. A dead admin field is worse than a missing one: it accepts input
   and silently discards it. */
{
  const portfolio = read('app', '[locale]', 'portfolio', 'page.tsx');
  const en = read('i18n', 'en.json');
  const ar = read('i18n', 'ar.json');

  ok(/str\(p\.challenge\)/.test(portfolio), 'the challenge reads the CMS field');
  ok(/str\(p\.solution\)/.test(portfolio), 'the solution reads the CMS field');
  ok(/str\(p\.challengeAr\)/.test(portfolio), 'the Arabic page reads the `challengeAr` sibling');
  ok(/str\(p\.solutionAr\)/.test(portfolio), 'the Arabic page reads the `solutionAr` sibling');
  ok(/\n\s*challenge,\n/.test(portfolio) && /\n\s*solution,\n/.test(portfolio),
    'both reach the Project the card renders');
  ok(/\{project\.challenge \|\| project\.solution \?/.test(portfolio),
    'the block is conditional, so an empty field leaves the card exactly as it was');
  ok(/\{project\.challenge\}/.test(portfolio) && /\{project\.solution\}/.test(portfolio),
    'the card renders the text it fetched');

  /* Arabic reads the sibling and falls back; it must never borrow the English
     label, and the accent has to follow the reading direction. */
  ok(/'portfolio\.challenge'/.test(portfolio) && /'portfolio\.solution'/.test(portfolio),
    'the two labels are dictionary-driven like the CTA');
  ok(/"challenge": "Challenge"/.test(en) && /"solution": "Solution"/.test(en),
    'the English labels exist');
  ok(/"challenge": "التحدي"/.test(ar) && /"solution": "الحل"/.test(ar),
    'the Arabic labels exist');
  ok(/border-s-2/.test(portfolio) && /ps-3/.test(portfolio),
    'the accent uses logical properties, so it sits on the right in Arabic');
  ok(!/border-l-2 border-primary pl-3/.test(portfolio), 'no physical-direction leftover');
}

/* ---- 10. builder: no prices, request flow behind an account ---- */
{
  const builder = read('app', '[locale]', 'builder', 'page.tsx');
  ok(!/fmt\(|estimate\.(low|high)|Estimated range|التقدير التقريبي/.test(builder), 'no estimates or price math remain');
  ok(/type Opt = \{ id: string; en: string; ar: string \}/.test(builder), 'the option shape carries no price field');
  ok(!/Number\(f\.cost/.test(builder), 'no cost value is read out of the CMS');
  ok(!/\$\s?\{?\s*(fmt|price|cost)/.test(builder), 'no currency amount is rendered');
  ok(/createRequest/.test(builder), 'selection is filed as a project request');
  ok(/\/signup/.test(builder), 'visitors are asked to create an account');
  ok(/useAuth/.test(builder), 'send branches on session state');

  /* Every CMS step renders as its own section. The old version flattened the
     options of all eight steps into one grid under the second step's label —
     a budget band sat in the same row as an industry, under "Scope". */
  ok(/solutionBuilder as \{ steps\?: unknown \}/.test(builder), 'steps come from the CMS');
  ok(/dims\.map\(\(dim, i\)/.test(builder), 'each step renders as its own numbered section');
  ok(/dim\.multi/.test(builder), 'multi steps allow several picks');
  ok(/current\.includes\(id\) \? \[\] : \[id\]/.test(builder), 'picking a second option replaces the first');

  /* The brief must reach the team whole: the old request named one feature
     plus one scale and silently dropped the other seven dimensions. */
  ok(/const answered = useMemo/.test(builder), 'every answered dimension is collected');
  ok(/const detail = answered/.test(builder), 'the description lists each dimension and its picks');
  ok(/Built with the Solution Builder/.test(builder), 'the description is labelled for the admin');
  ok(/title: requestTitle/.test(builder), 'the title is sent');
  ok(/timelineRow/.test(builder), 'a Timeline step feeds the request timeline column');
  /* Stale picks after a CMS edit would attach options that no longer exist. */
  ok(/\(prev\[d\.key\] \|\| \[\]\)\.filter\(\(id\) => ids\.includes\(id\)\)/.test(builder), 'picks that vanished from the CMS are dropped');

  /* `??` does not fall back for an EMPTY string, and the CMS is admin-editable:
     a cleared Arabic box exists and holds "", so the Arabic page would render a
     blank label. firstText() only falls back on a missing/blank value. */
  ok(/function firstText\(/.test(builder), 'blank-or-missing text falls back properly');
  ok(/ar: firstText\(o\.labelAr, label\)/.test(builder), 'option Arabic labels use it');
  ok(/labelAr: firstText\(step\.labelAr, step\.label, key\)/.test(builder), 'step Arabic labels use it');
  ok(!/labelAr \?\? /.test(builder), 'no `??` fallback for possibly-empty CMS text');

  /* Two dimensions sharing a key would share one `picks` entry, so a pick in
     one would appear — and be sent — in the other. */
  ok(/usedKeys\.has\(key\)/.test(builder), 'duplicate step keys are made unique');
  ok(/usedKeys\.has\(capKey\)/.test(builder), 'the synthetic section cannot steal a step key');
}

/* ---- 8. FAQ explorer: searchable, animated, countable ---- */
{
  const faqPage = read('app', '[locale]', 'faq', 'page.tsx');
  const faqExplorer = read('components', 'faq', 'FaqExplorer.tsx');
  ok(/FaqExplorer/.test(faqPage), 'FAQ page renders the explorer island');
  ok(!/<details/.test(faqPage), 'raw details/summary list is gone');
  ok(/type="search"/.test(faqExplorer), 'explorer has a search field');
  ok(/grid-rows-\[1fr\]/.test(faqExplorer) && /grid-rows-\[0fr\]/.test(faqExplorer), 'accordion animates via grid-rows');
  ok(/aria-expanded/.test(faqExplorer), 'accordion rows expose expanded state');
  ok(/resultsTemplate/.test(faqExplorer), 'explorer reports match counts via a serializable template');
  ok(!/resultsLabel/.test(faqExplorer + faqPage), 'no function props cross to the client (prerender-safe)');
  ok(/gradient-to-br from-primary/.test(faqPage), 'contact CTA is a gradient-ring card');
}

/* ---- 11. solution cards align, and every icon name resolves ---- */
{
  const utils = read('lib', 'utils.ts');
  const config = read('data', 'content.config.js');
  const sol = solutionsPageSrc();

  /* Descriptions run 1–4 lines, so the price + negotiable + button have to
     be one bottom-anchored block or a row of cards ends up with its CTAs at
     three different heights. */
  ok(/className="group flex flex-col rounded-2xl/.test(sol), 'the card is a flex column');
  ok(/<div className="mt-auto">/.test(sol), 'price + note + CTA are anchored to the bottom together');

  /* An icon name the map does not know falls through to HelpCircle, which
     renders as a literal "?" in the middle of a card. The dashboard ships
     stethoscope / package / shopping-cart / building-2 / landmark, and all
     five were missing — so real cards showed a question mark and it read as
     broken data rather than a missing glyph. */
  ok(/export \{ supportedIconNames/.test(utils), 'utils re-exports it for existing importers');
  const iconsSrc = read('lib', 'icons.ts');
  const mapStart = iconsSrc.indexOf('export const iconMap');
  const mapBody = iconsSrc.slice(mapStart, iconsSrc.indexOf('};', mapStart));
  const mapNames = new Set([...mapBody.matchAll(/[a-z0-9-]+['"]?:\s*[A-Z]/g)].map((m) => m[0].replace(/['"]?:\s*[A-Z]$/, '')));
  ok(mapNames.size >= 40, 'the icon map has a real set of drawable names', `${mapNames.size}`);

  for (const name of ['stethoscope', 'package', 'shopping-cart', 'building-2', 'landmark']) {
    ok(mapNames.has(name), `icon "${name}" resolves instead of falling back to "?"`);
  }

  /* Every icon the shipped default content names must be renderable. */
  const used = [...new Set([...config.matchAll(/"icon":\s*"([^"]+)"/g)].map((m) => m[1]))];
  const missingContent = used.filter((n) => !mapNames.has(n));
  ok(missingContent.length === 0, 'every icon in the shipped content renders',
    missingContent.join(', ') || `${used.length} names checked`);

  /* THE invariant that was broken: the dashboard offered 215 icon names and
     the frontend could draw 90, so 58% of a perfectly reasonable pick
     rendered as a literal "?" in the middle of a card. The operator can only
     choose from the picker's datalist, so everything it offers must draw. */
  const adminHtml = read('..', 'backend', 'admin', 'index.html');
  const picker = adminHtml.slice(adminHtml.indexOf('const LUCIDE_ICONS = ['));
  const offered = [...new Set([...picker.slice(0, picker.indexOf('];')).matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]))];
  const undrawable = offered.filter((n) => !mapNames.has(n));
  ok(undrawable.length === 0, 'every icon the admin picker offers can be drawn',
    undrawable.join(', ') || `${offered.length} offered`);
  ok(offered.length >= 40, 'the picker still offers a real choice', `${offered.length} offered`);
  ok(/GENERATED by frontend\/scripts\/build-icons/.test(adminHtml),
    'the admin picker is marked generated, not hand-maintained');
}

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
