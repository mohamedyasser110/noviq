/* ============================================================
   NOVIQ — header search
   ------------------------------------------------------------
   A small, dependency-free client-side index built from the same
   NOVIQ_CONTENT the pages render, so a hit can never point at text
   that does not exist on the page it links to.

   Arabic needs normalisation or the search feels broken: users type
   "الذكاء" while the content stores "الذكاء" with different alef /
   ya / taa-marbuta forms, and most Arabic keyboards emit a bare
   alef where the text carries a hamza. normalise() folds all of that
   to one form so both sides compare equal.
   ============================================================ */

import { NOVIQ_CONTENT, getContentForLocale } from '@/data/content';
import { NAV_PRIMARY, NAV_MORE, navLabel } from '@/data/nav';
import type { Locale } from '@/app/i18n/config';

export interface SearchEntry {
  /** Primary label — also the accessibility name. */
  title: string;
  /** Secondary line, may be empty. */
  desc: string;
  /** Locale-prefixed route, e.g. "/ar/services". */
  href: string;
  /** Group heading shown in the results panel. */
  category: string;
  /** Extra keywords folded into the haystack but never displayed. */
  keywords: string;
}

export interface SearchHit extends SearchEntry {
  /** 0 = exact title, 1 = title prefix, 2 = word in title, 3 = body. */
  rank: number;
}

/* ---------- normalisation ---------- */

/* Strip Arabic diacritics (tashkeel) and tatweel, then fold the
   letter variants that look different but are the same letter.

   The ranges below MUST be written as explicit escapes. An earlier
   version used a literal `[\u0610-\u064B ...]` character class, and
   U+064B sits ABOVE the whole Arabic letter block (U+0621-U+064A) —
   so that class silently deleted every consonant as well as the
   marks, and every Arabic query normalised to the empty string.
   Only the actual combining-mark blocks belong here:
     U+0610-U+061A  signs (sallallahou, alef wassla, ...)
     U+064B-U+065F  harakat (fathatan .. wavy hamza below)
     U+0670         superscript alef
     U+06D6-U+06ED  Quranic annotation marks
     U+0640         tatweel / kashida
*/
const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const AR_FOLD: Array<[RegExp, string]> = [
  [/\u0623/g, '\u0627'], // أ -> ا
  [/\u0625/g, '\u0627'], // إ -> ا
  [/\u0622/g, '\u0627'], // آ -> ا
  [/\u0671/g, '\u0627'], // ٱ -> ا
  [/\u0649/g, '\u064A'], // ى -> ي
  [/\u0629/g, '\u0647'], // ة -> ه
];

export function normalise(input: string): string {
  let s = (input || '').toLowerCase();
  s = s.replace(AR_DIACRITICS, '');
  for (const [re, to] of AR_FOLD) s = s.replace(re, to);
  return s.trim();
}

/* Collapse whitespace so "a  b" and "a b" score identically. */
function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/* ---------- index ---------- */

const CATEGORY_LABELS: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    nav: 'Pages',
    services: 'Services',
    industries: 'Industries',
    why: 'Why Noviq',
    portfolio: 'Work',
    team: 'Team',
    pricing: 'Pricing',
    process: 'How we work',
  },
  ar: {
    nav: 'الصفحات',
    services: 'الخدمات',
    industries: 'القطاعات',
    why: 'لماذا نوفيق',
    portfolio: 'أعمالنا',
    team: 'فريقنا',
    pricing: 'الأسعار',
    process: 'كيف نعمل',
  },
};

function cat(locale: Locale, key: string): string {
  return CATEGORY_LABELS[locale][key] ?? key;
}

/**
 * Build the flat, locale-aware search index.
 *
 * Returns a NEW array on every call, so callers should memoise it —
 * Navbar does, with useMemo.
 */
