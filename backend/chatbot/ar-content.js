/* ============================================================
   NOVIQ CHATBOT — ARABIC CONTENT LOADER
   ------------------------------------------------------------
   The SQLite content DB stores English (admin-editable).
   Arabic translations live in frontend/data/content.ar.js as a
   browser file (window.NOVIQ_CONTENT_AR = {...}).
   This module safely evaluates that file in Node so Arabic
   chatbot answers use Arabic services/industries/projects.
   Cached with a 5-minute TTL.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const TTL = 5 * 60 * 1000;
let cache = null;
let loadedAt = 0;

function load() {
  try {
    const file = path.join(config.FRONTEND_DIR, 'data', 'content.ar.js');
    const src = fs.readFileSync(file, 'utf8');
    const sandbox = {};
    /* The file only assigns window.NOVIQ_CONTENT_AR = {...} */
    new Function('window', src)(sandbox);
    return sandbox.NOVIQ_CONTENT_AR || null;
  } catch (e) {
    console.warn('[Chatbot] Arabic content load failed:', e.message);
    return null;
  }
}

/* Raw Arabic object (or null) — used by search indexing */
function getArabicRaw() {
  if (!cache || Date.now() - loadedAt > TTL) {
    cache = load();
    loadedAt = Date.now();
  }
  return cache;
}

/* English content with Arabic keys merged over it — used for AR answers */
function getArabicContent(enContent) {
  const ar = getArabicRaw();
  return ar ? Object.assign({}, enContent, ar) : enContent;
}

module.exports = { getArabicContent, getArabicRaw };
