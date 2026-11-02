/* ============================================================
   NOVIQ — footer content: CMS-driven columns, contact, and the editor
   ------------------------------------------------------------
   The footer rendered two hardcoded columns while its CMS row carried a
   retired `columns`/`social` shape nothing read — so "Edit: footer" edited
   dead fields, and the WhatsApp number lived one key away in `brand` with no
   path from the footer editor. Now the columns come from
   `footer.linkColumns` (validated, fallback to shipped), labels/visibility
   from `pages`, and contact/social from `brand`, all editable in one place.
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
const footer = read('..', 'frontend', 'components', 'layout', 'Footer.tsx');
const init = read('db', 'init.js');
const socialLib = read('..', 'frontend', 'lib', 'social.ts');

/* ---- 1. the site reads columns from the CMS, validated ---- */
{
  ok(/linkColumns/.test(footer), 'the footer reads linkColumns from the CMS');
  ok(/SHIPPED_COLUMNS/.test(footer), 'the shipped columns survive as the fallback');
  ok(/\(linkColumns \?\? SHIPPED_COLUMNS\)/.test(footer), 'absent CMS columns fall back without changing output');
  ok(/known\.has\(h\)/.test(footer), 'only known hrefs survive — a typo cannot render a link to nowhere');
  ok(/\/ai-lab/.test(footer), 'the retired page is explicitly skipped');
  ok(/cols\.length === 2/.test(footer), 'at most two columns render (the grid gives brand a double span)');
  ok(/if \(!items\.length\) return null/.test(footer), 'an emptied column hides its heading too, not a dead signpost');
  /* Headings stay dictionary-driven; membership is the CMS part. */
  ok(/col\.id === 'company' \? t\('company'\)/.test(footer), 'company heading still comes from the dictionary');
}

