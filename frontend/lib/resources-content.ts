/* ============================================================
   NOVIQ — Resources content (server-side)
   ------------------------------------------------------------
   Single source of truth for the /resources page is the ADMIN
   DASHBOARD: the backend stores `content.resources` in SQLite and
   serves it on the public endpoint GET /api/content/resources
   (backend/routes/public.js).

   Shape (mirrors validateResources in backend/routes/_shared.js):
     {
       hero: { eyebrow, title, description },        // localized pairs
       tabs:  [{ id, label, active }],
       items: { [tabId]: [{ id, title, excerpt, content, cat,
                            image, file, link, status, featured }] }
     }

   Design rules (identical to lib/team-content.ts):
     - Only `status: 'published'` items are shown; `featured` first.
     - The build MUST NOT break when the API is offline, so every failure
       degrades to a small static seed with live: false.
     - Tabs with no published items are dropped — an empty filter tab is
       worse than no tab.
     - `revalidate` keeps admin edits visible without a redeploy.
   ============================================================ */

import { api } from '@/lib/api-client';

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface ResourceItem {
  id: string;
  /** Which tab this item belongs to (the key it was stored under). */
  section: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  image: string;
  file: string;
  link: string;
  /** Shown on the card when set. */
  date: string;
  /** Shown on the card when set. */
  author: string;
  featured: boolean;
}

export interface ResourceSection {
  id: string;
  label: string;
  /** Lucide name chosen in the admin; empty falls back to a convention. */
  icon: string;
  items: ResourceItem[];
}

export interface ResourcesContent {
  eyebrow: string;
  title: string;
  description: string;
  sections: ResourceSection[];
  /** Featured items from EVERY section, de-duplicated. */
  featured: ResourceItem[];
  /** Total published items across every visible section. */
  total: number;
  /** True when the live API answered and the UI shows CMS content. */
  live: boolean;
}

type Locale = 'en' | 'ar';

/** Read a localized pair, falling back to the other language, then ''. */
function pick(value: unknown, locale: Locale): string {
  if (!value || typeof value !== 'object') return '';
  const pair = value as Partial<Record<Locale, unknown>>;
  const primary = pair[locale];
  if (typeof primary === 'string' && primary.trim()) return primary;
  const secondary = locale === 'en' ? pair.ar : pair.en;
  return typeof secondary === 'string' ? secondary : '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Uploaded media lives on the frontend under /images/... . The backend
 * validator already restricts `image`/`file` to https(s) or an
 * /images|/assets path and rejects `..`; this re-checks locally so a
 * hand-edited database row can never turn into an arbitrary path.
 */
function normalizeMedia(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (/(?:^|\/)\.\.(?:\/|$)/.test(withSlash)) return '';
  return /^(\/(?:images|assets)\/)/i.test(withSlash) ? withSlash : '';
}

/** External links only — the same allowlist the backend enforces. */
function normalizeLink(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  return /^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i.test(raw) ? raw : '';
}

export async function getResourcesContent(locale: string): Promise<ResourcesContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const fallbackHero = {
    eyebrow: loc === 'ar' ? 'مركز المعرفة' : 'Knowledge Hub',
    title: loc === 'ar' ? 'المصادر والرؤى' : 'Resources & Insights',
    description:
      loc === 'ar'
        ? 'تابع أحدث أخبارنا ومقالاتنا وأبحاثنا وأدلتنا التقنية.'
        : 'Stay ahead with our latest news, articles, whitepapers, and technical guides.',
  };

  try {
    const data = await api.content.resources();

    if (!data || typeof data !== 'object') throw new Error('empty payload');

    const hero = (data.hero ?? {}) as Record<string, unknown>;
    const rawTabs = Array.isArray(data.tabs) ? data.tabs : [];
    const itemsByTab = (data.items ?? {}) as Record<string, unknown>;

    const sections: ResourceSection[] = rawTabs
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      /* `active: false` in the admin means "hide this section from visitors".
         The site used to render every section regardless, so the admin toggle
         did nothing. */
      .filter((t) => t.active !== false)
      .map((t) => {
        const id = str(t.id);
        const rawItems = Array.isArray(itemsByTab[id]) ? (itemsByTab[id] as unknown[]) : [];

        const items: ResourceItem[] = rawItems
          .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
          .filter((it) => (it.status ?? 'published') === 'published')
          .map((it, i) => ({
            id: str(it.id) || `${id}-item-${i}`,
            section: id,
            title: pick(it.title, loc),
            excerpt: pick(it.excerpt, loc),
            body: pick(it.content, loc),
            category: pick(it.cat, loc),
            image: normalizeMedia(it.image),
            file: normalizeMedia(it.file),
            link: normalizeLink(it.link),
            date: str(it.date),
            author: str(it.author),
            featured: it.featured === true,
          }))
          /* An item with no title in ANY language is unusable. */
          .filter((it) => it.title.length > 0)
          /* featured first, then keep the admin's ordering (stable sort) */
          .sort((a, b) => Number(b.featured) - Number(a.featured));

        return { id, label: pick(t.label, loc), icon: str(t.icon), items };
      })
      .filter((s) => s.id && s.label)
      /* A filter tab with nothing behind it is worse than no tab at all. */
      .filter((s) => s.items.length > 0);

    /* Featured was previously taken from the first section only, so a
       featured item in any other section got no special treatment — and the
       one in the first section was rendered twice (here and in its grid). */
    const featured: ResourceItem[] = sections
      .flatMap((s) => s.items)
      .filter((i) => i.featured);

    /* Keep the sections' own counts honest by not repeating featured items. */
    const sectionsWithoutFeatured: ResourceSection[] = sections.map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.featured),
    }));

    /* An empty list is a legitimate state — the admin can hide every section.
       That is NOT the same as the CMS being unreachable, so it must not fall
       through to the catch below and accuse the dashboard of being offline. */
    return {
      eyebrow: pick(hero.eyebrow, loc) || fallbackHero.eyebrow,
      title: pick(hero.title, loc) || fallbackHero.title,
      description: pick(hero.description, loc) || fallbackHero.description,
      sections: sectionsWithoutFeatured,
      featured,
      total: sections.reduce((n, s) => n + s.items.length, 0),
      live: true,
    };
  } catch {
    /* API offline / malformed — degrade to an honest empty state rather than
       inventing content, and let the page say the CMS could not be reached. */
    return {
      ...fallbackHero,
      sections: [],
      featured: [],
      total: 0,
      live: false,
    };
  }
}

export default getResourcesContent;
