/* ============================================================
   NOVIQ API — SHARED HELPERS (validators, pagination, content)
   Imported by route modules. No routes here.
   ============================================================ */
const db = require('../db/init');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- Content field names --------------------------------------------
   The dashboard can now CREATE a field on any object section, so the
   API has to police the name. Without this a typo ("titel") silently
   stores a dead field the site never reads, and a name like
   "__proto__" is a prototype-pollution hazard.

   Dashes are allowed on purpose: the live `pages` section already uses
   `ai-lab` as a key. Letters/digits/underscore/dash only, must start
   with a letter, 64 chars max — which is exactly the set the i18n
   validator already enforces for translations. */
const FIELD_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const FORBIDDEN_FIELD_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

function validateObjectFieldNames(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const name of Object.keys(value)) {
    if (FORBIDDEN_FIELD_NAMES.has(name)) return { error: `Field name "${name}" is not allowed.` };
    if (!FIELD_NAME_RE.test(name)) {
      return { error: `Invalid field name "${name}". Use letters, digits, underscore or dash, starting with a letter.` };
    }
  }
  return null;
}

/* ---- Shared helpers ---- */
function getPublicContent() {
  const rows = db.prepare('SELECT key, value FROM content').all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

/* Safe pagination: NaN-proof, clamped (bad input crashed SQLite binding before) */
function pageParams(req, maxLimit = 200) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), maxLimit);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

/* ---- Translations (i18n) dictionary — DATABASE-BACKED ----
   The dictionary lives in the `content` table under `i18n_<locale>`, the same
   table every other admin-editable document already uses. That is deliberate:
   one store, one admin surface, one export (/admin/export dumps `content`),
   and no second copy that can drift out of sync with the first.

   BOTH the admin editor (routes/admin.js) and the public runtime read
   (routes/public.js) go through get/setDictionary below, so the writer and the
   reader physically cannot disagree about where the dictionary lives.

   MIGRATION: the JSON files in the frontend checkout are no longer written and
   no longer served. They are read exactly once — the first time a locale is
   requested and no DB row exists yet — and are then written into the database
   and never consulted again. So an existing install keeps its dictionary
   exactly as it was, and from that point the database owns it.

   The frontend still BUNDLES i18n/<locale>.json at build time, but only as the
   offline fallback: the site reads the live dictionary over the API and merges
   it over the bundled copy. Editing a dictionary in the admin therefore no
   longer needs a rebuild, and the bundled file can never be the reason an edit
   "does nothing". */
const I18N_LOCALES = new Set(['en', 'ar']);

/** The `content` row that holds one locale's dictionary. */
const dictionaryKey = (locale) => `i18n_${locale}`;

/* Kept only to seed the database on first read (see the note above). Once a
   locale is in the DB this file is never opened again. */
function i18nPaths() {
  const dir = path.join(config.FRONTEND_DIR, 'i18n');
  return {
    dir,
    file: (locale) => path.join(dir, `${locale}.json`),
    mirror: path.join(dir, 'translations.json'),
    backup: (locale) => path.join(dir, `${locale}.json.bak`),
  };
}

/* Where a seed dictionary may live, best source first.
 *
 * 1. `<FRONTEND_DIR>/i18n/<locale>.json` — the repo and shared hosting,
 *    where the frontend checkout sits next to the backend. Authoritative.
 * 2. `<backend>/i18n-seed/<locale>.json` — a copy shipped INSIDE this
 *    image. The API container is built with `context: backend/`, so it has
 *    no sibling `frontend/` directory and path 1 can never resolve there.
 *    Without this fallback the seed silently finds nothing: the public
 *    endpoint 404s, the admin Translations editor opens EMPTY (nothing to
 *    edit), and the site keeps serving the bundled files — so an admin edit
 *    can never be confirmed on the site. See scripts/sync-i18n-seed.js;
 *    tests/i18n-seed.test.js fails if the two copies diverge. */
function dictionarySeedCandidates(locale) {
  const { file } = i18nPaths();
  return [
    file(locale),
    path.join(__dirname, '..', 'i18n-seed', `${locale}.json`),
  ];
}

