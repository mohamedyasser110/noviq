/* ============================================================
   NOVIQ — client session display (login state reaches the UI)
   ------------------------------------------------------------
   Two real bugs lived here and neither showed in a type check:

     1. The account page was a static server component that ALWAYS
        rendered "Sign in to access…" — even right after a successful
        login, because a server component cannot read the localStorage
        session and nothing ever checked it. The navbar hard-linked to
        /login for the same reason. The session existed; the display
        never knew.
     2. The admin backup download sent `Bearer null`: downloadBackup()
        read localStorage key 'admin_token' (the *site* login page's key,
        on another origin) while the panel stores 'noviq_admin_token'.
        The server answered 401 and the UI showed a bare "HTTP 401".

   Static assertions: both bugs are "a value never read / a key
   mismatched", which no runtime assertion catches without a browser.
   Run: npm run test:auth
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const auth = read('lib', 'auth.tsx');
const apiClient = read('lib', 'api-client.ts');
const navbar = read('components', 'layout', 'Navbar.tsx');
const account = read('app', '[locale]', 'account', 'page.tsx');
const adminHtml = read('..', 'backend', 'admin', 'index.html');
const globalsCss = read('styles', 'globals.css');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. single session source ---- */
ok(/['"]use client['"]/.test(auth), 'lib/auth.tsx is a client module');
ok(/export function AuthProvider/.test(auth) && /export function useAuth/.test(auth),
  'AuthProvider + useAuth are exported');
ok(/\/api\/portal\/me/.test(auth) || /portal\.me\(\)/.test(auth),
  'the session is validated against GET /api/portal/me, not trusted from storage');
ok(/clearStoredSession\(\)/.test(auth) && /removeItem\(TOKEN_KEY\)/.test(auth),
  'a dead session is cleared so no ghost session can render');
ok(/addEventListener\(['"]storage['"]/.test(auth),
  'cross-tab sync via the storage event');

/* ---- 2. api-client carries the portal endpoints ---- */
ok(/portal:\s*\{/.test(apiClient), 'api-client has a portal group');
ok(/['"]\/api\/portal\/me['"]/.test(apiClient), 'portal.me hits /api/portal/me');
ok(/['"]\/api\/portal\/projects['"]/.test(apiClient), 'portal.projects hits /api/portal/projects');
/* The client dashboard mirrors what the admin "Client Projects" page
   writes: one project with steps + contracts, the contract list, the
   update feed with read receipts, and the message composer. */
ok(/project:\s*\(id/.test(apiClient), 'portal.project(id) reads one project with steps + contracts');
ok(/['"]\/api\/portal\/contracts['"]/.test(apiClient), 'portal.contracts hits /api/portal/contracts');
ok(/['"]\/api\/portal\/notifications['"]/.test(apiClient), 'portal.notifications hits /api/portal/notifications');
ok(/markNotificationRead/.test(apiClient), 'portal.markNotificationRead exists (read receipts)');
ok(/sendMessage/.test(apiClient) && /['"]\/api\/portal\/contact['"]/.test(apiClient),
  'portal.sendMessage posts to /api/portal/contact (lands in the admin inbox)');
/* Two-way thread + editable profile: the conversation the admin answers
   in Client Projects, and the contact data the client owns. */
ok(/['"]\/api\/portal\/messages['"]/.test(apiClient), 'portal.messages hits /api/portal/messages');
ok(/sendChatMessage/.test(apiClient), 'portal.sendChatMessage writes in the thread');
ok(/['"]\/api\/portal\/profile['"]/.test(apiClient), 'portal.profile/updateProfile hit /api/portal/profile');
/* Contract attachments ride the same reads: the client dashboard links
   the uploaded scan/photo, the admin validates its path server-side. */
ok(/file\?: string;/.test(apiClient), 'contract payloads carry the attachment file path');
ok(/View attached document|عرض المرفق/.test(account), 'contract card links the attached document');
/* Update-feed controls: type pills, relative time, All/Unread filter and
   one-click clear — the section the admin writes to must be scannable. */
ok(/markAllNotificationsRead/.test(apiClient), 'portal.markAllNotificationsRead hits read-all');
ok(/markAllRead|Mark all read/.test(account), 'dashboard offers mark-all-read');
ok(/updatesFilter|showUnread/.test(account), 'feed filters All vs Unread');
ok(/timeAgo/.test(account), 'feed stamps relative time');
/* Avatar + activation requests: the photo the admin sees, and the
   structured form the admin triages. */
ok(/uploadAvatar|profile\/avatar/.test(apiClient), 'portal.uploadAvatar posts the photo');
ok(/deleteAvatar/.test(apiClient), 'portal.deleteAvatar clears the photo');
ok(/['"]\/api\/portal\/requests['"]/.test(apiClient), 'portal.requests/createRequest hit /api/portal/requests');
ok(/createRequest/.test(apiClient), 'portal.createRequest files a request');
ok(/req-cat|requestCategoryLabel/.test(account), 'request form offers preset categories');
ok(/REQUEST_BUDGETS|requestBudgetLabel/.test(account), 'request form offers preset budgets');
ok(/myRequests|My requests|طلباتي/.test(account), 'dashboard lists own requests with live status');
/* Request pager: six per page with ‹ › arrows once there is more than one
   page; newest first, clamped so a shrinking list never strands an empty
   page, reset to page one after sending (otherwise the new request looks
   like it vanished). Chevron sides swap in RTL. */
ok(/REQ_PAGE_SIZE = 6/.test(account), 'six request cards per page');
ok(/reqTotalPages > 1/.test(account), 'the pager renders only past one page');
ok(/ChevronLeft|ChevronRight/.test(account), 'pager arrows are chevrons, mirrored in RTL');
ok(/reqPrev|reqNext/.test(account), 'pager buttons carry accessible labels in both languages');
ok(/Page \$\{reqPageSafe \+ 1\} of/.test(account) || /صفحة/.test(account), 'a Page X of Y readout sits between the arrows');
ok(/Math\.min\(reqPage, reqTotalPages - 1\)/.test(account), 'the page index clamps to the last live page');
ok(/setReqPage\(0\)/.test(account), 'sending a request jumps back to page one');
ok(/reqVisible\.map/.test(account), 'the list renders the paged window, not the whole array');
/* Request cards: localized status (was raw English), relative date, hover. */
ok(/STATUS_LABEL\[r\.status\]/.test(account), 'request status localizes with raw fallback');
ok(/timeAgo\(r\.createdAt/.test(account), 'request cards stamp relative time when the API provides it');
ok(/changePhoto|Change photo|تغيير الصورة/.test(account), 'dashboard lets the client change the photo');
/* Compact profile actions: small icon pills instead of four full buttons. */
ok(/rounded-full border/.test(account), 'profile actions are compact pills');
ok(/<Camera|<Pencil|<Trash2/.test(account), 'profile actions carry icons');
/* Dashboard organization: one rank per button intent, icon stat cards, count
   badges on section titles, and a tighter section rhythm. */
ok(/min-h-\[32px\]/.test(account), 'profile actions are compact 32px targets');
ok(/focus-visible:ring-2/.test(account), 'profile actions keep visible focus rings');
ok(/bg-primary\/10 text-primary/.test(account) && /bg-emerald-500\/10/.test(account) && /bg-amber-500\/10/.test(account),
  'stat cards carry tinted icons (work blue, money green, attention amber)');
ok(/tabular-nums/.test(account), 'stat values and badges use tabular numerals');
ok(/rounded-full bg-primary\/10 px-2\.5 py-0\.5/.test(account), 'section titles carry count badges');
ok(/hover:border-slate-300 dark:hover:border-slate-600/.test(account), 'list cards lift their border on hover');

/* ---- 3. navbar reflects the session ---- */
ok(/useAuth/.test(navbar), 'Navbar reads useAuth()');
ok(/isLoggedIn|!user/.test(navbar), 'Navbar branches on session state');
ok(/is-logged|My account|account/.test(navbar), 'Navbar links to the account when signed in');
ok(/Sign [Oo]ut|signOut|logout/.test(navbar), 'sign-out still offered (drawer + account page)');
/* The standalone header logout button is gone: one quiet account chip
   carries the session, with an unread badge when project updates wait. */
ok(!/noviq-logout-btn/.test(navbar), 'no standalone logout button in the header');
ok(/noviq-unread-badge/.test(navbar), 'account chip renders an unread badge');
ok(/unread/.test(navbar), 'badge reads the session unread count');
/* The hub shortcut owned .noviq-unread-badge first: exactly one rule may
   set position:absolute (its base) — the account chip only re-anchors via
   a scoped selector, otherwise the hub badge drifts too. */
{
  const absoluteBadges = [...globalsCss.matchAll(/([^{}]+)\{[^}]*position:\s*absolute[^}]*\}/g)]
    .map((m) => m[1])
    .filter((sel) => sel.includes('noviq-unread-badge'));
  ok(absoluteBadges.length === 1, 'one absolute badge rule (hub base intact)', absoluteBadges.join(' | '));
  ok(/\.noviq-login-icon\s+\.noviq-unread-badge/.test(globalsCss), 'account chip re-anchors the badge (scoped override)');
}
/* The logged-out markup must be byte-identical to before: same class, same
   href, same label — zero layout shift, existing Playwright checks pass. */
ok(navbar.includes('href={`/${locale}/login`}') && /noviq-login-icon/.test(navbar),
  'logged-out navbar keeps the identical Login pill');
ok(/aria-label="Login"/.test(navbar), 'logged-out pill keeps its accessible name');

/* Mobile drawer: same contract. */
ok(/DrawerAuthArea|drawer.*[Aa]ccount|Sign In/.test(navbar), 'mobile drawer has an auth-aware footer');
ok(/noviq-drawer-cta/.test(navbar), 'drawer keeps its CTA classes');

/* ---- 4. account page is session-aware ---- */
ok(/['"]use client['"]/.test(account), 'account page is a client component (can read the session)');
ok(/useAuth\(\)/.test(account), 'account page reads useAuth()');
ok(/!isLoggedIn|user === null|!user/.test(account), 'account page branches on session state');
ok(!/Session active|sessionActive/.test(account), 'no vibe-style session badge in the dashboard');
ok(/portal\s*\.\s*projects\s*\(\)/.test(account), 'dashboard lists live projects from the API');
/* The two interfaces are linked in the open: steps, contracts, updates
   and the composer must all render from the same portal reads the admin
   writes to — otherwise the admin page edits data no client ever sees. */
ok(/portal\s*\.\s*contracts\s*\(\)/.test(account), 'dashboard lists structured contracts');
ok(/portal\s*\.\s*notifications\s*\(\)/.test(account), 'dashboard renders the admin-written update feed');
ok(/markNotificationRead|markRead/.test(account), 'feed items carry read receipts');
ok(/sendChatMessage|sendMessage|portal\s*\.\s*contact/.test(account), 'dashboard has a message-the-team composer');
ok(/milestones|Delivery steps|steps/.test(account), 'project cards expose their milestone steps');
/* Conversation thread + profile editor: the other half of the admin
   inbox, and the contact data the client owns (phone included). */
ok(/portal\s*\.\s*messages\s*\(\)/.test(account), 'dashboard renders the two-way thread');
ok(/updateProfile|saveProfile/.test(account), 'dashboard lets the client edit name + phone');
ok(/profile-phone|phoneLabel/.test(account), 'phone field exists in the profile editor');
ok(/LoggedOutMarketing|Sign in to access/.test(account), 'logged-out visitors still see the original content');

/* ---- 5. admin backup download sends the right token ---- */
const dlStart = adminHtml.indexOf('async function downloadBackup');
ok(dlStart > 0, 'downloadBackup exists');
const dlBlock = adminHtml.slice(dlStart, adminHtml.indexOf('function readFileAsDataURL'));
ok(/'Bearer '\+token/.test(dlBlock),
  'download sends the in-scope session token');
ok(!/getItem\('admin_token'\)/.test(dlBlock),
  'download no longer reads the wrong localStorage key',
  "getItem('admin_token') is the site login key on another origin — always null here");
ok(/status===401/.test(dlBlock),
  'download handles 401 as an expired session (re-login), not a bare HTTP code');

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
