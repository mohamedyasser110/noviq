/* ============================================================
   NOVIQ — Home content (server-side, aggregated)
   ------------------------------------------------------------
   One fetch (`GET /api/content/home`) feeds the ENTIRE landing
   page. Every string resolves with the rule:
     CMS value (admin dashboard)  →  i18n dictionary  →  ''
   so an admin edit is live on the next request, and an offline
   API degrades to the exact copy the site shipped with.

   Array items (services/industries/stats/...) keep their fixed
   icons. Services additionally pass the CMS `icon` name through
   (HomeItem.icon) so the grid can key glyphs AND detail-page
   slugs off identity instead of a list index; industries and
   process still resolve titles positionally.

   Two compatibility facts drive the shape of this file:
   1. The admin OBJECT editor stores Arabic in a SIBLING `<field>Ar` key
      (hero.titleLeadAr, servicesHeader.descAr, …) — see data/content.ts —
      while the *pair* modules (team/resources/about/…) use `{ en, ar }`.
      `lpick()` below reads the `Ar` sibling first, which is what makes an
      admin's Arabic actually reach the AR page.
   2. Translations now prefer a live, admin-editable dictionary
      (lib/i18n-runtime.ts) and fall back to the bundled i18n/*.json. The
      bundled files stay authoritative for the build — the runtime object is
      strictly additive and may be absent.
   ============================================================ */

import { api } from '@/lib/api-client';
import { normalizeImageSrcOrEmpty } from '@/lib/media';
import enMessages from '@/i18n/en.json';
import arMessages from '@/i18n/ar.json';
import { NOVIQ_CONTENT } from '@/data/content';
import { getRuntimeMessages, lookupMessages, type RuntimeMessages } from '@/lib/i18n-runtime';

type Locale = 'en' | 'ar';
type Dict = Record<string, unknown>;

/* Dotted lookup across BOTH dictionary layers: the live CMS dictionary first
   (so an admin rewording goes live without a rebuild), then the bundled i18n
   JSON (so the shipped copy still renders when the API is down). Segment
   semantics are unchanged — a missing segment, an intermediate scalar, or a
   non-string leaf resolves to ''. */
function msg(locale: Locale, dotted: string, runtime?: RuntimeMessages | null): string {
  const live = lookupMessages(runtime, dotted);
  if (live) return live;
  const root = (locale === 'ar' ? arMessages : enMessages) as Dict;
  let cursor: unknown = root;
  for (const seg of dotted.split('.')) {
    if (!cursor || typeof cursor !== 'object') return '';
    cursor = (cursor as Dict)[seg];
  }
  return typeof cursor === 'string' ? cursor : '';
}

/* Localized pair {en,ar} → string for the active locale. */
function pick(value: unknown, locale: Locale): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const pair = value as Partial<Record<Locale, unknown>>;
  const primary = pair[locale];
  if (typeof primary === 'string' && primary.trim()) return primary;
  const secondary = locale === 'en' ? pair.ar : pair.en;
  return typeof secondary === 'string' ? secondary : '';
}

function pickStr(value: unknown, locale: Locale, fallback: string): string {
  const v = pick(value, locale);
  return v || fallback;
}

/* Flat CMS field → string for the active locale, reading the shape the admin
   object editor actually writes:
       en → obj[field]
       ar → obj[field + 'Ar']  →  obj[field]  →  fallback
   A value only counts when it is a non-empty string after trim, so an admin
   who clears an Arabic box gets the fallback instead of an empty heading.
   A `{ en, ar }` OBJECT stored at that key still resolves through pick()
   above, so the pair contract used by the other content modules keeps
   working here — nothing that used to resolve stops resolving. */
function lpick(obj: Dict | undefined, field: string, loc: Locale, fallback: string): string {
  if (!obj) return fallback;
  if (loc === 'ar') {
    const sibling = obj[field + 'Ar'];
    if (typeof sibling === 'string' && sibling.trim()) return sibling;
  }
  const value = obj[field];
  if (typeof value === 'string') return value.trim() ? value : fallback;
  if (value && typeof value === 'object') {
    const paired = pickStr(value, loc, '');
    if (paired) return paired;
  }
  return fallback;
}

/* Arabic sibling of a LIST item (cms.titleAr / descAr / labelAr). Deliberately
   stricter than lpick(): when an admin left the Arabic box empty, Arabic must
   come from the bundled dictionary exactly as before — never from the English
   CMS value, which would silently serve English on the AR page. */