function readDictionaryFile(locale) {
  for (const candidate of dictionarySeedCandidates(locale)) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      console.warn(`[i18n] ${candidate} parsed but is not a dictionary object.`);
    } catch (err) {
      /* A corrupt seed must not take the site down — try the next source. */
      console.warn(`[i18n] could not seed ${locale} from ${candidate}: ${err.message}`);
    }
  }
  return null;
}

/**
 * Write one locale's dictionary. This is the ONLY writer.
 * The upsert matches the shape used by the site-content routes, so the row is
 * indistinguishable from any other content document to /admin/export and the
 * rest of the admin.
 */
function setDictionary(locale, value) {
  const key = dictionaryKey(locale);
  const valueStr = JSON.stringify(value);
  const existing = db.prepare('SELECT key FROM content WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(valueStr, key);
  } else {
    db.prepare('INSERT INTO content (key, value) VALUES (?, ?)').run(key, valueStr);
  }
  return value;
}

/**
 * Read one locale's dictionary — the ONLY reader.
 * DB first. If this locale has never been written (a fresh database, or an
 * install that predates the migration) the bundled JSON seeds it exactly once.
 * Returns null only when there is genuinely nothing to serve.
 */
function getDictionary(locale) {
  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(dictionaryKey(locale));
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* A corrupt row must not take the site down: fall through and re-seed. */
      console.warn(`[i18n] ${locale} row is not valid JSON — reseeding from the bundled file.`);
    }
  }
  const seeded = readDictionaryFile(locale);
  if (seeded) {
    setDictionary(locale, seeded);
    console.log(`[i18n] seeded ${locale} into the database from the bundled file (one time).`);
  }
  return seeded;
}

function validateResources(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Resources must be an object.' };
  if (!input.hero || typeof input.hero !== 'object') return { error: 'Resources page header is required.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    const value = input.hero[field];
    if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `hero.${field} must contain en and ar.` };
    if (value.en.length > 1000 || value.ar.length > 1000) return { error: `hero.${field} is too long.` };
  }
  if (!Array.isArray(input.tabs) || input.tabs.length > 20) return { error: 'Resources must contain up to 20 sections.' };
  if (!input.items || typeof input.items !== 'object' || Array.isArray(input.items)) return { error: 'Resource items are required.' };

  const ids = new Set();
  const normalized = JSON.parse(JSON.stringify(input));
  for (const tab of normalized.tabs) {
    if (!tab || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tab.id || '') || ids.has(tab.id)) return { error: 'Resource section IDs must be unique safe identifiers.' };
    ids.add(tab.id);
    if (!tab.label || typeof tab.label.en !== 'string' || typeof tab.label.ar !== 'string') return { error: `Section ${tab.id} must contain English and Arabic labels.` };
    if (typeof tab.active !== 'boolean') return { error: `Section ${tab.id} active state is invalid.` };
    const items = normalized.items[tab.id];
    if (!Array.isArray(items) || items.length > 500) return { error: `Section ${tab.id} must contain up to 500 items.` };
    const itemIds = new Set();
    for (const item of items) {
      if (!item || typeof item !== 'object' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(item.id || '') || itemIds.has(item.id)) return { error: `Content IDs in ${tab.id} must be unique safe identifiers.` };
      itemIds.add(item.id);
      for (const field of ['title', 'excerpt', 'content', 'cat']) {
        const value = item[field];
        if (!value || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `${field} in ${item.id} must contain en and ar.` };
      }
      if (!item.title.en.trim() && !item.title.ar.trim()) return { error: `A title is required for ${item.id}.` };
      if (item.title.en.length > 300 || item.title.ar.length > 300 || item.excerpt.en.length > 2000 || item.excerpt.ar.length > 2000 || item.content.en.length > 100000 || item.content.ar.length > 100000) return { error: `Content in ${item.id} is too long.` };
      if (!['draft', 'published'].includes(item.status) || typeof item.featured !== 'boolean') return { error: `Publishing state in ${item.id} is invalid.` };
      if (item.link && !/^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i.test(item.link)) return { error: `External link in ${item.id} is invalid.` };
      for (const field of ['file', 'image']) {
        if (item[field] && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(item[field]) || /(?:^|\/)\.\.(?:\/|$)/.test(item[field]))) return { error: `${field} path in ${item.id} is invalid.` };
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 4 * 1024 * 1024) return { error: 'Resources content is too large.' };
  return { value: normalized };
}

