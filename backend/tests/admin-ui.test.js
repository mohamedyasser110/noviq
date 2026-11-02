/* ============================================================
   NOVIQ — admin panel UI static tests
   ------------------------------------------------------------
   The dashboard is one big inline <script> + <style> that no bundler
   touches, so regressions here are silent: no type-check, no build step,
   nothing fails until an admin clicks. These read the file and assert the
   properties that already broke once:

     · backup client/server size caps agree (a 64-vs-48 mismatch let a
       file through that the server then rejected with 413 after a wait)
     · the history table, summary strip and staged-restore cleanup exist
     · the download elapsed timer always stops (it once overwrote the
       success message forever)
     · theme toggle + light theme + brand logo references exist
     · no violet/cyan remnants of the pre-rebrand palette

   Standalone: reads files only, binds no port.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT, 'routes', 'admin.js'), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. client/server size caps agree ---- */
const clientCap = html.match(/const MAX_BACKUP_MB\s*=\s*(\d+)/);
const serverCap = adminJs.match(/MAX_BACKUP_UPLOAD\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
ok(clientCap && serverCap, 'both caps are declared', `client=${clientCap?.[1]} server=${serverCap?.[1]}MB`);
if (clientCap && serverCap) {
  ok(Number(clientCap[1]) === Number(serverCap[1]),
    `client cap (${clientCap[1]}MB) equals server cap (${serverCap[1]}MB)`,
    'a larger client cap lets doomed uploads wait-then-fail with 413');
}

/* ---- 2. history UI is complete ---- */
for (const id of ['bk-history', 'bk-history-count', 'bk-summary', 'bk-download-status']) {
  ok(html.includes(`id="${id}"`), `element #${id} exists`);
}
for (const fn of ['refreshBackupHistory', 'downloadStoredBackup', 'deleteStoredBackup', 'restoreStoredBackup', 'fmtBytes']) {
  ok(new RegExp(`function ${fn}\\(`).test(html), `function ${fn}() exists`);
}
ok(/Stored backups/.test(html), 'history card is titled');
ok(/items\.reduce\(.*b\.size/.test(html), 'summary totals stored bytes');
ok(/autoBackupHours/.test(html), 'summary shows the scheduler state');
/* Action buttons must not spill onto a second row at desktop widths. */
ok(/text-align:right;min-width:330px/.test(html),
  'history actions column is wide enough for all three buttons');

/* ---- 3. staged restore cannot go stale ---- */
ok(/pendingRestore && pendingRestore\.name === name/.test(html),
  'deleting a staged file clears the restore staging area');

/* ---- 4. the elapsed timer always stops ---- */
const dlBlock = html.slice(html.indexOf('async function downloadBackup'));
const dlEnd = dlBlock.indexOf('async function ', 10);
const dl = dlBlock.slice(0, dlEnd > 0 ? dlEnd : 4000);
ok(/const ticker = setInterval/.test(dl), 'download starts an elapsed timer');
ok((dl.match(/clearInterval\(ticker\)/g) || []).length >= 2,
  'timer is stopped on success AND in finally',
  'an unstopped ticker overwrites the success message every second');

/* ---- 5. theme toggle + light theme ---- */
ok(/id="theme-toggle"/.test(html), 'theme toggle button exists');
ok(/toggleAdminTheme/.test(html), 'toggle handler exists');
ok(/noviq_admin_theme/.test(html), 'choice persists in localStorage');
ok(/\[data-theme="light"\]/.test(html) || /\[data-theme='light'\]/.test(html),
  'light theme overrides exist');
ok(/documentElement\.setAttribute\('data-theme'/.test(html),
  'theme applies via data-theme attribute');

/* ---- 6. brand logo is the real file ---- */
ok(/logo\/noviq-icon\.webp/.test(html), 'admin uses the real brand mark');
ok(fs.existsSync(path.join(ROOT, 'admin', 'logo', 'noviq-icon.webp')), 'logo file ships with the panel');
ok(!/noviqLiquidBase/.test(html), 'old hand-drawn SVG gradients are gone');

/* ---- 7. no pre-rebrand palette remnants ---- */
const remnants = ['#8b5cf6', '#7c3aed', '#c4b5fd', '#6d28d9', '#06b6d4', '#22d3ee',
  '139,92,246', '124,58,237', '6,182,212', '#0B0817', '#110d20'];
const found = remnants.filter((r) => html.includes(r));
ok(found.length === 0, 'no violet/cyan remnants', found.join(' '));

/* ---- 8. every sidebar page resolves (dead pages are silent 404s) ---- */
const sidebarPages = [...html.matchAll(/data-page="([a-z-]+)"/g)].map((m) => m[1]);
const cases = [...html.matchAll(/case '([a-z-]+)'/g)].map((m) => m[1]);
const orphaned = [...new Set(sidebarPages)].filter((p) => !cases.includes(p));
ok(orphaned.length === 0, 'every sidebar link has a loadPage case', orphaned.join(','));

/* ---- 9. client-projects page: the admin side of the dashboard ----
   Without it the admin can read leads but can never write the projects,
   steps, contracts and messages the client dashboard renders — the two
   interfaces would be linked by API only, with no human control. */
for (const fn of ['loadClientProjects', 'renderClientProjects', 'createClientProject',
  'openClientProject', 'renderClientProjectDetail', 'saveCpProject', 'deleteClientProject',
  'saveCpMilestone', 'addCpMilestone', 'deleteCpMilestone', 'attachCpContract',
  'saveCpContract', 'sendCpMessage', 'seedCpDemo']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
/* ---- 10. conversations inbox inside Client Projects ----
   Client messages written at /account must be readable + answerable
   without leaving the page: thread list with unread counts, chat view
   with bubbles, reply box. Otherwise the "two-way" link is admin→client
   only. */
for (const fn of ['loadCpConversations', 'renderCpMessages', 'openCpChat',
  'renderCpChat', 'sendCpReply', 'cpBubble']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/moveCpMilestone/.test(html), 'delivery steps can be reordered (up/down)');
ok(!/focusMsg/.test(html), 'dead focusMsg param removed from openClientProject');
ok(!/cpChatDraft/.test(html), 'dead chat-draft variable removed');
ok(/data-page="projects"/.test(html) && /id="projects-badge"/.test(html),
  'Client Projects link carries an unread badge');
ok(/portal\/messages/.test(html), 'page drives the two-way message APIs');
/* ---- 12. organized inbox: search, quick reply, multi-place answers ----
   A thread list with no search and a single reply path does not scale
   past a handful of clients: the admin must find threads fast and answer
   from the list, the chat, or the contacts inbox — whichever is open. */
for (const fn of ['cpSearchChanged', 'openCpQuickReply', 'sendCpQuickReply',
  'gotoCpChat', 'attachChatReplyButton']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/id="cp-search"/.test(html), 'projects overview has a client search box');
ok(/cpStatusFilter/.test(html), 'projects overview filters by status');
ok(/Reply in chat/.test(html), 'contacts modal bridges into the chat thread');
/* ---- 13. avatars + activation-request triage ----
   The photo a client uploads must surface everywhere the team sees them,
   and structured requests need a review loop with a one-click handoff. */
for (const fn of ['cpAvatar', 'renderCpRequests', 'saveCpRequest', 'newProjectFromRequest', 'paintCpBadge']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/cpAvatar\(c,28\)/.test(html) && /cpAvatar\(u,/.test(html), 'avatar thumbs in lists and headers');
ok(/<th>Photo<\/th>/.test(html), 'Registered Users table shows a photo column');
ok(/<th>Phone<\/th>/.test(html), 'phone has its own column (tel: link, not buried text)');

/* ---- 15. retention rule is stated in the backup history header ----
   "10 stored" reads as "the newest 10 win" unless the panel says otherwise,
   and a busy day then silently evicts every older day. */
ok(/Keeps the newest \$\{keep\}, never dropping the last \$\{keepDays\} days/.test(html),
  'the summary states the cap and the daily guarantee together');
ok(/bkHistoryState\.keep = data\.keep/.test(html), 'the cap comes from the API, not hardcoded');
ok(/bkHistoryState\.keepDays = data\.keepDays/.test(html), 'the daily guarantee comes from the API');
ok(/keep: null, keepDays: null/.test(html), 'the state carries both fields');
ok(/Days on hand/.test(html), 'the panel shows which days are actually on hand');
ok(/bkHistoryState\.days = Array\.isArray\(data\.days\)/.test(html), 'day coverage comes from the API');
ok(/cp-req-status-/.test(html) && /cp-req-note-/.test(html), 'request rows carry status + note controls');
/* ---- 11. contract full edit + file attachment ----
   Status-only editing forced value/terms fixes through re-attach; the
   card now edits every field inline and uploads a scan/photo (PDF/image,
   5MB, magic-byte verified server-side) whose path is validated to an
   uploads-relative file before it is stored. */
for (const fn of ['uploadCpContractFile', 'uploadCpNewContractFile',
  'clearCpContractFile', 'uploadCpFileTo']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/cp-c-title-/.test(html) && /cp-c-value-/.test(html) && /cp-c-notes-/.test(html),
  'contract card edits title, value and terms inline');
ok(/cp-c-file-/.test(html), 'contract card carries the attachment path field');
ok(/admin\/upload/.test(html), 'attachments upload through POST /admin/upload');
/* ---- 12. inline script parses ----
   A stray backtick inside modal HTML once terminated its template and took
   the whole panel script down. Raw backtick parity cannot prove balance
   (regex literals like /`...`/ carry literal backticks), so extract the
   script blocks and run node --check on them — the real parser decides. */
{
  const { execFileSync } = require('child_process');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ok(blocks.length > 0, 'inline script blocks found', `${blocks.length}`);
  const tmp = require('os').tmpdir() + '/noviq-admin-inline-check.js';
  require('fs').writeFileSync(tmp, blocks.join('\n;\n'));
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    ok(true, 'admin inline JS passes node --check');
  } catch (e) {
    ok(false, 'admin inline JS passes node --check', String(e.message).slice(0, 200));
  }
}
/* ---- 13. rich-text toolbar + live preview (Knowledge Hub bodies) ----
   The admin writes **bold** *italic* [links](…), [color:…] and [size:…]
   with a Word-like toolbar; the preview mirror must exist for both
   languages or formatting is typed blind. */
for (const fn of ['wrapResourceText', 'insertResourceLink', 'applyResourceColor',
  'applyResourceSize', 'renderRichTextAdmin', 'updateResourceBodyPreview']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/rich-toolbar/.test(html), 'formatting toolbar styles exist');
ok(/resource-preview-en/.test(html) && /resource-preview-ar/.test(html), 'live body previews exist for EN + AR');

/* ---- 14. array-editor field labels + hints ----
   `results` held the portfolio pills but was labelled with its raw storage
   key, so it read as a dead box nobody could guess the format of. Keys now
   carry a friendly label plus a one-line format hint. */
ok(/const FIELD_LABELS = \{/.test(html), 'field label map exists');
ok(/const FIELD_HINTS = \{/.test(html), 'field hint map exists');
ok(/results:\s*'Result chips'/.test(html), 'results is labelled in plain English');
ok(/Separate with commas/.test(html), 'results hint states the comma-separated format');
ok(/resultsAr:\s*'Same pills in Arabic/.test(html), 'Arabic chips explained');
ok(/\$\{esc\(fieldLabel\(k\)\)\}/.test(html), 'plain fields use the friendly label');
ok(/\$\{esc\(fieldLabel\(key\)\)\}/.test(html), 'bilingual fields use the friendly label');
ok(/function fieldHintHtml\(/.test(html), 'hint line is rendered under the inputs');
ok(/data-page="projects"/.test(html), 'sidebar links the Client Projects page');
ok(/Client Projects/.test(html), 'page title registered');
ok(/portal\/projects/.test(html), 'page talks to the portal projects API');
ok(/portal\/milestones/.test(html), 'page drives milestone steps');
ok(/portal\/contracts/.test(html), 'page attaches/advances contracts');
ok(/portal\/notifications/.test(html), 'page messages the client');

/* ---- 9. vision-audit fixes (found by screenshotting the live panel) ---- */
/* a. Light mode must repaint the topbar: it is painted with a hardcoded
      dark fill, and the page title inherits --text — near-black on a dark
      bar, i.e. unreadable. */
ok(/\[data-theme="light"\]\s+\.topbar\{background:rgba\(255,255,255/.test(html),
  'light theme repaints the topbar');
/* b. Muted text on light surfaces must clear WCAG AA (4.5:1 on white). */
const lightText3 = (html.match(/\[data-theme="light"\]\{[\s\S]{0,1200}?--text3:(#[0-9a-f]{6})/i) || [])[1];
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
if (lightText3) {
  const ratio = 1.05 / (luminance(lightText3) + 0.05);
  ok(ratio >= 4.5, `light --text3 ${lightText3} passes WCAG AA on white (${ratio.toFixed(2)}:1)`,
    'the login subtitle/labels were 2.5:1 before');
} else {
  ok(false, 'light --text3 token found');
}
/* c. Secondary buttons: no background meant the NATIVE light-grey chip in
      dark mode, with no hover/focus feedback. */
const btnBase = (html.match(/\.btn\{([^}]+)\}/) || [])[1] || '';
ok(/background:var\(--bg3\)/.test(btnBase), '.btn base has a themed background');
ok(/color:var\(--text\)/.test(btnBase), '.btn base has themed text color');
ok(/\.btn:hover\{/.test(html), 'secondary buttons have a hover state');
ok(/\.btn:focus-visible\{/.test(html), 'secondary buttons have a focus ring');
/* d. Sidebar highlight: callers that pass no element must still move it. */
ok(/sidebar-link\[data-page=/.test(html),
  'showPage resolves the sidebar link from the page name (stale highlight fix)');
ok(/scrollIntoView\(\{block:'nearest'\}\)/.test(html),
  'active sidebar link is scrolled into view');

/* ---- 10. stored backups interactivity ----
   The history rows used to be dead buttons: no loading state, a blocking
   native confirm() for delete, no refresh or filter. Every property below
   broke or was missing once. */
for (const fn of ['setBkFilter', 'setBkSort', 'renderBackupHistory',
  'askDeleteStoredBackup', 'cancelDeleteStoredBackup', 'copyBackupName']) {
  ok(new RegExp('function ' + fn + '\\(').test(html), `function ${fn}() exists`);
}
ok(/id="bk-refresh"/.test(html), 'history Refresh button exists');
ok(/id="bk-sort"/.test(html), 'history sort control exists');
ok(/data-bkfilter="all"/.test(html) && /data-bkfilter="auto"/.test(html) && /data-bkfilter="manual"/.test(html),
  'All/Auto/Manual filter tabs exist');
ok(/bkRowBusy/.test(html), 'per-row busy state exists (buttons show loading)');
ok(/bk-spinner/.test(html), 'busy buttons render a spinner');
ok(/bkConfirmDelete/.test(html), 'delete uses two-step inline confirm state');
ok(/Yes, delete/.test(html) && /bk-confirm-strip/.test(html),
  'inline delete-confirm strip replaces the native dialog');
/* The native confirm() must be gone from the backup flow: it froze the tab
   with an unthemed blocking dialog. Scope the check to the history code so
   unrelated confirms elsewhere do not trip it. */
{
  const start = html.indexOf('async function deleteStoredBackup');
  const end = html.indexOf('async function restoreStoredBackup');
  const delBlock = start >= 0 && end > start ? html.slice(start, end) : '';
  ok(!/[^a-zA-Z]confirm\s*\(/.test(delBlock), 'no native confirm() in the delete flow');
}
ok(/bk-badge-auto/.test(html) && /bk-badge-manual/.test(html),
  'Auto/Manual source badges exist');
ok(/bk-badge-latest/.test(html), 'Latest-row badge exists');
ok(/bk-badge-staged/.test(html), 'Staged-for-restore badge exists');
ok(/bk-refresh-spinning/.test(html), 'refresh button spins while loading');
ok(/copyBackupName/.test(html), 'filenames are click-to-copy');
/* Async image handlers must null-check their target: an artwork <img> can
   finish loading after its editor already unmounted (fast editor switching
   on a cold cache threw `null.style` twice). Same for any late repaint. */
/* Async image handlers must null-check their target: an artwork <img> can
   finish loading after its editor already unmounted (fast editor switching
   on a cold cache threw `null.style` twice). */
{
  const notes = [...html.matchAll(/getElementById\('hv-note-[\s\S]{0,40}?\.style/g)].map((m) => m[0]);
  const guarded = [...html.matchAll(/var n=document\.getElementById\('hv-note-[\s\S]{0,40}?if\(n\)n\.style/g)];
  ok(notes.length > 0 && guarded.length === notes.length,
    'every note-element style access is null-guarded', `${guarded.length}/${notes.length} guarded`);
}

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
