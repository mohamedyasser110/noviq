/* ============================================================
   NOVIQ CHATBOT — BM25 SEARCH INDEX
   ------------------------------------------------------------
   Dependency-free BM25 ranking over two corpora:
     1. FAQS (knowledge.js) — bilingual Q&A documents
     2. LIVE site content (SQLite) — services, industries,
        projects, process, why, testimonials, stack
   Features: field weighting (title > tags > body), typo-tolerant
   query expansion via vocabulary nearest-match, lazy reindexing
   so admin content edits appear within 5 minutes.
   ============================================================ */

const { getContent } = require('../content-store');
const { FAQS } = require('./knowledge');
const { contentTokens, levenshtein } = require('./normalize');
const { getArabicRaw } = require('./ar-content');

const K1 = 1.4;          // BM25 term-frequency saturation
const B = 0.75;          // BM25 length normalization
const REINDEX_MS = 5 * 60 * 1000;

let index = null;
let indexedAt = 0;

/* ---- Document builders ---- */

function faqDocs() {
  const docs = [];
  for (const f of FAQS) {
    docs.push({
      type: 'faq', id: 'faq:' + f.id, link: f.link || '#/faq', faq: f,
      title: { en: f.q.en, ar: f.q.ar },
      body: { en: f.a.en, ar: f.a.ar },
      tags: f.tags,
    });
  }
  return docs;
}

function contentDocs() {
  const c = getContent();
  const ar = getArabicRaw() || {};
  const docs = [];
  /* Pair each English item with its Arabic translation by index */
  const push = (type, link, key, i, item, body, tags) => {
    const arItem = (Array.isArray(ar[key]) ? ar[key][i] : null) || {};
    docs.push({
      type, id: `${type}:${docs.length}`, link,
      title: { en: item.title || item.name || '', ar: arItem.title || arItem.name || item.title || item.name || '' },
      body: { en: body || '', ar: (arItem.desc || arItem.quote || body || '') },
      tags: tags || '',
    });
  };

  (c.services || []).forEach((s, i) => push('service', '#/services', 'services', i, s, s.desc, 'service خدمة'));
  (c.industries || []).forEach((x, i) => push('industry', '#/industries', 'industries', i, x, x.desc, 'industry قطاع'));
  (c.projects || []).forEach((p, i) => push('project', '#/portfolio', 'projects', i, p, `${p.tag || ''} ${p.desc || ''}`, 'project case study مشروع'));
  (c.process || []).forEach((p, i) => push('process', '#/about', 'process', i, p, p.desc, 'process منهجية'));
  (c.why || []).forEach((w, i) => push('why', '#/about', 'why', i, w, w.desc, 'why us لماذا'));
  (c.testimonials || []).forEach((t, i) => push('testimonial', '#/portfolio', 'testimonials', i, t, `${t.quote || ''} ${t.role || ''}`, 'review رأي عميل'));
  if (Array.isArray(c.stack) && c.stack.length) {
    docs.push({
      type: 'tech', id: 'tech:0', link: '#/services',
      title: { en: 'Technology Stack', ar: 'التقنيات المستخدمة' },
      body: { en: c.stack.join(' '), ar: c.stack.join(' ') },
      tags: 'technology تقنيات',
    });
  }
  return docs;
}

/* ---- Index construction ---- */

function buildIndex() {
  const docs = [...faqDocs(), ...contentDocs()];
  const vocab = new Map();   // term -> doc frequency
  let totalLen = 0;

  for (const doc of docs) {
    /* Weighted term bag: title x3, tags x2, body x1 (both languages).
       Stopwords filtered so "ما هي" / "what is" never dominate titles. */
    const bag = new Map();
    const add = (text, weight) => {
      for (const t of contentTokens(text)) bag.set(t, (bag.get(t) || 0) + weight);
    };
    add(doc.title.en, 3); add(doc.title.ar, 3);
    add(doc.tags, 2);
    add(doc.body.en, 1); add(doc.body.ar, 1);

    doc.terms = bag;
    doc.len = [...bag.values()].reduce((a, b) => a + b, 0);
    totalLen += doc.len;
    for (const term of bag.keys()) vocab.set(term, (vocab.get(term) || 0) + 1);
  }

  index = {
    docs,
    vocab,
    avgLen: docs.length ? totalLen / docs.length : 1,
    vocabList: [...vocab.keys()],
  };
  indexedAt = Date.now();
}

function ensureIndex() {
  if (!index || Date.now() - indexedAt > REINDEX_MS) buildIndex();
  return index;
}

/* Typo tolerance: map unknown query tokens to nearest vocabulary term */
function expandToken(token, idx) {
  if (idx.vocab.has(token) || token.length < 4) return token;
  const maxDist = token.length >= 7 ? 2 : 1;
  let best = null;
  let bestDist = maxDist + 1;
  for (const term of idx.vocabList) {
    if (Math.abs(term.length - token.length) > maxDist) continue;
    const d = levenshtein(token, term, maxDist);
    if (d < bestDist) { bestDist = d; best = term; if (d === 0) break; }
  }
  return best || token;
}

function idf(term, idx) {
  const df = idx.vocab.get(term) || 0;
  return Math.log(1 + (idx.docs.length - df + 0.5) / (df + 0.5));
}

/* ---- Public search ---- */

function search(query, lang, limit = 5) {
  const idx = ensureIndex();
  const qTokens = [...new Set(contentTokens(query).map(t => expandToken(t, idx)))];
  if (!qTokens.length) return [];

  const scored = [];
  for (const doc of idx.docs) {
    let score = 0;
    for (const term of qTokens) {
      const tf = doc.terms.get(term);
      if (!tf) continue;
      score += idf(term, idx) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.len / idx.avgLen));
    }
    if (score > 0) scored.push({ doc, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const L = lang === 'ar' ? 'ar' : 'en';
  return scored.slice(0, limit).map(({ doc, score }) => ({
    type: doc.type,
    title: doc.title[L] || doc.title.en,
    snippet: String(doc.body[L] || doc.body.en || '').slice(0, 220),
    link: doc.link,
    score: Math.round(score * 100) / 100,
    faq: doc.faq || null,
  }));
}

function indexStats() {
  const idx = ensureIndex();
  return { documents: idx.docs.length, vocabulary: idx.vocab.size, faqs: FAQS.length };
}

module.exports = { search, indexStats, buildIndex };