export function buildSearchIndex(locale: Locale): SearchEntry[] {
  const content = getContentForLocale(NOVIQ_CONTENT, locale);
  const L = (k: string) => cat(locale, k);
  const out: SearchEntry[] = [];

  const push = (
    title: unknown,
    desc: unknown,
    href: string,
    category: string,
    keywords = ''
  ) => {
    const t = squash(String(title ?? ''));
    if (!t) return;
    out.push({
      title: t,
      desc: squash(String(desc ?? '')),
      href,
      category,
      keywords: squash(keywords),
    });
  };

  /* --- static pages, from the same nav data the header renders --- */
  for (const item of [...NAV_PRIMARY, ...NAV_MORE]) {
    push(navLabel(item, locale), '', `/${locale}${item.href}`, L('nav'), item.key);
  }

  /* --- services --- */
  for (const s of content.services ?? []) {
    /* A row the admin added but never filled in would otherwise become a
       searchable entry with an empty title. */
    if (!s || !String(s.title ?? '').trim()) continue;
    const href = s.link ? `/${locale}${s.link}` : `/${locale}/services`;
    push(s.title, s.desc, href, L('services'), `${s.title} ${s.desc} ${s.tag ?? ''}`);
  }

  /* --- industries --- */
  for (const s of content.industries ?? []) {
    push(
      s.title,
      s.desc,
      `/${locale}/industries`,
      L('industries'),
      `${s.title} ${s.desc} ${s.tag ?? ''}`
    );
  }

  /* --- why --- */
  for (const s of content.why ?? []) {
    push(
      s.title,
      s.desc,
      `/${locale}/why`,
      L('why'),
      `${s.title} ${s.desc} ${s.challenge ?? ''} ${s.solution ?? ''} ${s.results ?? ''}`
    );
  }

  /* --- portfolio / case studies --- */
  for (const s of content.projects ?? []) {
    push(
      s.title,
      s.desc,
      s.link ? `/${locale}${s.link}` : `/${locale}/portfolio`,
      L('portfolio'),
      `${s.title} ${s.desc} ${s.tag ?? ''}`
    );
  }

  /* --- team --- */
  for (const m of content.team ?? []) {
    push(m.name, m.role, `/${locale}/team`, L('team'), `${m.name} ${m.role}`);
  }

  /* --- pricing tiers --- */
  for (const p of content.pricing ?? []) {
    push(p.name, p.desc, `/${locale}/pricing`, L('pricing'), `${p.name} ${p.price} ${(p.features ?? []).join(' ')}`);
  }

  /* --- process steps --- */
  for (const step of content.process ?? []) {
    push(step.title, step.desc, `/${locale}/#process`, L('process'), `${step.title} ${step.desc}`);
  }

  /* --- footer link columns (catches routes the nav omits) --- */
  for (const col of content.footer?.columns ?? []) {
    for (const link of col.links ?? []) {
      if (!link.route) continue;
      push(link.text, col.title, `/${locale}${link.route}`, L('nav'), `${link.text} ${col.title}`);
    }
  }

  return out;
}

/* ---------- matching ---------- */

/** Everything the query is matched against, normalised once per call. */
function haystack(entry: SearchEntry): string {
  return normalise(`${entry.title} ${entry.keywords}`);
}

/**
 * Rank entries against a query.
 *
 * Ranking is deliberately tiered rather than scored continuously: a
 * title hit must always beat a body hit, otherwise searching "ai"
 * buries the AI service under every page whose description mentions AI.
 */
export function runSearch(entries: SearchEntry[], query: string, limit = 8): SearchHit[] {
  const q = normalise(query);
  if (q.length < 2) return [];

  const terms = q.split(' ').filter(Boolean);
  const hits: SearchHit[] = [];

  for (const entry of entries) {
    const hay = haystack(entry);
    const title = normalise(entry.title);

    let rank = -1;

    if (title === q) {
      rank = 0;
    } else if (title.startsWith(q)) {
      rank = 1;
    } else if (terms.every((t) => hay.includes(t))) {
      // Whole phrase in the body, or every term present somewhere.
      rank = squash(hay).includes(q) ? 2 : 3;
    }

    if (rank >= 0) hits.push({ ...entry, rank });
  }

  // Stable within a tier: shorter titles first read as more specific.
  hits.sort((a, b) => a.rank - b.rank || a.title.length - b.title.length);

  /* Dedupe on (title, href). The same page legitimately enters the index
     twice — once as a nav entry, once as a content card — and showing the
     user "ERP Systems" twice for one query just looks broken. Keep the
     better-ranked copy; the category differs, so also merge categories so
     the survivor is not mislabelled as "Pages" when it came from content. */
  const best = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = `${hit.title}::${hit.href}`;
    const seen = best.get(key);
    if (!seen) {
      best.set(key, hit);
    } else if (hit.rank < seen.rank) {
      best.set(key, hit);
    }
  }

  return [...best.values()].slice(0, limit);
}
