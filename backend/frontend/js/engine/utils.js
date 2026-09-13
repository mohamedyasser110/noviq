/* ============================================================
   UTILS — small shared helpers used across engine/render modules
   ============================================================ */

function dbg(msg) { if (window._deviceTier === 'low') console.log('[Perf]', msg); }

function createIcon(name, size = 22) {
  const el = document.createElement("i");
  el.setAttribute("data-lucide", name);
  el.style.width = size + "px";
  el.style.height = size + "px";
  return el;
}

function createEl(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function lerp(startVal, endVal, amt) {
  return startVal + (endVal - startVal) * amt;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ---- Easing functions (used by the intro timeline) ---- */
function easeInOutQuart(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t; }
function easeOutQuart(t) { return 1 - (--t) * t * t * t; }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOutCubic(t) { return (--t) * t * t + 1; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }

/* ---- Deterministic pseudo-random generator (stable intro particle layout) ---- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Localization helper: returns Arabic text with English fallback ---- */
function localized(val, field, lang) {
  const l = lang || document.documentElement.lang || 'en';
  const useAr = l === 'ar';

  /* {en, ar} object pattern */
  if (val && typeof val === 'object' && !Array.isArray(val) && !field) {
    if (useAr && val.ar) return val.ar;
    if (val.en) return val.en;
    return '';
  }

  /* Access field on an object */
  if (field && typeof val === 'object' && val !== null) {
    if (useAr) {
      const arKey = field + 'Ar';
      if (val[arKey] !== undefined && val[arKey]) return val[arKey];
    }
    if (val[field] !== undefined) return val[field];
    return '';
  }

  /* Plain string fallback: try the t() translator */
  if (useAr && typeof val === 'string' && typeof t === 'function') {
    const translation = t(val);
    if (translation !== val) return translation;
  }

  return val;
}

/* ---- Device performance tier (low / mid / high) ---- */
window._deviceTier = (function() {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
                   (matchMedia('(hover: none) and (pointer: coarse)').matches);
  const cores = navigator.hardwareConcurrency || 0;
  const mem = navigator.deviceMemory || 0;
  if ((isMobile && mem > 0 && mem <= 4) || cores <= 4 || (mem > 0 && mem <= 4)) return 'low';
  if (cores <= 6 || (mem > 0 && mem <= 8)) return 'mid';
  return 'high';
})();