/* ---- 2. the editor suits the current footer ---- */
{
  ok(/if \(key === 'footer'\) return editFooterConfig\(key\)/.test(admin), 'footer opens its own editor, not the generic one');
  ok(/function editFooterConfig/.test(admin), 'the editor exists');
  ok(/contentData\.pages/.test(admin) && /contentData\.brand/.test(admin), 'it loads the pages and brand keys the footer reads');
  /* Tagline + copyright bilingual. */
  ok(/Tagline/.test(admin) && /Copyright|copyright/.test(admin), 'tagline and copyright are editable');
  ok(/falls back to English if empty/.test(admin), 'empty Arabic falls back instead of blanking');
  /* Link columns: the membership the site renders. */
  ok(/Link columns/.test(admin), 'there is a link-columns section');
  ok(/footerToggleVisible/.test(admin), 'visibility is toggleable per link');
  ok(/footerSetCol/.test(admin), 'links move across columns');
  ok(/footerMove/.test(admin), 'links reorder within a column');
  ok(/footerSetLabel/.test(admin), 'labels edit per language');
  /* WhatsApp front and center, with a live preview of the exact link. */
  ok(/WhatsApp number/.test(admin), 'the WhatsApp number edits inside the footer editor');
  ok(/ft-wa-preview/.test(admin), 'the exact wa.me link previews live');
  ok(/trunk zero is dropped/.test(admin), 'the trunk-zero rule is stated, not tribal knowledge');
  /* Contact/social siblings render in the same bottom bar — same group. */
  ok(/footerBrandDraft\.(email|facebook|instagram)/.test(admin), 'email/facebook/instagram edit beside WhatsApp');
  /* One save writes all three keys; untouched fields survive via deep copies
     and spreads, never a bare rebuild. */
  ok(/content\/footer/.test(admin) && /content\/pages/.test(admin) && /content\/brand/.test(admin),
    'save writes footer, pages and brand');
  ok(/JSON\.parse\(JSON\.stringify\(/.test(admin), 'drafts are deep copies — typing never mutates the loaded rows');
  /* Retired fields are disclosed, not silently kept-or-dropped. */
  ok(/retired <code>columns<\/code>/.test(admin), 'the retired columns/social arrays are disclosed as kept-but-unread');
}

/* ---- 3. the admin wa.me preview agrees with the renderer ---- */
{
  const ts = require(path.join(ROOT, '..', 'frontend', 'node_modules', 'typescript'));
  const js = ts.transpileModule(socialLib, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = {};
  new Function('exports', `${js};`)(mod);
  const waMeUrl = mod.waMeUrl;
  ok(typeof waMeUrl === 'function', 'social.ts loads for execution');

  /* Extract the editor preview (pure function) and run both on one fixture. */
  const at = admin.indexOf('function previewWaMe(raw) {');
  ok(at !== -1, 'the preview function is present and extractable');
  let previewWaMe = null;
  if (at !== -1) {
    let depth = 0;
    let end = -1;
    const start = admin.indexOf('{', at);
    for (let i = start; i < admin.length; i++) {
      if (admin[i] === '{') depth++;
      else if (admin[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const src = admin.slice(at, end + 1);
    previewWaMe = new Function(`${src}; return previewWaMe;`)();
  }
  const cases = [
    '01062339274',
    '+201062339274',
    '0020 1062339274',
    '20 106 233 9274',
    'https://wa.me/201062339274',
    '',
    '   ',
    '000',
  ];
  if (waMeUrl && previewWaMe) {
    const diff = cases.filter((c) => waMeUrl(c) !== previewWaMe(c))
      .map((c) => `${JSON.stringify(c)}: site=${waMeUrl(c)} panel=${previewWaMe(c)}`);
    ok(diff.length === 0, 'panel preview matches the renderer on every input shape', diff.join('; '));
  }
}

/* ---- 4. seed + migration carry linkColumns without touching the rest ---- */
{
  ok(/linkColumns: \[\{ id: "company"/.test(init), 'fresh installs seed both columns');
  ok(/"\/about", "\/careers", "\/contact", "\/why"/.test(init), 'the seeded company set matches the shipped one');
  ok(/"\/services", "\/solutions", "\/industries", "\/portfolio"/.test(init), 'the seeded services set matches the shipped one');
  /* The retired arrays stay in the seed verbatim — history, not garbage. */
  ok(/title: "Company", links: \["About", "Careers", "Contact", "Press"\]/.test(init),
    'the retired columns array is preserved, not deleted');
  ok(/stored\.linkColumns === undefined/.test(init), 'the migration adds linkColumns only when absent');
}

/* ---- 5. the contact editor suits the current contact section ----
   Same disease as the footer had: the section renders brand email/phone/
   locations links plus whatsapp/facebook/instagram icons, but "Edit: contact"
   opened the generic object editor with the links one key away and no wa.me
   preview. Now one editor covers links, social/WhatsApp and the form copy,
   all writing back to their own keys. */
{
  const contact = read('..', 'frontend', 'components', 'sections', 'Contact.tsx');
  /* The section is the contract: brand links + icons, contact-key copy. */
  ok(/waMeUrl\(brand\?\.whatsapp\)/.test(contact), 'the section links WhatsApp from brand');
  ok(/mailto:\$\{email\}/.test(contact) || /mailto:/.test(contact), 'the section links email as mailto:');
  ok(/tel:/.test(contact), 'the section links phone as tel:');

  ok(/if \(key === 'contact'\) return editContactConfig\(key\)/.test(admin), 'contact opens its own editor, not the generic one');
  ok(/function editContactConfig/.test(admin) && /function saveContactConfig/.test(admin), 'the editor exists and can save');
  /* Links write to brand — the single source the footer editor writes too. */
  ok(/contactBrandDraft\['\$\{r\.k\}'\]/.test(admin), 'link edits land on the brand draft (templated per row)');
  ok(/contactBrandDraft\.whatsapp/.test(admin), 'the WhatsApp number edits inside the contact editor');
  ok(/previewWaMe\(contactBrandDraft\.whatsapp\)|previewWaMe\(b\.whatsapp\)/.test(admin), 'the wa.me link previews live');
  ok(/content\/contact/.test(admin) && /content\/brand/.test(admin), 'save writes the contact and brand keys');
  /* Form copy keeps every box: a dedicated editor must not orphan strings
     the generic one used to show. */
  ok(/Object\.entries\(contactDraft\)/.test(admin), 'every form-copy string keeps an input');
  /* Preview mirrors the three rows plus the social line. */
  ok(/function renderContactPreview/.test(admin), 'a live preview mirrors rows and icons');
  ok(/ct-preview/.test(admin), 'the preview has a mount point');
}

console.log(failed ? `\n${failed} of ${passed + failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
