/* ============================================================
   NOVIQ — IMAGE GENERATION SERVICE
   ------------------------------------------------------------
   Single source of truth for everything image-generation related.

   Previously the prompt sanitiser and the Pollinations URL builder
   lived inline in `routes/admin.js` as DEAD CODE (defined, never
   called), while the real `/api/imagegen` route in `routes/public.js`
   called `transformPrompt` / `imageVariants` without importing them
   -> ReferenceError -> HTTP 500 on every request.

   This module is now imported by `routes/public.js` and covered by
   `tests/prompt-builder.test.js`.

   Exports:
     BLOCKED_PROMPTS  - content-policy regex (exposed for tests/docs)
     isBlocked(text)  - generic policy check
     assertAllowed(text) - throws a descriptive Error (used by compose)
     transformPrompt(raw) - sanitize + language-aware suffix
     buildUrl(prompt, size, seed, model) - single Pollinations URL
     imageVariants(prompt, seed) - ordered fallback variants
     compose(config, brief, selections) - prompt-builder config -> prompt
   ============================================================ */

/* ---- Content policy -------------------------------------------------------
   Mirrors the product rule that generated imagery must stay people-free
   unless the user explicitly asks otherwise, plus the standard unsafe
   categories. English + Arabic forms. */
const FEMALE_PROMPTS =
  /\b(?:woman|women|female|girl|girls|lady|ladies)\b|امرأة|امراه|نساء|أنثى|انثى|فتاة|فتاه|بنت|بنات|سيدة|سيده|سيدات/i;

const UNSAFE_PROMPTS =
  /sex|nude|naked|porn|explicit|xxx|graphic|violence|gore|weapon|kill/i;

const BLOCKED_PROMPTS = new RegExp(
  `${UNSAFE_PROMPTS.source.replace(/^\/|\/[a-z]*$/g, '')}|${FEMALE_PROMPTS.source.replace(/^\/|\/[a-z]*$/g, '')}`,
  'i'
);

/** True when the text violates the content policy. */
function isBlocked(text) {
  return BLOCKED_PROMPTS.test(String(text || ''));
}

/**
 * Throw a descriptive Error when the text violates policy.
 * Female-specific requests get their own message so the caller can show
 * something actionable to the user.
 */
function assertAllowed(text) {
  const clean = String(text || '');
  if (FEMALE_PROMPTS.test(clean)) {
    throw new Error('Female image requests are not supported by this image generator.');
  }
  if (UNSAFE_PROMPTS.test(clean)) {
    throw new Error('Prompt rejected: it contains content blocked by the content policy.');
  }
  return clean;
}

/* ---- Prompt sanitising (used by GET /api/imagegen) ----------------------- */

/**
 * Sanitize a raw user prompt and add a language-appropriate style suffix.
 * Returns null when the prompt is empty or blocked.
 */
function transformPrompt(raw) {
  let clean = String(raw || '').trim().slice(0, 200);
  if (!clean) return null;
  if (isBlocked(clean)) return null;
  const hasAr = /[\u0600-\u06FF]/.test(clean);
  let result = hasAr
    ? `${clean}، فن رقمي، موضوع تقني، تصميم عصري`
    : `${clean}, digital art, software tech concept, modern style`;
  while (encodeURIComponent(result).length > 450 && result.length > 0) {
    result = result.slice(0, -5).trim();
  }
  return result;
}

/* ---- Pollinations URL building ------------------------------------------- */

const UPSTREAM = 'https://image.pollinations.ai/prompt/';

/**
 * Build a single Pollinations image URL.
 * `size` is `{ width, height }`, both defaulting to 768.
 */
function buildUrl(prompt, size = {}, seed = 1, model = 'flux') {
  const { width = 768, height = 768 } = size || {};
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: 'true',
  });
  if (model) params.set('model', model);
  return `${UPSTREAM}${encodeURIComponent(String(prompt))}?${params.toString()}`;
}

/**
 * Ordered fallback variants: the proxy tries each in turn and serves the
 * first one that returns a real image. Tuned behaviour — keep the order.
 */
function imageVariants(prompt, seed = 1) {
  return [
    { width: 768, height: 768, seed, model: 'flux', timeout: 60000 },
    { width: 768, height: 768, seed: seed + 1, model: '', timeout: 60000 },
    { width: 768, height: 768, seed: seed + 2, model: 'flux-realism', timeout: 60000 },
    { width: 768, height: 768, seed: seed + 3, model: 'turbo', timeout: 30000 },
    { width: 1024, height: 1024, seed: seed + 4, model: 'flux-anime', timeout: 60000 },
  ].map((v) => ({ url: buildUrl(prompt, v, v.seed, v.model), timeout: v.timeout }));
}

