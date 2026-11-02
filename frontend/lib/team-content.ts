/* ============================================================
   NOVIQ — Team content (server-side)
   ------------------------------------------------------------
   Single source of truth for the /team page is the ADMIN DASHBOARD:
   the backend stores `content.team` in SQLite and serves it on the
   public endpoint GET /api/content/team (backend/routes/public.js).

   Shape (mirrors validateTeam in backend/routes/_shared.js):
     { hero: { eyebrow, title, description }, members: [...] }
   where every text field is a localized pair { en, ar }.

   Design rules:
     - Only `status: 'published'` members are shown; `featured` first.
     - The build MUST NOT break when the API is offline, so every
       failure degrades to the static seed list from data/content.ts.
     - `revalidate` keeps admin edits visible without a redeploy.
   ============================================================ */

import { api } from '@/lib/api-client';
import { getTeam as getStaticTeam } from '@/lib/content-store';

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  email: string;
  portfolio: string;
  cv: string;
  linkedin: string;
  github: string;
  facebook: string;
  featured: boolean;
}

export interface TeamContent {
  eyebrow: string;
  title: string;
  description: string;
  members: TeamMember[];
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

/** Uploaded media lives on the frontend at /images/uploads/... */
function normalizePhoto(photo: unknown): string {
  const raw = typeof photo === 'string' ? photo.trim() : '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  /* Only allow the known media roots — never an arbitrary path. */
  return /^(\/(?:images|assets)\/)/i.test(withSlash) ? withSlash : '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function getTeamContent(locale: string): Promise<TeamContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const fallbackHero = {
    eyebrow: loc === 'ar' ? 'فريقنا' : 'Our Team',
    title: loc === 'ar' ? 'تعرف على عقول نوفيك' : 'Meet the Minds Behind Noviq',
    description:
      loc === 'ar'
        ? 'مهندسون ومصممون واستراتيجيون يصنعون برمجيات ذات أثر. تصفح الملفات الشخصية والأعمال والسير الذاتية.'
        : 'Engineers, designers, and strategists crafting software that matters. View profiles, portfolios, and CVs.',
  };

  try {
    const data = await api.content.team();

    if (!data || typeof data !== 'object') throw new Error('empty payload');

    const hero = (data.hero ?? {}) as Record<string, unknown>;
    const rawMembers = Array.isArray(data.members) ? data.members : [];

    const members: TeamMember[] = rawMembers
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .filter((m) => (m.status ?? 'published') === 'published')
      .map((m, i) => ({
        id: str(m.id) || `member-${i}`,
        name: pick(m.name, loc),
        role: pick(m.role, loc),
        bio: pick(m.bio, loc),
        photo: normalizePhoto(m.photo),
        email: str(m.email),
        portfolio: str(m.portfolio),
        cv: str(m.cv),
        linkedin: str(m.linkedin),
        github: str(m.github),
        facebook: str(m.facebook),
        featured: m.featured === true,
      }))
      /* A member with no name in ANY language is unusable in the UI. */
      .filter((m) => m.name.length > 0)
      /* featured first, then keep the admin's ordering (stable sort). */
      .sort((a, b) => Number(b.featured) - Number(a.featured));

    if (members.length === 0) throw new Error('no published members');

    return {
      eyebrow: pick(hero.eyebrow, loc) || fallbackHero.eyebrow,
      title: pick(hero.title, loc) || fallbackHero.title,
      description: pick(hero.description, loc) || fallbackHero.description,
      members,
      live: true,
    };
  } catch {
    /* API offline / empty / malformed — degrade to the static seed. */
    const statics = getStaticTeam();
    return {
      ...fallbackHero,
      members: statics.map((m, i) => ({
        id: `static-${i}`,
        name: loc === 'ar' ? (m.roleAr || m.role) : m.name,
        role: loc === 'ar' ? m.role : m.role,
        bio: '',
        photo: m.img || '',
        email: '',
        portfolio: '',
        cv: '',
        linkedin: '',
        github: '',
        facebook: '',
        featured: false,
      })),
      live: false,
    };
  }
}

export default getTeamContent;
