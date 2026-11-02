/* ============================================================
   NOVIQ — Pages visibility (server-side)
   ------------------------------------------------------------
   Single source of truth for which site pages are live.
   The backend stores `pages` in SQLite (key `pages`), edited
   from the admin dashboard (Site Content → Pages / Visibility).
   Shape: { [slug]: { enabled: boolean, labelEn?, labelAr?, note? } }

   The build MUST NOT break when the API is offline — every
   failure degrades to the static defaults below (ai-lab closed,
   everything else open).
   ============================================================ */

import { api } from '@/lib/api-client';

export interface PageEntry {
  enabled: boolean;
  labelEn?: string;
  labelAr?: string;
  note?: string;
}

export type PagesMap = Record<string, PageEntry>;

/* Static defaults — mirror of the DB seed in backend/db/init.js.
   ai-lab is CLOSED by default (retired from the site). */
export const DEFAULT_PAGES: PagesMap = {
  home: { enabled: true, labelEn: 'Home', labelAr: 'الرئيسية' },
  services: { enabled: true, labelEn: 'Services', labelAr: 'الخدمات' },
  industries: { enabled: true, labelEn: 'Industries', labelAr: 'القطاعات' },
  solutions: { enabled: true, labelEn: 'Solutions', labelAr: 'الحلول' },
  portfolio: { enabled: true, labelEn: 'Portfolio', labelAr: 'أعمالنا' },
  team: { enabled: true, labelEn: 'Our Team', labelAr: 'فريقنا' },
  about: { enabled: true, labelEn: 'About', labelAr: 'من نحن' },
  contact: { enabled: true, labelEn: 'Contact', labelAr: 'تواصل معنا' },
  pricing: { enabled: true, labelEn: 'Pricing', labelAr: 'الأسعار' },
  resources: { enabled: true, labelEn: 'Resources', labelAr: 'الموارد' },
  careers: { enabled: true, labelEn: 'Careers', labelAr: 'الوظائف' },
  faq: { enabled: true, labelEn: 'FAQ', labelAr: 'الأسئلة الشائعة' },
  why: { enabled: true, labelEn: 'Why Noviq', labelAr: 'لماذا نوفيك' },
  toolkit: { enabled: true, labelEn: 'Toolkit', labelAr: 'الأدوات' },
  builder: { enabled: true, labelEn: 'Solution Builder', labelAr: 'منشئ الحلول' },
  resource: { enabled: true, labelEn: 'API Docs', labelAr: 'وثائق API' },
  clients: { enabled: true, labelEn: 'Our Clients', labelAr: 'عملاؤنا' },
  'ai-lab': { enabled: false, labelEn: 'AI Lab', labelAr: 'مختبر الذكاء الاصطناعي', note: 'Closed — retired from the site' },
};

function normalize(raw: unknown): PagesMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_PAGES;
  const out: PagesMap = { ...DEFAULT_PAGES };
  for (const [slug, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.enabled !== 'boolean') continue;
    out[slug] = {
      enabled: e.enabled,
      ...(typeof e.labelEn === 'string' ? { labelEn: e.labelEn } : {}),
      ...(typeof e.labelAr === 'string' ? { labelAr: e.labelAr } : {}),
      ...(typeof e.note === 'string' && e.note ? { note: e.note } : {}),
    };
  }
  return out;
}

export async function getPagesMap(): Promise<PagesMap> {
  try {
    const data = await api.content.pages();
    if (!data || typeof data !== 'object') throw new Error('empty');
    return normalize(data);
  } catch {
    return DEFAULT_PAGES;
  }
}

/** True when the page is live. Unknown slugs default to open. */
export async function isPageEnabled(slug: string): Promise<boolean> {
  const map = await getPagesMap();
  const entry = map[slug];
  if (!entry) return true;
  return entry.enabled === true;
}

export default getPagesMap;
