/* ============================================================
   NOVIQ SIMPLE THEME — explicit light/dark (white identity base)
   - default: light (white) for ministries & enterprises
   - storage: noviq-theme = 'light' | 'dark'
   - kills crystal inline overrides
   ============================================================ */
(function () {
  'use strict';
  var STORAGE_KEY = 'noviq-theme';
  var root = document.documentElement;

  window.__NOVIQ_SIMPLE_MODE = true;

  function clearCrystalInline() {
    var props = ['--bg','--surface','--card','--border','--text','--text-secondary',
      '--text-tertiary','--text-inverse','--primary','--secondary','--accent','--accent-2',
      '--bg-rgb','--surface-rgb','--card-rgb','--text-rgb','--text-inverse-rgb',
      '--glass-bg','--glass-bg-deep','--glass-bg-light','--glass-border',
      '--nav-bg','--menu-bg','--popup-bg','--input-bg','--modal-backdrop',
      '--shadow-sm','--shadow-md','--shadow-lg','--shadow-glow','--shadow-glow-strong',
      '--energy-level','--energy-progress','--crystal-s0','--crystal-s1','--crystal-s2',
      '--crystal-s3','--crystal-s4','--crystal-s5'];
    for (var i = 0; i < props.length; i++) {
      try { root.style.removeProperty(props[i]); } catch (e) {}
    }
    try { root.removeAttribute('data-theme-tone'); } catch (e) {}
  }

  function getSaved() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (e) {}
    return 'light';
  }

  function apply(theme, save) {
    theme = theme === 'dark' ? 'dark' : 'light';
    clearCrystalInline();
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0817' : '#FFFFFF');
      var cs = document.querySelector('meta[name="color-scheme"]');
      if (cs) cs.setAttribute('content', 'light dark');
    } catch (e) {}
    if (save !== false) { try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {} }
    updateBtn(theme);
    try { window.dispatchEvent(new CustomEvent('noviq-theme-change', { detail: { theme: theme } })); } catch (e) {}
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggle() { apply(current() === 'dark' ? 'light' : 'dark'); }

  var btn = null;
  function icons() {
    return '<span class="noviq-toggle-thumb" aria-hidden="true"></span>' +
      '<span class="noviq-toggle-slot slot-sun" aria-hidden="true">' +
        '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>' +
      '</span>' +
      '<span class="noviq-toggle-slot slot-moon" aria-hidden="true">' +
        '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
      '</span>';
  }

  function updateBtn(theme) {
    if (!btn) return;
    var isDark = theme === 'dark';
    btn.setAttribute('aria-checked', isDark ? 'true' : 'false');
    var isAr = (document.documentElement.lang || 'en').toLowerCase().indexOf('ar') === 0;
    btn.setAttribute('aria-label', isDark
      ? (isAr ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode')
      : (isAr ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode'));
    btn.setAttribute('title', isDark ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode'));
  }

  function mountBtn() {
    if (document.getElementById('theme-simple-toggle')) {
      btn = document.getElementById('theme-simple-toggle');
      /* Static HTML button carries no listener — bind once (mountBtn re-runs on timers) */
      if (!btn.dataset.noviqToggleBound) {
        btn.addEventListener('click', toggle);
        try { btn.dataset.noviqToggleBound = '1'; } catch (e) {}
      }
      updateBtn(current()); return;
    }
    var actions = document.querySelector('.noviq-nav-actions');
    if (!actions) return;
    btn = document.createElement('button');
    btn.id = 'theme-simple-toggle';
    btn.type = 'button';
    btn.className = 'noviq-theme-simple-toggle';
    btn.setAttribute('role', 'switch');
    btn.innerHTML = icons();
    btn.addEventListener('click', toggle);
    var lang = document.getElementById('language-toggle');
    if (lang && lang.parentNode === actions) actions.insertBefore(btn, lang);
    else actions.insertBefore(btn, actions.firstChild);
    updateBtn(current());
  }

  function removeCrystal() {
    try {
      var t = document.getElementById('theme-crystal-toggle');
      if (t) t.remove();
      var p = document.getElementById('theme-crystal-panel');
      if (p) p.remove();
      var els = document.querySelectorAll('.noviq-crystal-toggle, .noviq-theme-panel');
      for (var i = 0; i < els.length; i++) els[i].remove();
    } catch (e) {}
    try { localStorage.removeItem('noviq-energy-level'); } catch (e) {}
  }

  function killIntro() {
    try {
      var o = document.getElementById('noviq-intro-overlay');
      if (o) o.remove();
      document.body.classList.remove('intro-active');
    } catch (e) {}
  }

  function init() {
    clearCrystalInline();
    apply(getSaved(), false);
    removeCrystal();
    killIntro();
    mountBtn();
    // re-mount after i18n re-renders navbar (safe)
    setTimeout(mountBtn, 800);
    setTimeout(mountBtn, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // public API
  window.NoviqTheme = { apply: apply, toggle: toggle, current: current };
})();