function validateTeam(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Team must be an object.' };
  if (!input.hero || typeof input.hero !== 'object') return { error: 'Team page header is required.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    const value = input.hero[field];
    if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `hero.${field} must contain en and ar.` };
    if (value.en.length > 1000 || value.ar.length > 1000) return { error: `hero.${field} is too long.` };
  }
  if (!Array.isArray(input.members) || input.members.length > 200) return { error: 'Team must contain up to 200 members.' };
  const ids = new Set();
  const normalized = JSON.parse(JSON.stringify(input));
  for (const member of normalized.members) {
    if (!member || typeof member !== 'object' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(member.id || '') || ids.has(member.id)) return { error: 'Member IDs must be unique safe identifiers.' };
    ids.add(member.id);
    for (const field of ['name', 'role', 'bio']) {
      const value = member[field];
      if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return { error: `${field} in ${member.id} must contain en and ar.` };
    }
    if (!member.name.en.trim() && !member.name.ar.trim()) return { error: `A name is required for ${member.id}.` };
    if (member.name.en.length > 200 || member.name.ar.length > 200 || member.role.en.length > 300 || member.role.ar.length > 300 || member.bio.en.length > 5000 || member.bio.ar.length > 5000) return { error: `Text in ${member.id} is too long.` };
    if (!['draft', 'published'].includes(member.status) || typeof member.featured !== 'boolean') return { error: `Publishing state in ${member.id} is invalid.` };
    for (const field of ['portfolio', 'linkedin', 'github', 'facebook']) {
      if (member[field] && !/^(?:https?:\/\/)[^\s"'<>]*$/i.test(member[field])) return { error: `Link ${field} in ${member.id} is invalid.` };
    }
    if (member.email && !/^\S+@\S+\.\S+$/.test(member.email)) return { error: `Email in ${member.id} is invalid.` };
    if (member.photo && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(member.photo) || /(?:^|\/)\.\.(?:\/|$)/.test(member.photo))) return { error: `Photo in ${member.id} is invalid.` };
    if (member.cv && (!/^(?:https?:\/\/[^\s"'()<>]+|\/?(?:images|assets)\/[A-Za-z0-9_./-]+)$/i.test(member.cv) || /(?:^|\/)\.\.(?:\/|$)/.test(member.cv))) return { error: `CV file in ${member.id} is invalid.` };
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 4 * 1024 * 1024) return { error: 'Team content is too large.' };
  return { value: normalized };
}

function validateSolutionBuilder(input) {  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.steps)) return { error: 'Solution Builder must contain a steps array.' };
  if (!input.steps.length || input.steps.length > 30) return { error: 'Solution Builder must have 1-30 steps.' };
  const normalized = JSON.parse(JSON.stringify(input));
  const keys = new Set();
  let totalOptions = 0;
  for (const step of normalized.steps) {
    if (!step || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(step.key || '') || keys.has(step.key)) return { error: 'Solution Builder step keys must be unique safe identifiers.' };
    keys.add(step.key);
    for (const field of ['label', 'title', 'desc']) {
      if (typeof step[field] !== 'string' || !step[field].trim() || step[field].length > 1000) return { error: `Invalid ${field} in step ${step.key}.` };
    }
    if (typeof step.multi !== 'boolean' || !Array.isArray(step.options) || !step.options.length || step.options.length > 100) return { error: `Invalid options in step ${step.key}.` };
    const values = new Set();
    totalOptions += step.options.length;
    for (const option of step.options) {
      if (!option || typeof option.value !== 'string' || !option.value.trim() || option.value.length > 120 || values.has(option.value)) return { error: `Option values in ${step.key} must be unique.` };
      values.add(option.value);
      if (typeof option.label !== 'string' || !option.label.trim() || option.label.length > 300 || typeof option.icon !== 'string' || option.icon.length > 500) return { error: `Invalid option in step ${step.key}.` };
    }
  }
  if (totalOptions > 500 || Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 512 * 1024) return { error: 'Solution Builder configuration is too large.' };
  return { value: normalized };
}

/* ---- Generic localized-page validators (pricing / faq / careers / about / pages) ----
   Lenient by design: the admin UI owns the shape, the API guards size,
   types and the en/ar localized-pair contract. */
function validateLocalizedPair(value, field, maxLen) {
  if (!value || typeof value !== 'object' || typeof value.en !== 'string' || typeof value.ar !== 'string') return `${field} must contain en and ar.`;
  if (value.en.length > maxLen || value.ar.length > maxLen) return `${field} is too long.`;
  return null;
}

function validatePricing(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Pricing must be an object.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    if (input[field] !== undefined) {
      const err = validateLocalizedPair(input[field], field, 1000);
      if (err) return { error: err };
    }
  }
  if (input.plans !== undefined) {
    if (!Array.isArray(input.plans) || input.plans.length > 20) return { error: 'Pricing plans must be an array of up to 20.' };
    for (const p of input.plans) {
      if (!p || typeof p !== 'object') return { error: 'Each plan must be an object.' };
      for (const field of ['name', 'desc', 'price', 'cta']) {
        if (p[field] !== undefined) {
          const err = validateLocalizedPair(p[field], 'plan.' + field, 500);
          if (err) return { error: err };
        }
      }
      if (p.features !== undefined) {
        if (!p.features || typeof p.features !== 'object' || !Array.isArray(p.features.en) || !Array.isArray(p.features.ar)) return { error: 'plan.features must contain en/ar arrays.' };
        if (p.features.en.length > 50 || p.features.ar.length > 50) return { error: 'Too many features in a plan.' };
      }
      if (p.popular !== undefined && typeof p.popular !== 'boolean') return { error: 'plan.popular must be boolean.' };
    }
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 512 * 1024) return { error: 'Pricing content is too large.' };
  return { value: JSON.parse(JSON.stringify(input)) };
}

function validateFaq(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'FAQ must be an object.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    if (input[field] !== undefined) {
      const err = validateLocalizedPair(input[field], field, 1000);
      if (err) return { error: err };
    }
  }
  if (input.items !== undefined) {
    if (!Array.isArray(input.items) || input.items.length > 100) return { error: 'FAQ items must be an array of up to 100.' };
    for (const it of input.items) {
      if (!it || typeof it !== 'object') return { error: 'Each FAQ item must be an object.' };
      for (const field of ['q', 'a']) {
        const err = validateLocalizedPair(it[field], 'item.' + field, 5000);
        if (err) return { error: err };
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 512 * 1024) return { error: 'FAQ content is too large.' };
  return { value: JSON.parse(JSON.stringify(input)) };
}

function validateCareers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Careers must be an object.' };
  for (const field of ['eyebrow', 'title', 'description']) {
    if (input[field] !== undefined) {
      const err = validateLocalizedPair(input[field], field, 1000);
      if (err) return { error: err };
    }
  }
  for (const listKey of ['benefits', 'positions']) {
    if (input[listKey] !== undefined) {
      if (!Array.isArray(input[listKey]) || input[listKey].length > 100) return { error: `${listKey} must be an array of up to 100.` };
      for (const it of input[listKey]) {
        if (!it || typeof it !== 'object') return { error: `Each ${listKey} item must be an object.` };
        for (const field of ['title', 'desc']) {
          if (it[field] !== undefined) {
            const err = validateLocalizedPair(it[field], listKey + '.' + field, 2000);
            if (err) return { error: err };
          }
        }
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 512 * 1024) return { error: 'Careers content is too large.' };
  return { value: JSON.parse(JSON.stringify(input)) };
}

function validateAbout(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'About must be an object.' };
  for (const field of ['eyebrow', 'title', 'description', 'mission', 'vision', 'valuesEyebrow', 'valuesTitle', 'sinceEyebrow', 'journeyTitle']) {
    if (input[field] !== undefined) {
      const err = validateLocalizedPair(input[field], field, 5000);
      if (err) return { error: err };
    }
  }
  if (input.values !== undefined) {
    if (!Array.isArray(input.values) || input.values.length > 50) return { error: 'About values must be an array of up to 50.' };
    for (const it of input.values) {
      if (!it || typeof it !== 'object') return { error: 'Each value must be an object.' };
      for (const field of ['title', 'desc']) {
        if (it[field] !== undefined) {
          const err = validateLocalizedPair(it[field], 'value.' + field, 2000);
          if (err) return { error: err };
        }
      }
    }
  }
  if (input.milestones !== undefined) {
    if (!Array.isArray(input.milestones) || input.milestones.length > 50) return { error: 'Milestones must be an array of up to 50.' };
    for (const it of input.milestones) {
      if (!it || typeof it !== 'object') return { error: 'Each milestone must be an object.' };
      if (it.year !== undefined && typeof it.year !== 'string' && typeof it.year !== 'number') return { error: 'Milestone year must be string or number.' };
      for (const field of ['title', 'text', 'desc']) {
        if (it[field] !== undefined) {
          const err = validateLocalizedPair(it[field], 'milestone.' + field, 3000);
          if (err) return { error: err };
        }
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 512 * 1024) return { error: 'About content is too large.' };
  return { value: JSON.parse(JSON.stringify(input)) };
}

/* Rotating hero badge phrases. Plain string lists per locale. */
function validateTypewriter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Typewriter must be an object.' };
  const out = {};
  for (const loc of ['en', 'ar']) {
    const list = input[loc];
    if (list === undefined) { out[loc] = []; continue; }
    if (!Array.isArray(list) || list.length > 100) return { error: `Typewriter ${loc} must be an array of up to 100.` };
    for (const s of list) {
      if (typeof s !== 'string' || !s.trim() || s.length > 300) return { error: `Typewriter ${loc} phrases must be 1-300 char strings.` };
    }
    out[loc] = list;
  }
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > 128 * 1024) return { error: 'Typewriter content is too large.' };
  return { value: out };
}

/* Pages visibility: { [slug]: { enabled: boolean, labelEn?, labelAr? } }.
   Unknown slugs are accepted (forward-compatible) but must be safe identifiers. */
function validatePages(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Pages must be an object.' };
  const keys = Object.keys(input);
  if (keys.length > 60) return { error: 'Too many page entries.' };
  for (const slug of keys) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) return { error: `Invalid page slug: ${slug}.` };
    const entry = input[slug];
    if (!entry || typeof entry !== 'object') return { error: `Page ${slug} must be an object.` };
    if (typeof entry.enabled !== 'boolean') return { error: `Page ${slug} enabled must be boolean.` };
    if (entry.placement !== undefined && entry.placement !== 'bar' && entry.placement !== 'more') return { error: `Page ${slug} placement must be "bar" or "more".` };
    for (const field of ['labelEn', 'labelAr', 'note']) {
      if (entry[field] !== undefined && (typeof entry[field] !== 'string' || entry[field].length > 300)) return { error: `Page ${slug} ${field} is invalid.` };
    }
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 128 * 1024) return { error: 'Pages config is too large.' };
  return { value: JSON.parse(JSON.stringify(input)) };
}

/** A path-parameter row id, or null when it is not strictly a positive
 *  integer.
 *
 *  The obvious `parseInt(v, 10)` is wrong for an id that PICKS A ROW.
 *  parseInt('5abc') is 5, so `DELETE /logs/5abc` would delete log 5 — a row
 *  the caller never named — and the 404 for a genuinely missing id would be
 *  indistinguishable from a malformed one. So an id that reaches a WHERE
 *  clause demands digits and nothing else, and the caller answers 400.
 *
 *  Shared rather than duplicated per route file: the same rule has to hold in
 *  every file that reads an id, and two copies of a validator is how they
 *  start disagreeing. */
function strictId(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{1,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

module.exports = { EMAIL_PATTERN, strictId, getPublicContent, pageParams, i18nPaths, I18N_LOCALES, getDictionary, setDictionary, dictionaryKey, validateResources, validateTeam, validateSolutionBuilder, validatePricing, validateFaq, validateCareers, validateAbout, validatePages, validateTypewriter, validateObjectFieldNames, FIELD_NAME_RE };
