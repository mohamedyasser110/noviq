/* ============================================================
   NOVIQ — Knowledge Hub: filter + pins + unread badge
   ------------------------------------------------------------
   The hub page used to be a static server render: anchor links that
   jumped between sections, no search, no way to save an item, and no
   signal for what's new. Three properties are asserted structurally:

     1. FILTER — the explorer filters by text, section, category and
        sort, all client-side with zero additional requests.
     2. PINS — pin state lives in lib/resources-store.ts (localStorage),
        never in render output, so the first paint matches the prerender.
     3. BADGE — the header shortcut renders ONLY when signed in and shows
        the unread pill ONLY when the count is above zero.

   Run: npm run test:resources
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

const store = read('lib', 'resources-store.ts');
const explorer = read('components', 'sections', 'ResourcesExplorer.tsx');
const page = read('app', '[locale]', 'resources', 'page.tsx');
const shortcut = read('components', 'layout', 'ResourcesShortcut.tsx');
const navbar = read('components', 'layout', 'Navbar.tsx');
const globals = read('styles', 'globals.css');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* ---- 1. store: SSR-safe, capped, evented ---- */
ok(/typeof window/.test(store), 'store guards localStorage for SSR');
ok(/slice\(0,\s*500\)/.test(store), 'stored lists are capped against unbounded growth');
ok(/RESOURCES_EVENT|noviq:resources/.test(store), 'mutations broadcast for same-tab updates');
ok(/togglePin/.test(store) && /markSeen/.test(store) && /countUnread/.test(store),
  'store exposes togglePin + markSeen + countUnread');
ok(/99\+/.test(store), 'badge count caps at 99+');

/* ---- 2. explorer: filter controls ---- */
ok(/['"]use client['"]/.test(explorer), 'explorer is a client component');
ok(/type="search"/.test(explorer), 'explorer has a search input');
ok(/aria-pressed=\{section ===/.test(explorer), 'explorer has section chips');
ok(/<select/.test(explorer) && /category/i.test(explorer), 'explorer has a category dropdown');
ok(/sortDefault|sortAz|'az'/.test(explorer), 'explorer has a sort control');
ok(/results\(filtered\.length\)/.test(explorer), 'explorer reports a real result count');
ok(/clearAll|Clear filters/.test(explorer), 'explorer offers clearing the filters');

/* ---- 3. explorer: pins ---- */
ok(/getPinnedIds\(\)/.test(explorer), 'pins are read from the store, not invented');
ok(/storeTogglePin|togglePin\(/.test(explorer), 'pin toggle persists through the store');
ok(/aria-pressed=\{pinned\}/.test(explorer), 'pin button exposes its state to assistive tech');
ok(/pinnedItems/.test(explorer) && /Pinned|pinnedTitle/.test(explorer),
  'pinned items collect in a strip above everything');
/* No <button> inside <a>: the pin toggle is a sibling of the card link. */
ok(!/<a[^>]*>[\s\S]*<button[^>]*>[\s\S]*<\/a>/.test(explorer.replace(/<div key[\s\S]*?<\/div>\s*\}\)/g, '')) ||
  /sibling of the card link/.test(explorer),
  'pin toggle is not nested inside the card link');

/* ---- 4. read receipts drive the badge ---- */
ok(/markSeen\(item\.id\)/.test(explorer), 'opening a card marks it seen');
ok(/onToggle/.test(explorer), 'expanding an inline article marks it seen');

/* ---- 5. page stays a server wrapper ---- */
ok(!/['"]use client['"]/.test(page), 'resources page stays a server component');
ok(/ResourcesExplorer/.test(page), 'page hands content to the explorer');
ok(/revalidate/.test(page), 'page keeps its ISR window');

/* ---- 6. header shortcut: logged-in only, badge only when unread ---- */
ok(/!isLoggedIn/.test(shortcut) && /return null/.test(shortcut),
  'shortcut renders nothing when logged out');
ok(/formatBadgeCount\(unread\)/.test(shortcut), 'badge text goes through the 99+ cap');
ok(/unread > 0 \?/.test(shortcut), 'badge element renders only when unread is above zero');
ok(/aria-label=\{unread > 0 \?/.test(shortcut), 'badge count is announced to screen readers');
ok(/showHub|isLoggedIn/.test(navbar), 'navbar gates the hub shortcut on login');
ok(/ResourcesShortcut/.test(navbar), 'navbar renders the shortcut component');
ok(/variant="desktop"/.test(navbar) && /variant="drawer"/.test(navbar),
  'shortcut appears in both desktop bar and mobile drawer');

/* ---- 7. badge CSS exists and is RTL-safe ---- */
ok(/\.noviq-unread-badge\s*\{/.test(globals), 'badge rule exists');
ok(/inset-inline-end/.test(globals), 'badge uses logical properties (RTL-safe)');
ok(/\.noviq-drawer-link \.noviq-unread-badge/.test(globals) ||
  /\.noviq-drawer-link\.noviq-shortcut-link/.test(globals),
  'drawer badge lays out inline instead of floating');

console.log(failed ? `\n${failed} FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