function arSibling(item: Dict, field: string): string {
  const v = item[field + 'Ar'];
  return typeof v === 'string' && v.trim() ? v : '';
}

export interface HomeItem {
  title: string;
  desc: string;
  /** CMS icon name (e.g. "brain"). Present on service rows only; the
   *  section components key their glyphs off it, so it must survive. */
  icon?: string;
}

/** One client voice. `img` is the speaker's photo: the admin sets it from
 *  Content → Testimonials with the Upload button on the `img` field. Empty
 *  is valid — the section then draws a monogram disc instead. */
export interface HomeTestimonial {
  quote: string;
  name: string;
  role: string;
  img: string;
}

export interface HomeClient {
  name: string;
  img: string;
  icon: string;
}

export interface HomeStat {
  value: number;
  suffix: string;
  label: string;
}

export interface HomeContent {
  hero: { badge: string; titleLead: string; titleAccent: string; titleTrail: string; description: string; ctaPrimary: string; ctaSecondary: string };
  servicesHeader: { eyebrow: string; title: string; desc: string };
  services: HomeItem[];
  industriesHeader: { eyebrow: string; title: string; desc: string };
  industries: { title: string }[];
  stats: HomeStat[];
  processHeader: { eyebrow: string; title: string; desc: string };
  process: HomeItem[];
  testimonialsHeader: { eyebrow: string; title: string; desc: string };
  testimonials: HomeTestimonial[];
  clients: HomeClient[];
  clientsEyebrow: string;
  /* The clients section header, exposed field by field.
     Previously only the eyebrow reached the site and the page heading was a
     hardcoded literal, so an admin editing the "Our Clients" title saw nothing
     change on /clients. `description` has no CMS key yet and resolves to ''
     unless one is added; callers must keep a literal fallback. */
  clientsHeader: { eyebrow: string; title: string; description: string };
  typewriter: string[];
  contact: {
    eyebrow: string;
    title: string;
    desc: string;
    /* Form + state copy. Each resolves CMS → dictionary, so the admin can own
       every visible string on the contact form, not just the header. */
    ctaLabel: string;
    successMessage: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    /* Suffix on the optional phone label, e.g. "(optional)". */
    optional: string;
    locations: string;
    company: string;
    companyPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    sending: string;
    sent: string;
    error: string;
  };
  /* Social handles are admin-owned (Site Content → Brand). They resolve to
     '' when the admin has not set one, and each consumer decides what an
     empty handle means — Contact.tsx and Footer.tsx both hide the icon
     rather than render a dead link. */
  brand: {
    email: string;
    phone: string;
    locations: string;
    whatsapp: string;
    facebook: string;
    instagram: string;
  };
  live: boolean;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/* CMS arrays in this project are EN-only plain strings
   ({title,desc} or {to,suffix,label}). For `en` the CMS wins;
   for `ar` the complete i18n dictionary wins. */
const FALLBACK_LISTS: Record<string, string[]> = {
  services: ['ai', 'custom', 'erp', 'crm', 'saas', 'web', 'api', 'automation', 'digital'],
  industries: ['healthcare', 'manufacturing', 'education', 'realEstate', 'finance', 'retail', 'government', 'logistics'],
  process: ['discovery', 'planning', 'design', 'development', 'testing', 'launch', 'support'],
};

/* Stable identity per service key: the `icon` name the content store ships
   for that service, and the extra spellings an admin may have saved. These
   are the anchors the services grid matches CMS rows by — see
   getHomeContent(). */
const SERVICE_ICON_BY_KEY: Record<string, string> = {
  ai: 'brain',
  custom: 'code-2',
  erp: 'layers',
  crm: 'users',
  saas: 'sparkles',
  web: 'globe',
  api: 'plug',
  automation: 'settings',
  digital: 'compass',
};
const SERVICE_ICON_ALIASES: Record<string, string[]> = {
  digital: ['refresh-cw', 'rotate-cw', 'refresh-ccw'],
  automation: ['workflow', 'bot', 'automation'],
  erp: ['database', 'layers-3'],
  crm: ['contact', 'contact-round', 'user-round'],
  web: ['layout', 'monitor'],
  api: ['webhook', 'braces'],
  saas: ['box', 'layers-2'],
  ai: ['cpu', 'sparkle'],
  custom: ['code', 'terminal'],
};

/* ============================================================
   ONE PRECEDENCE RULE — the answer to "why did my edit do nothing?"
   ------------------------------------------------------------
   Several visible strings exist in BOTH the CMS content store and the
   i18n dictionary (hero.titleLead, services.title, contact.title, …).
   The order below is the ONLY rule, and it is deliberate:

     content store  >  live dictionary  >  bundled i18n/*.json

   The content store wins because it is the per-page document an admin
   edits in "Site Content". The dictionary is the FALLBACK vocabulary
   plus every UI string that has no content key of its own.

   CONSEQUENCE, and it is the thing that used to be invisible: editing a
   dictionary key that also has a content key changes NOTHING on screen.
   That is not a bug, it is the precedence rule — but it must not be a
   silent one, so reportDictionaryShadowing() below lists the overlaps.
   Fixing a string means editing it where it is actually read from: the
   Site Content key. Use the dictionary for keys with no content key.
   ============================================================ */

/**
 * Dev-only: list dictionary keys that are shadowed by a content value, so the
 * "my dictionary edit did nothing" case is visible instead of mysterious.
 * Returns the list; also logs it once per process in development.
 */
export function reportDictionaryShadowing(
  bundle: Record<string, unknown>,
  runtime: RuntimeMessages | null
): string[] {
  const shadowed: string[] = [];
  for (const [key, value] of Object.entries(bundle)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [field, entry] of Object.entries(value as Record<string, unknown>)) {
      const dotted = `${key}.${field}`;
      const hasContent = typeof entry === 'string' ? entry.trim().length > 0
        : entry && typeof entry === 'object' && Object.values(entry as Record<string, unknown>)
            .some((v) => typeof v === 'string' && v.trim().length > 0);
      if (hasContent && lookupMessages(runtime, dotted)) shadowed.push(dotted);
    }
  }
  if (shadowed.length && process.env.NODE_ENV === 'development') {
    console.warn(
      `[home-content] ${shadowed.length} dictionary key(s) are shadowed by content values ` +
      `(content wins). Edit these in Site Content, not in Translations:\n  ` +
      shadowed.join('\n  ')
    );
  }
  return shadowed;
}

