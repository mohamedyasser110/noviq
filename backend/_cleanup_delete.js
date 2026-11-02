/* ============================================================
   DELETE PASS — unreferenced files only
   ------------------------------------------------------------
   Every path below was proven unreachable by tests/_unused-files.cjs
   (import-graph walk from the real entry points) AND by
   tests/_import-check.cjs (no importer anywhere in the tree).
   Framework-discovered routes (sitemap/robots) and the next-intl
   config actually used by middleware were excluded from the walk, so
   they are not in this list.

   A copy of everything is taken first into the temp backup folder, so
   this is reversible. The bus locks are acquired before the first
   delete and released after the last.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createAgent } = require('./.agent-system/agent-sdk');

const FE = 'C:/Downloads/Noviq - final/frontend';
const BACKUP = 'C:/Users/LapShop/AppData/Local/Temp/opencode/noviq-cleanup-backup';

/* dead source: no importer anywhere */
const DEAD_SOURCE = [
  'data/content.ar.js',                 // read only by the deleted chatbot ar-content loader
  'app/globals.css',                    // 4-line tailwind stub; the live sheet is styles/globals.css
  'components/ui/demo.tsx',             // demo wrapper for the 21st scaffold marquee
  'components/ui/logo-cloud-marquee.tsx', // 21st.dev scaffold, CDN placeholder logos; superseded by
                                         // components/OUR CLINTS/our-clints-marquee.tsx
  'components/ui/index.tsx',            // barrel, nothing imports the barrel
  'components/ui/button.tsx',
  'components/ui/card.tsx',
  'components/ui/badge.tsx',
  'components/ui/input.tsx',
  'components/ui/label.tsx',
  'components/ui/textarea.tsx',
  'components/sections/index.tsx',      // barrel, nothing imports it
  'components/shared/useContentOverrides.ts', // superseded by ContentOverrideBridge (DOM bridge)
  'components/shared/Loading.tsx',      // preloader never mounted; Next auto-loads only app/**/loading.tsx
  'lib/navigation.ts',                  // never imported
  'lib/i18n/routing.ts',                // legacy re-export shim, no importers
  'app/i18n/routing.ts',                // only the shim above imported it; middleware uses app/i18n/config
];

/* regenerable, git-ignored artefacts */
const DEAD_ARTEFACTS = [
  '.next-v2',            // stale dist dir, no process uses it (the dev server runs on .next)
  '.navtest-out',        // compiled output of npm run test:nav
  'w.log',
  'tsconfig.tsbuildinfo', // tsc regenerates it
];

(async () => {
  const sdk = createAgent('ultra-worker-cleanup', { baseUrl: 'http://127.0.0.1:4322', timeout: 15000 });
  await sdk.join(['cleanup', 'content-editing']);

  const all = [...DEAD_SOURCE, ...DEAD_ARTEFACTS];
  const held = [];
  for (const f of all) {
    const rel = f.replace(/\\/g, '/');
    try {
      const l = await sdk.acquireLock(rel, 'exclusive', 900, 'delete unreferenced file');
      held.push({ file: rel, token: l.lock_token });
    } catch (e) { console.log('LOCK FAIL ' + rel + ' -> ' + e.message); }
  }
  console.log('locks held: ' + held.length + '/' + all.length);
  fs.writeFileSync('C:/Users/LapShop/AppData/Local/Temp/opencode/noviq-cleanup-locks.json',
    JSON.stringify({ agent: sdk.agentName, held }, null, 2));

  /* ---- backup ---- */
  fs.mkdirSync(BACKUP, { recursive: true });
  let backed = 0;
  for (const f of DEAD_SOURCE) {
    const abs = path.join(FE, f);
    if (!fs.existsSync(abs)) { console.log('  SKIP (absent) ' + f); continue; }
    const dest = path.join(BACKUP, f.replace(/[\\/]/g, '__'));
    fs.copyFileSync(abs, dest);
    backed++;
  }
  console.log('backed up ' + backed + ' source files to ' + BACKUP);

  /* ---- delete ---- */
  const removed = [], failed = [];
  for (const f of all) {
    const abs = path.join(FE, f);
    try {
      if (!fs.existsSync(abs)) { removed.push(f + ' (already absent)'); continue; }
      fs.rmSync(abs, { recursive: true, force: true });
      removed.push(f);
    } catch (e) { failed.push(f + ' -> ' + e.message); }
  }
  console.log('\nREMOVED (' + removed.length + '):');
  for (const r of removed) console.log('  - ' + r);
  if (failed.length) { console.log('\nFAILED:'); for (const f of failed) console.log('  ! ' + f); }

  /* ---- release ---- */
  for (const h of held) {
    try { await sdk.releaseLock(h.file, h.token); } catch (e) { /* may have expired */ }
  }
  console.log('\nlocks released (' + held.length + ')');
  process.exit(failed.length ? 1 : 0);
})();