/* ---- Prompt Builder composition (config -> prompt) ----------------------- */

/* Output types that render a product surface rather than a scene. These must
   never contain people, so they get an interface-only instruction. */
const UI_OUTPUTS = new Set(['website', 'mobile-app', 'desktop-app', 'dashboard', 'landing-page']);

/* Prepended fragment per output type, describing the medium precisely. */
const OUTPUT_MEDIA = {
  website: 'Professional desktop website UI/UX screenshot',
  'mobile-app': 'Professional mobile app UI/UX screenshot',
  'desktop-app': 'Professional desktop application UI/UX screenshot',
  dashboard: 'Professional enterprise SaaS dashboard UI screenshot',
  'landing-page': 'Professional landing page UI/UX screenshot',
};

const INTERFACE_ONLY =
  'Interface-only composition: render the product surface itself and nothing else';
const PEOPLE_FREE_NEGATIVE =
  'Do not include women, girls, people, or human figures anywhere in the frame.';

function groupOf(config, groupId) {
  return (config.groups || []).find((g) => g.id === groupId);
}

/** Resolve the requested option ids for a group, dropping unknown ones. */
function selectedIds(config, groupId, selections) {
  const group = groupOf(config, groupId);
  if (!group) return [];
  const raw = selections ? selections[groupId] : undefined;
  const wanted = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return wanted.filter((id) => (group.options || []).some((o) => o.id === id));
}

/** Fragments for the selected option ids of a group, in option order. */
function fragmentsFor(config, groupId, ids) {
  const group = groupOf(config, groupId);
  if (!group) return [];
  return ids
    .map((id) => (group.options || []).find((o) => o.id === id))
    .map((o) => (o && o.fragment ? o.fragment.trim() : ''))
    .filter(Boolean);
}

function render(template, tokens) {
  return String(template || '').replace(/{{\s*([a-z]+)\s*}}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  );
}

/**
 * Compose a full image prompt from a prompt-builder config, a user brief and
 * a set of selections.
 *
 * @param {object} config     prompt-builder config (see config/prompt-builder.js)
 * @param {string} brief      the user's request
 * @param {object} selections `{ output:[id], industry:[id], palette:[id], style:[id], presentation:[id] }`
 * @returns {{ prompt:string, isInterface:boolean, fragments:string[], negative:string }}
 * @throws  {Error} when the brief is empty or violates the content policy
 */
function compose(config, brief, selections = {}) {
  const input = String(brief || '').trim();
  if (!input) throw new Error('A brief is required to compose an image prompt.');
  assertAllowed(input);

  const templates = (config && config.templates) || {};
  const outputIds = selectedIds(config, 'output', selections);
  if (outputIds.length === 0) {
    throw new Error('Select at least one output type to compose an image prompt.');
  }

  const isInterface = outputIds.some((id) => UI_OUTPUTS.has(id));
  const media = outputIds.map((id) => OUTPUT_MEDIA[id]).filter(Boolean);

  const fragments = [
    ...media,
    ...fragmentsFor(config, 'output', outputIds),
    ...fragmentsFor(config, 'industry', selectedIds(config, 'industry', selections)),
    ...fragmentsFor(config, 'palette', selectedIds(config, 'palette', selections)),
    ...fragmentsFor(config, 'style', selectedIds(config, 'style', selections)),
    ...fragmentsFor(config, 'presentation', selectedIds(config, 'presentation', selections)),
    ...(isInterface ? [INTERFACE_ONLY] : []),
  ];

  const negative = [
    templates.negative || '',
    ...(isInterface ? [PEOPLE_FREE_NEGATIVE] : []),
  ]
    .filter(Boolean)
    .join(' ');

  const tokens = {
    input,
    base: render(templates.base, { input }),
    fragments: fragments.join(', '),
    negative,
  };

  const finalTemplate = templates.final || '{{base}}\n\nCreate {{fragments}}. {{negative}}';
  return { prompt: render(finalTemplate, tokens), isInterface, fragments, negative };
}

module.exports = {
  BLOCKED_PROMPTS,
  FEMALE_PROMPTS,
  UNSAFE_PROMPTS,
  isBlocked,
  assertAllowed,
  transformPrompt,
  buildUrl,
  imageVariants,
  compose,
  UI_OUTPUTS,
};
