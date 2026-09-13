/* ============================================================
   NOVIQ CHATBOT — TEXT NORMALIZATION (AR + EN)
   ------------------------------------------------------------
   Shared, dependency-free text utilities used by the intent
   matcher and the BM25 search index:
   - language detection
   - Arabic normalization (diacritics, tatweel, hamza forms)
   - elongation collapsing (مرحبااااا → مرحبا)
   - Arabic prefix/suffix stripping (light stemming)
   - light English stemming (plurals, -ing, -ed)
   - bounded Levenshtein with early exit
   ============================================================ */

const AR_CHARS = /[\u0600-\u06FF]/;

function detectLanguage(text) {
  return AR_CHARS.test(String(text || '')) ? 'ar' : 'en';
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')  // Arabic diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(.)\1{2,}/g, '$1')                  // collapse elongations
    .replace(/[^\w\s\u0600-\u06FF$.#/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Arabic prefixes: keep root >= 3 chars so short words stay intact */
const AR_PREFIXES = ['وبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ف'];
/* Arabic suffixes (possessives/plurals) — conservative list */
const AR_SUFFIXES = ['كم', 'كن', 'هم', 'هن', 'نا', 'ها', 'ات', 'ون', 'ين', 'ك', 'ه', 'ي'];

function stripArabic(token) {
  let t = token;
  for (const p of AR_PREFIXES) {
    if (t.length - p.length >= 3 && t.startsWith(p)) { t = t.slice(p.length); break; }
  }
  for (const s of AR_SUFFIXES) {
    if (t.length - s.length >= 3 && t.endsWith(s)) { t = t.slice(0, -s.length); break; }
  }
  return t;
}

/* Light English stemming: safest transformations only */
function stripEnglish(token) {
  let t = token;
  if (t.length >= 5 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length >= 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length >= 5 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length >= 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length >= 4 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function stem(token) {
  return AR_CHARS.test(token) ? stripArabic(token) : stripEnglish(token);
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean).map(stem);
}

/* Raw tokens (normalized but not stemmed) — used for display/snippets */
function tokenizeRaw(text) {
  return normalize(text).split(' ').filter(Boolean);
}

/* ---- Stopwords: filtered ONLY in BM25 search (index + query).
   Intent matching keeps them because keyword phrases like
   "who are you" / "ما هي خدماتكم" rely on them. ---- */
const STOPWORDS = new Set([
  /* Arabic question/function words (post-normalization, post-stemming forms) */
  'ما', 'هي', 'هو', 'هل', 'في', 'من', 'الي', 'علي', 'عن', 'مع', 'او', 'ثم',
  'لو', 'ان', 'انه', 'انها', 'كيف', 'متي', 'اين', 'ليش', 'ليه', 'لماذا',
  'ايش', 'وش', 'شو', 'هم', 'انا', 'نحن', 'انت', 'انتم', 'يا', 'هذا', 'هذه',
  'ذلك', 'تلك', 'التي', 'الذي', 'لدي', 'عند', 'كل', 'بعض', 'غير', 'بين',
  /* English */
  'what', 'is', 'are', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at',
  'do', 'doe', 'did', 'you', 'your', 'we', 'our', 'i', 'my', 'how', 'can',
  'could', 'would', 'will', 'who', 'where', 'when', 'why', 'and', 'or',
  'with', 'about', 'me', 'us', 'they', 'them', 'it', 'this', 'that', 'these',
  'those', 'be', 'been', 'have', 'ha', 'had', 'there', 'here', 'so', 'if',
]);

/* Stemmed tokens minus stopwords — for search indexing and queries.
   Falls back to unfiltered tokens when everything is a stopword. */
function contentTokens(text) {
  const all = tokenize(text);
  const filtered = all.filter(t => !STOPWORDS.has(t));
  return filtered.length ? filtered : all;
}

/* Bounded Levenshtein distance with early exit */
function levenshtein(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/* 1 = exact, 0.7 = close typo, 0 = no match. Short words stay strict. */
function fuzzyTokenScore(token, word) {
  if (token === word) return 1;
  if (word.length < 4 || token.length < 3) return 0;
  const maxDist = word.length >= 7 ? 2 : 1;
  return levenshtein(token, word, maxDist) <= maxDist ? 0.7 : 0;
}

module.exports = {
  AR_CHARS,
  detectLanguage,
  normalize,
  stem,
  tokenize,
  tokenizeRaw,
  contentTokens,
  STOPWORDS,
  levenshtein,
  fuzzyTokenScore,
};
