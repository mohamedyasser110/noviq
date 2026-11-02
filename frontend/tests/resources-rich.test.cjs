/* ============================================================
   NOVIQ — Knowledge Hub rich text + article popup
   ------------------------------------------------------------
   The admin writes **bold** *italic* [links](…), [color:…] and
   [size:…] with a Word-like toolbar; the site renders them through
   lib/rich-text.tsx and the article opens in a popup window.

   The grammar core is evaled VERBATIM out of lib/rich-text.tsx (it is
   annotation-free JSDoc by contract), so these cases pin the shipped
   code — not a copy of it. Run: node tests/resources-rich.test.cjs
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. eval the annotated core straight from the source file ----
   The source is fully-typed TypeScript; the eval strips the annotations
   (params, returns, string[]), so the cases below still pin the shipped
   grammar instead of a copy. */
const src = read('lib', 'rich-text.tsx');
const core = src.slice(src.indexOf('/* RICH-CORE-START */'), src.indexOf('/* RICH-CORE-END */'));
ok(core.includes('export function renderRichText'), 'core block found in lib/rich-text.tsx');
const plain = core
  .replace(/^export /m, '')
  .replace(/: string\[\]/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '')
  .replace(/\(_m,/g, '(m,');
const renderRichText = new Function(`${plain}; return renderRichText;`)();
ok(typeof renderRichText === 'function', 'stripped core evals to a function');

/* ---- 2. grammar cases ---- */
const cases = [
  ['plain text passes through', 'hello world', 'hello world'],
  ['HTML is escaped, not rendered', '<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['quotes are escaped', 'a"b\'c', 'a&quot;b&#39;c'],
  ['bold', '**hi**', '<strong>hi</strong>'],
  ['italic', '*hi*', '<em>hi</em>'],
  ['code span', '`x=1`', '<code>x=1</code>'],
  ['markup inside code stays literal', '`**not bold**`', '<code>**not bold**</code>'],
  ['https link', '[Noviq](https://noviq.example/a)', '<a href="https://noviq.example/a" target="_blank" rel="noopener noreferrer">Noviq</a>'],
  ['mailto link', '[mail](mailto:a@b.c)', '<a href="mailto:a@b.c" target="_blank" rel="noopener noreferrer">mail</a>'],
  ['javascript: link rejected, leftovers stay literal', '[x](javascript:alert(1))', 'x)'],
  ['hex color', '[color:#e11d48]red[/color]', '<span style="color:#e11d48">red</span>'],
  ['named color', '[color:red]red[/color]', '<span style="color:red">red</span>'],
  ['bad color rejected, whole tag collapses to text', '[color:expression(alert(1))]x[/color]', 'x'],
  ['size', '[size:18]big[/size]', '<span style="font-size:18px">big</span>'],
  ['size clamps low', '[size:4]t[/size]', '<span style="font-size:12px">t</span>'],
  ['size clamps high', '[size:99]t[/size]', '<span style="font-size:32px">t</span>'],
  ['bold nests in color', '[color:red]**b**[/color]', '<span style="color:red"><strong>b</strong></span>'],
  ['bold nests in link text', '[**b**](https://x.y)', '<a href="https://x.y" target="_blank" rel="noopener noreferrer"><strong>b</strong></a>'],
  ['newlines break', 'a\nb', 'a<br>b'],
  ['empty in, empty out', '', ''],
];
for (const [label, input, expected] of cases) {
  let got;
  try {
    got = renderRichText(input);
  } catch (e) {
    ok(false, label, 'threw: ' + e.message);
    continue;
  }
  ok(got === expected, label, `got ${JSON.stringify(got)}`);
}
/* No tag beyond the allowlist may ever appear in any output above. */
{
  const probe = renderRichText('**b** *i* `c` [t](https://x.y) [color:red]x[/color] [size:9]y[/size] <u>u</u>');
  const tags = [...probe.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase());
  const allowed = new Set(['strong', 'em', 'code', 'a', 'span', 'br']);
  ok(tags.every((t) => allowed.has(t)), 'output tags stay in the allowlist', tags.join(','));
}

/* ---- 3. article popup wiring ---- */
const explorer = read('components', 'sections', 'ResourcesExplorer.tsx');
ok(/from '@radix-ui\/react-dialog'/.test(explorer), 'popup uses radix Dialog');
ok(/Dialog\.Root/.test(explorer) && /Dialog\.Portal/.test(explorer) && /Dialog\.Content/.test(explorer), 'overlay + focus-trapped content rendered');
ok(/RichText/.test(explorer), 'popup body renders through RichText (not raw text)');
ok(!/<details/.test(explorer), 'inline details expander is gone');
ok(/markSeen\(item\.id\)/.test(explorer), 'opening the popup fires the read receipt');
ok(/aria-expanded|Dialog\.Title/.test(explorer), 'popup is labelled for assistive tech');
ok(/dir=\{isRTL \? 'rtl' : 'ltr'\}/.test(explorer), 'popup direction follows the page');

/* ---- 4. admin toolbar + preview mirror ---- */
const adminHtml = read('..', 'backend', 'admin', 'index.html');
for (const fn of ['wrapResourceText', 'insertResourceLink', 'applyResourceColor', 'applyResourceSize', 'renderRichTextAdmin', 'updateResourceBodyPreview']) {
  ok(new RegExp('function ' + fn + '\\(').test(adminHtml), `admin ${fn}() exists`);
}
ok(/\[size:\\d\{1,2\}\\?\)/.test(adminHtml) || /size.*12.*32/.test(adminHtml), 'admin mirror clamps sizes');
ok(/noopener noreferrer/.test(adminHtml), 'admin mirror hardens links');

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
