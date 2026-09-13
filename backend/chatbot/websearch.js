/* ============================================================
   NOVIQ CHATBOT — EXTERNAL WEB SEARCH FALLBACK
   ------------------------------------------------------------
   Used ONLY when internal knowledge (intents + FAQs + site
   content) has no useful answer. Two keyless public sources:
     1. DuckDuckGo Instant Answer API (abstracts/definitions)
     2. Wikipedia REST API (AR or EN by language)
   5s timeout per source, in-memory cache (30 min), answers are
   clearly attributed so users know the info came from the web.
   ============================================================ */

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000;
const TIMEOUT_MS = 5000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'noviq-chatbot/1.0 (contact: hello@noviqsolutions.com)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* DuckDuckGo Instant Answers: definitions, abstracts, calculations */
async function duckduckgo(query) {
  const data = await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=noviq`
  );
  if (!data) return null;
  const text = data.AbstractText || data.Answer || data.Definition || '';
  if (!text || text.length < 20) return null;
  return {
    title: data.Heading || query,
    snippet: String(text).slice(0, 420),
    url: data.AbstractURL || data.DefinitionURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    source: 'DuckDuckGo',
  };
}

/* Strip question scaffolding so Wikipedia title-matching works:
   "ما هي عاصمة اليابان" → "عاصمة اليابان", "what is docker" → "docker" */
function cleanQuery(query) {
  return String(query)
    .replace(/[؟?!.]/g, ' ')
    .replace(/^(?:ما ?هي|ما ?هو|من ?هو|من ?هي|ماذا ?عن|ماهي|ماهو|اشرح لي|اشرح|عرف|ما معنى|وش معنى|ايش معنى)\s+/i, '')
    .replace(/^(?:what ?is|what ?are|who ?is|who ?are|define|explain|tell me about|meaning of)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Wikipedia: full-text search, pick the most specific matching title,
   then fetch the REST summary */
async function wikipedia(query, lang) {
  const wiki = lang === 'ar' ? 'ar' : 'en';
  const q = cleanQuery(query) || query;
  const found = await fetchJson(
    `https://${wiki}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`
  );
  const hits = (found && found.query && found.query.search) || [];
  if (!hits.length) return null;

  /* Prefer titles overlapping more query tokens; tie-break on longer
     (more specific) titles so "اليابان" beats the generic "عاصمة". */
  const qTokens = q.split(/\s+/).filter(Boolean);
  let title = hits[0].title;
  let best = -1;
  for (const h of hits) {
    const overlap = qTokens.filter(t => h.title.includes(t)).length;
    const score = overlap * 10 + h.title.length * 0.1;
    if (score > best) { best = score; title = h.title; }
  }

  const summary = await fetchJson(
    `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!summary || !summary.extract || summary.type === 'disambiguation') return null;
  return {
    title: summary.title || title,
    snippet: String(summary.extract).slice(0, 420),
    url: (summary.content_urls && summary.content_urls.desktop && summary.content_urls.desktop.page)
      || `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    source: 'Wikipedia',
  };
}

/*
 * webSearch(query, lang) → { title, snippet, url, source } | null
 * Never throws; returns null when both sources fail.
 */
async function webSearch(query, lang) {
  const key = lang + '|' + query.toLowerCase().trim();
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.value;

  let value = null;
  try {
    /* Wikipedia first for Arabic (DDG abstracts are mostly English) */
    value = lang === 'ar'
      ? (await wikipedia(query, lang)) || (await duckduckgo(query))
      : (await duckduckgo(query)) || (await wikipedia(query, lang));
  } catch {
    value = null;
  }

  if (CACHE.size > 300) {
    const cutoff = Date.now() - CACHE_TTL;
    for (const [k, v] of CACHE) if (v.ts < cutoff) CACHE.delete(k);
  }
  CACHE.set(key, { ts: Date.now(), value });
  return value;
}

module.exports = { webSearch };
