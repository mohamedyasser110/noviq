/* ============================================================
   NOVIQ CONTENT ADMIN
   ------------------------------------------------------------
   Lets an authenticated admin (role === 'admin') edit dynamic
   site content — resources, portfolio projects, and the AI
   image prompt builder config — directly from the front end.

   Edits are layered as *overrides* on top of NOVIQ_CONTENT
   (the English source of truth shipped in content.config.js),
   persisted in localStorage so they survive reloads and can be
   re-exported. Public visitors without an admin session simply
   see the merged content and never see editing UI.
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'noviq_content_overrides';

  /* ---------- auth ---------- */
  function getAuthUser() {
    try { return JSON.parse(localStorage.getItem('noviq_user') || 'null'); } catch { return null; }
  }
  function isAdmin() {
    const u = getAuthUser();
    return !!(u && u.role === 'admin');
  }

  /* ---------- override layer ---------- */
  let overrides = {};
  function loadOverrides() {
    try { overrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { overrides = {}; }
    return overrides;
  }
  function saveOverrides() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch (e) { console.warn('[content-admin] save failed', e); }
  }
  loadOverrides();

  /* ---------- deep clone helper ---------- */
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* ---------- merge: base content <- overrides ---------- */
  function merge() {
    const base = window.NOVIQ_CONTENT;
    if (!base) return base;
    const out = clone(base);
    const ov = overrides;
    /* Generic: any key in overrides replaces the base key.
       Special-case promptBuilder to deep-merge instead of replace. */
    for (const k in ov) {
      if (k === 'promptBuilder') {
        out.promptBuilder = deepMerge(out.promptBuilder || {}, clone(ov.promptBuilder));
      } else {
        out[k] = clone(ov[k]);
      }
    }
    return out;
  }
  function deepMerge(a, b) {
    const out = clone(a);
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], b[k]);
      } else {
        out[k] = clone(b[k]);
      }
    }
    return out;
  }

  /* ---------- file -> dataURL (for images/docs under ~2MB) ---------- */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------- resources ---------- */
  function getResources() {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides.resources) return overrides.resources;
    return c.resources || defaultResources();
  }
  function defaultResources() {
    return {
      tabs: [
        { id: 'blog', label: { en: 'Blog', ar: 'المدونة' } },
        { id: 'whitepapers', label: { en: 'Whitepapers', ar: 'أبحاث' } },
        { id: 'downloads', label: { en: 'Downloads', ar: 'تحميلات' } },
      ],
      items: {
        blog: [
          { title: 'The Future of AI in Enterprise Software', date: 'Mar 15, 2026', cat: 'AI', excerpt: 'How artificial intelligence is reshaping the enterprise software landscape and what it means for your business.', link: '' },
          { title: 'Cloud Migration: A Step-by-Step Guide', date: 'Mar 1, 2026', cat: 'Cloud', excerpt: 'A practical guide to migrating your infrastructure to the cloud with minimal disruption.', link: '' },
        ],
        whitepapers: [
          { title: 'AI Readiness Report 2026', date: 'Jan 2026', cat: 'Research', excerpt: 'Comprehensive analysis of AI adoption across industries and readiness benchmarks.', link: '', file: '' },
        ],
        downloads: [
          { title: 'Company Profile PDF', date: 'PDF', cat: 'Download', excerpt: 'Complete overview of Noviq Solutions, our services, and case studies.', link: '', file: '' },
        ],
      }
    };
  }
  function saveResources(res) { overrides.resources = clone(res); saveOverrides(); applyToLive(); }
  function addResourceItem(tabId, item) {
    const res = getResources();
    if (!res.items[tabId]) res.items[tabId] = [];
    res.items[tabId].push(item);
    saveResources(res);
  }
  function updateResourceItem(tabId, index, item) {
    const res = getResources();
    if (res.items[tabId] && res.items[tabId][index]) {
      res.items[tabId][index] = item;
      saveResources(res);
    }
  }
  function deleteResourceItem(tabId, index) {
    const res = getResources();
    if (res.items[tabId]) { res.items[tabId].splice(index, 1); saveResources(res); }
  }

  /* ---------- projects (portfolio) ---------- */
  function getProjects() {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides.projects) return overrides.projects;
    return c.projects || [];
  }
  function saveProjects(list) { overrides.projects = clone(list); saveOverrides(); applyToLive(); }
  function addProject(p) { const list = getProjects(); list.push(p); saveProjects(list); }
  function updateProject(index, p) { const list = getProjects(); if (list[index]) { list[index] = p; saveProjects(list); } }
  function deleteProject(index) { const list = getProjects(); list.splice(index, 1); saveProjects(list); }

  /* ---------- prompt builder ---------- */
  function getPromptBuilder() {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides.promptBuilder) return deepMerge(c.promptBuilder || {}, clone(overrides.promptBuilder));
    return c.promptBuilder || {};
  }
  function savePromptBuilder(cfg) { overrides.promptBuilder = clone(cfg); saveOverrides(); applyToLive(); }

  /* ---------- typewriter phrases ---------- */
  const DEFAULT_TW_EN = [
    'ew Designs, Built to Impress',
    'ext-Gen AI Platforms',
    'ovel Software Engineering',
    'o-Compromise Performance',
    'avigating Digital Futures',
    'urturing Ideas Into Products',
    'etwork-Ready Enterprise Systems',
    'on-Stop Innovation Pipeline',
    'ext-Level Cloud Architecture',
    'oviq — Engineering the Future',
    'ative Intelligence, Deployed Fast',
    'ight-Time Delivery, Every Sprint',
    'ew Standards in UX & Design',
    'etwork of 32+ Countries Served',
    'ot Just Code — We Build Outcomes',
    'avigating Complex Global Engineering Challenges',
    'ext-Generation Cognitive Systems & Neural Networks',
    'ew Epoch in Enterprise Digital Transformation Platforms',
    'on-Stop Scale & Infinite Elastic Cloud Orchestration',
    'ovel Horizons in Applied Machine Learning Research',
  ];
  const DEFAULT_TW_AR = [];
  function getTypewriter() {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides.typewriter) return overrides.typewriter;
    return c.typewriter || { en: DEFAULT_TW_EN, ar: DEFAULT_TW_AR };
  }
  function saveTypewriter(tw) { overrides.typewriter = clone(tw); saveOverrides(); applyToLive(); }

  /* ---------- solution builder steps ---------- */
  function getSolutionBuilder() {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides.solutionBuilder) return overrides.solutionBuilder;
    return c.solutionBuilder || { steps: [] };
  }
  function saveSolutionBuilder(cfg) { overrides.solutionBuilder = clone(cfg); saveOverrides(); applyToLive(); }

  /* ---------- apply to live NOVIQ_CONTENT (in-place mutation like i18n) ---------- */
  function applyToLive() {
    const live = window.NOVIQ_CONTENT;
    if (!live || typeof live !== 'object') return;
    const isAr = document.documentElement.lang === 'ar';
    const arContent = window.NOVIQ_CONTENT_AR;

    for (const k in overrides) {
      if (k === 'promptBuilder') {
        live.promptBuilder = deepMerge(live.promptBuilder || {}, clone(overrides.promptBuilder));
        continue;
      }

      /* For arrays (clients, services, projects, etc.) when Arabic is active:
         use the admin's English data as structure, but layer Arabic text on top
         from *Ar fields or from NOVIQ_CONTENT_AR so items remain visible. */
      if (isAr && Array.isArray(overrides[k]) && arContent) {
        const adminArr = clone(overrides[k]);
        const arArr = arContent[k];

        /* Sections where we translate titles/descriptions */
        const TRANSLATABLE = new Set(['services', 'industries', 'why', 'process', 'projects']);
        const TEXT_FIELDS = ['title', 'desc', 'label', 'tag', 'challenge', 'solution', 'results'];

        if (TRANSLATABLE.has(k)) {
          adminArr.forEach(function (item, i) {
            if (!item || typeof item !== 'object') return;
            const arItem = Array.isArray(arArr) ? (arArr[i] || {}) : {};
            TEXT_FIELDS.forEach(function (field) {
              const arField = field + 'Ar';
              if (item[arField]) {
                item[field] = item[arField];
              } else if (arItem[field]) {
                item[field] = arItem[field];
              }
              /* else keep admin's English text as-is (fallback) */
            });
          });
        }
        /* clients, stack, stats, testimonials — keep admin data as-is
           (brand names, tech names, quotes are not translated) */

        live[k] = adminArr;
      } else {
        live[k] = clone(overrides[k]);
      }
    }

    /* Refresh live UI so admin changes are rendered immediately without page reload */
    if (window.NoviqI18n && typeof window.NoviqI18n.applyLanguage === 'function') {
      window.NoviqI18n.applyLanguage(document.documentElement.lang || 'en');
    } else if (typeof window.rebuildDynamicSections === 'function') {
      window.rebuildDynamicSections();
    }
  }

  /* ---------- export / import (backup) ---------- */
  function exportAll() {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'noviq-content-overrides.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importAll(jsonString) {
    try {
      overrides = JSON.parse(jsonString);
      saveOverrides();
      applyToLive();
      return true;
    } catch { return false; }
  }
  function resetAll() {
    overrides = {};
    saveOverrides();
    location.reload();
  }

  /* ---------- generic section CRUD ---------- */
  /* Any top-level key in NOVIQ_CONTENT (clients, services, industries, etc.)
     can be read, saved, and reset through this generic API. */
  function getSection(key) {
    const c = window.NOVIQ_CONTENT || {};
    if (overrides[key] !== undefined) return clone(overrides[key]);
    return clone(c[key]);
  }
  function saveSection(key, data) {
    overrides[key] = clone(data);
    saveOverrides();
    applyToLive();
  }
  function resetSection(key) {
    delete overrides[key];
    saveOverrides();
    applyToLive();
  }

  /* ---------- apply on load ---------- */
  function init() { applyToLive(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ---------- public API ---------- */
  window.NoviqContentAdmin = {
    isAdmin, fileToDataURL,
    getResources, saveResources, addResourceItem, updateResourceItem, deleteResourceItem,
    getProjects, saveProjects, addProject, updateProject, deleteProject,
    getPromptBuilder, savePromptBuilder,
    getSolutionBuilder, saveSolutionBuilder,
    getTypewriter, saveTypewriter,
    getSection, saveSection, resetSection,
    exportAll, importAll, resetAll,
    getOverrides: () => clone(overrides),
    applyToLive,
  };
})();