export async function getHomeContent(locale: string): Promise<HomeContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';

  /* Layer 1 of the dictionary: the live, admin-editable one — now read from
     the DATABASE (content row `i18n_<locale>`) through
     GET /api/content/i18n/:locale, with the bundled JSON as its fallback.
     Optional by design: if the API is down this is null and every lookup below
     falls through to i18n/*.json. It is a SEPARATE call from the content
     bundle and deliberately does not flip `live`: the content fetch alone
     decides whether the CMS answered. */
  const runtime = await getRuntimeMessages(loc);

  /* Bound once so the resolution rule lives in msg() alone: live dictionary
     first, bundled JSON second. (The content store is consulted separately and
     always takes priority — see ONE PRECEDENCE RULE above.) */
  const say = (l: Locale, dotted: string) => msg(l, dotted, runtime);

  let bundle: Record<string, unknown> = {};
  let live = true;
  try {
    const data = await api.content.home();
    if (!data || typeof data !== 'object') throw new Error('empty');
    bundle = data as Record<string, unknown>;
  } catch {
    bundle = {};
    live = false;
  }

  reportDictionaryShadowing(bundle, runtime);

  const B = (key: string) => bundle[key] as Record<string, unknown> | undefined;

  const hero = B('hero') || {};
  const servicesHeader = B('servicesHeader') || {};
  const industriesHeader = B('industriesHeader') || {};
  const processHeader = B('processHeader') || {};
  const testimonialsHeader = B('testimonialsHeader') || {};
  const contact = B('contact') || {};
  const brand = B('brand') || {};

  const cmsArr = (key: string): Record<string, unknown>[] => {
    const v = bundle[key];
    if (!Array.isArray(v)) return [];
    /* Rows are matched to their fallback entry BY POSITION, so one blank row
       left behind in the dashboard shifts every service after it and the tail
       silently falls back to the dictionary instead of the admin's own text.
       A row with no text in any field carries nothing, so it is dropped here. */
    return (v as Record<string, unknown>[]).filter(
      (row) => row && typeof row === 'object' && Object.values(row).some((f) => typeof f === 'string' && f.trim()),
    );
  };

  // Services: CMS titles live in EN; AR uses the admin's `titleAr`/`descAr`
  // siblings when set, and the i18n dictionary when they are not.
  //
  // MATCHED BY IDENTITY, NOT BY POSITION. Rows used to be paired with the
  // fixed key list purely by index, which breaks the moment an admin
  // reorders or deletes a row in the dashboard: every row after the gap
  // shifts up one, so row 0's copy ("Custom Software") was handed to the
  // `ai` key, the brain glyph sat on the wrong card, and the unmatched
  // tail silently fell back to the dictionary — which is how "AI
  // Solutions" vanished from the grid and "Digital Transformation" showed
  // up twice. Each row now carries a stable `icon` name, so a row is
  // claimed by that name first, by its title second (for older saves that
  // left `icon` empty), and a key that matches nothing keeps its shipped
  // dictionary copy. Each row can be claimed only once.
  const cmsServices = cmsArr('services');
  const claimedServiceRows = new Set<number>();
  const serviceRowFor = (key: string): Dict => {
    const aliases = [SERVICE_ICON_BY_KEY[key] ?? '', ...(SERVICE_ICON_ALIASES[key] ?? [])].filter(Boolean);
    let idx = aliases.length
      ? cmsServices.findIndex((row, i) => !claimedServiceRows.has(i) && aliases.includes(str(row.icon)))
      : -1;
    if (idx < 0) {
      /* No usable icon on the row — fall back to matching the title the
         dictionary would have produced, normalised for spacing/case. */
      const want = say('en', `services.${key}`)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (want) {
        idx = cmsServices.findIndex(
          (row, i) => !claimedServiceRows.has(i) && str(row.title).trim().toLowerCase().replace(/\s+/g, ' ') === want,
        );
      }
    }
    if (idx < 0) return {};
    claimedServiceRows.add(idx);
    return cmsServices[idx];
  };

  const services: HomeItem[] = FALLBACK_LISTS.services.map((k) => {
    const cms = serviceRowFor(k);
    return {
      icon: str(cms.icon) || SERVICE_ICON_BY_KEY[k] || '',
      title: loc === 'en' ? str(cms.title) || say('en', `services.${k}`) : arSibling(cms, 'title') || say('ar', `services.${k}`),
      desc: loc === 'en' ? str(cms.desc) || say('en', `services.${k}Desc`) : arSibling(cms, 'desc') || say('ar', `services.${k}Desc`),
    };
  });

  const cmsIndustries = cmsArr('industries');
  const industries = FALLBACK_LISTS.industries.map((k, i) => {
    const cms = cmsIndustries[i] || {};
    return { title: loc === 'en' ? str(cms.title) || say('en', `industries.${k}`) : arSibling(cms, 'title') || say('ar', `industries.${k}`) };
  });

  const cmsProcess = cmsArr('process');
  const process = FALLBACK_LISTS.process.map((k, i) => {
    const cms = cmsProcess[i] || {};
    return {
      title: loc === 'en' ? str(cms.title) || say('en', `process.${k}`) : arSibling(cms, 'title') || say('ar', `process.${k}`),
      desc: loc === 'en' ? str(cms.desc) || say('en', `process.${k}Desc`) : arSibling(cms, 'desc') || say('ar', `process.${k}Desc`),
    };
  });

  /* Testimonials: fully CMS-driven, any length the admin sets.
     The i18n quote1..3 copy is a LAST-resort seed used only when the CMS
     has no testimonials at all — it is no longer mapped index-by-index, so
     a 1-item or 12-item list both render as authored. `img` goes through
     normalizeImageSrcOrEmpty so an admin-uploaded `images/uploads/x.jpg`
     resolves to `/images/uploads/x.jpg` on nested /en /ar routes. */
  const cmsTestimonials = cmsArr('testimonials');
  const testimonials: HomeTestimonial[] = (cmsTestimonials.length
    ? cmsTestimonials.map((cms) => ({
        quote: loc === 'en' ? str(cms.quote) : arSibling(cms, 'quote'),
        name: loc === 'en' ? str(cms.name) : arSibling(cms, 'name'),
        role: loc === 'en' ? str(cms.role) : arSibling(cms, 'role'),
        img: normalizeImageSrcOrEmpty(cms.img),
      }))
    : [1, 2, 3].map((n) => ({
        quote: say(loc, `testimonials.quote${n}`),
        name: say(loc, `testimonials.name${n}`),
        role: say(loc, `testimonials.role${n}`),
        img: '',
      }))
  ).filter((t) => t.quote || t.name);

  // Stats: CMS {to,suffix,label} EN-only; same locale rule.
  const cmsStats = cmsArr('stats');
  const statKeys = ['projects', 'countries', 'clients', 'years'];
  const statDefaults = [
    { value: 480, suffix: '+' },
    { value: 32, suffix: '' },
    { value: 140, suffix: '+' },
    { value: 12, suffix: '+' },
  ];
  const stats: HomeStat[] = statKeys.map((k, i) => {
    const cms = cmsStats[i] || {};
    return {
      value: num(cms.to, statDefaults[i].value),
      suffix: str(cms.suffix) || statDefaults[i].suffix,
      label: loc === 'en' ? str(cms.label) || say('en', `stats.${k}`) : arSibling(cms, 'label') || say('ar', `stats.${k}`),
    };
  });

  const cmsClients = cmsArr('clients');
  const clientFallback = [{ name: 'Meridian Health', nameAr: '', img: '', icon: 'hospital' }, { name: 'Arkline Logistics', nameAr: '', img: '', icon: 'truck' }, { name: 'Solace Finance', nameAr: '', img: '', icon: 'wallet' }, { name: 'Nexus Retail', nameAr: '', img: '', icon: 'shopping-bag' }, { name: 'Vertex Education', nameAr: '', img: '', icon: 'graduation-cap' }, { name: 'PrimeTech', nameAr: '', img: '', icon: 'factory' }];
  /* The admin array editor already renders a `nameAr` box beside every `name`
     (renderArrayItem → bilingField), but the site only ever read `name`, so the
     Arabic an admin typed was stored and then ignored — the wordmark cloud
     stayed English on /ar. Resolve the name per locale here. A brand name
     legitimately stays Latin when no Arabic was supplied, so unlike the
     section copy this one falls back to the English name. */
  const clients: HomeClient[] = (cmsClients.length ? cmsClients : clientFallback)
    .map((c) => ({
      name: loc === 'ar' ? str(c.nameAr) || str(c.name) : str(c.name),
      /* Root-absolute: the admin stores `images/…` with no leading slash, which
         the browser would resolve against the current locale route and 404.
         Normalising here means every consumer (clients page, homepage marquee)
         receives a usable path, and an unusable one becomes '' so the caller
         falls back to its icon or initials instead of rendering a broken <img>. */
      img: normalizeImageSrcOrEmpty(c.img),
      icon: str(c.icon),
    }))
    .filter((c) => c.name);
  const clientsHeader = B('clientsHeader') || {};

  /* Section copy must never leak English into the Arabic page, so Arabic reads
     the `Ar` sibling (or the AR dictionary) and never the plain English key —
     that leak is what made the Arabic "OUR CLIENTS" heading show in English. */
  const headerEyebrow = loc === 'ar'
    ? arSibling(clientsHeader, 'eyebrow') || say('ar', 'clientsHeader.title')
    : lpick(clientsHeader, 'eyebrow', loc, '');
  const headerTitle = loc === 'ar'
    ? arSibling(clientsHeader, 'title') || say('ar', 'clientsHeader.title')
    : lpick(clientsHeader, 'title', loc, say('en', 'clientsHeader.title'));
  const headerDescription = loc === 'ar'
    ? arSibling(clientsHeader, 'description') || say('ar', 'clientsHeader.description')
    : lpick(clientsHeader, 'description', loc, say('en', 'clientsHeader.description'));

  /* Rotating hero badge: CMS typewriter wins when it has lines. */
  const cmsTypewriter = bundle.typewriter as { en?: unknown; ar?: unknown } | undefined;
  const cmsLines = cmsTypewriter && Array.isArray(cmsTypewriter[loc]) ? (cmsTypewriter[loc] as unknown[]).filter((s): s is string => typeof s === 'string' && !!s.trim()) : [];
  const typewriter = cmsLines.length ? cmsLines : (loc === 'ar' ? NOVIQ_CONTENT.typewriter.ar : NOVIQ_CONTENT.typewriter.en);

  return {
    hero: {
      badge: lpick(hero, 'badge', loc, say(loc, 'hero.badge')),
      titleLead: lpick(hero, 'titleLead', loc, say(loc, 'hero.titleLead')),
      titleAccent: lpick(hero, 'titleAccent', loc, say(loc, 'hero.titleAccent')),
      titleTrail: lpick(hero, 'titleTrail', loc, say(loc, 'hero.titleTrail')),
      description: lpick(hero, 'description', loc, say(loc, 'hero.description')),
      ctaPrimary: lpick(hero, 'ctaPrimary', loc, say(loc, 'hero.ctaPrimary')),
      ctaSecondary: lpick(hero, 'ctaSecondary', loc, say(loc, 'hero.ctaSecondary')),
    },
    servicesHeader: {
      eyebrow: lpick(servicesHeader, 'eyebrow', loc, say(loc, 'services.eyebrow')),
      title: lpick(servicesHeader, 'title', loc, say(loc, 'services.title')),
      desc: lpick(servicesHeader, 'desc', loc, say(loc, 'services.description')),
    },
    services,
    industriesHeader: {
      eyebrow: lpick(industriesHeader, 'eyebrow', loc, say(loc, 'industries.eyebrow')),
      title: lpick(industriesHeader, 'title', loc, say(loc, 'industries.title')),
      desc: lpick(industriesHeader, 'desc', loc, say(loc, 'industries.description')),
    },
    industries,
    stats,
    processHeader: {
      eyebrow: lpick(processHeader, 'eyebrow', loc, say(loc, 'process.eyebrow')),
      title: lpick(processHeader, 'title', loc, say(loc, 'process.title')),
      desc: lpick(processHeader, 'desc', loc, say(loc, 'process.description')),
    },
    process,
    testimonialsHeader: {
      eyebrow: lpick(testimonialsHeader, 'eyebrow', loc, say(loc, 'testimonials.eyebrow')),
      title: lpick(testimonialsHeader, 'title', loc, say(loc, 'testimonials.title')),
      desc: lpick(testimonialsHeader, 'desc', loc, say(loc, 'testimonials.description')),
    },
    testimonials,
    clients,
    /* Kept for the existing callers (the clients page eyebrow). The Arabic
       chain no longer borrows the English key, so it ends on the AR dictionary
       copy instead of "Trusted by"/"Our Clients" in Latin letters. */
    clientsEyebrow: headerEyebrow || (loc === 'ar' ? say('ar', 'clientsHeader.title') || 'يثقون بنا' : headerTitle || say('en', 'clientsHeader.title') || 'Trusted by'),
    clientsHeader: {
      eyebrow: headerEyebrow,
      title: headerTitle,
      description: headerDescription,
    },
    typewriter,
    contact: {
      eyebrow: lpick(contact, 'eyebrow', loc, say(loc, 'contact.eyebrow')),
      title: lpick(contact, 'title', loc, say(loc, 'contact.title')),
      desc: lpick(contact, 'desc', loc, say(loc, 'contact.description')),
      ctaLabel: lpick(contact, 'ctaLabel', loc, say(loc, 'contact.send')),
      successMessage: lpick(contact, 'successMessage', loc, say(loc, 'contact.sent')),
      name: lpick(contact, 'name', loc, say(loc, 'contact.name')),
      namePlaceholder: lpick(contact, 'namePlaceholder', loc, say(loc, 'contact.namePlaceholder')),
      email: lpick(contact, 'email', loc, say(loc, 'contact.email')),
      emailPlaceholder: lpick(contact, 'emailPlaceholder', loc, say(loc, 'contact.emailPlaceholder')),
      phone: lpick(contact, 'phone', loc, say(loc, 'contact.phone')),
      phonePlaceholder: lpick(contact, 'phonePlaceholder', loc, say(loc, 'contact.phonePlaceholder')),
      optional: lpick(contact, 'optional', loc, say(loc, 'contact.optional')),
      locations: lpick(contact, 'locations', loc, say(loc, 'contact.locations')),
      company: lpick(contact, 'company', loc, say(loc, 'contact.company')),
      companyPlaceholder: lpick(contact, 'companyPlaceholder', loc, say(loc, 'contact.companyPlaceholder')),
      message: lpick(contact, 'message', loc, say(loc, 'contact.message')),
      messagePlaceholder: lpick(contact, 'messagePlaceholder', loc, say(loc, 'contact.messagePlaceholder')),
      sending: lpick(contact, 'sending', loc, say(loc, 'contact.sending')),
      sent: lpick(contact, 'sent', loc, say(loc, 'contact.sent')),
      error: lpick(contact, 'error', loc, say(loc, 'contact.error')),
    },
    brand: {
      email: str(brand.email) || 'hello@noviqsolutions.com',
      phone: str(brand.phone) || '+1-415-555-0182',
      whatsapp: str(brand.whatsapp) || '01062339274',
      facebook: str(brand.facebook) || 'https://facebook.com/noviqsolutions',
      instagram: str(brand.instagram) || 'https://instagram.com/noviqsolutions',
      /* Arabic gets its own cities list; the English one is proper nouns. */
      locations:
        (loc === 'ar' ? lpick(brand, 'locations', loc, '') : str(brand.locations)) || '',
    },
    live,
  };
}

export default getHomeContent;
