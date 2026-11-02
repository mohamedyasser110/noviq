/* ============================================================
   NOVIQ Footer — CMS-driven (footer + brand + page visibility)
   ------------------------------------------------------------
   Links, tagline, copyright and contact info come from the admin
   dashboard (Site Content → Footer / Brand / Pages). Retired pages
   (ai-lab) never render here. Falls back to the i18n dictionary
   when the API is offline. Includes the newsletter subscribe form
   (POST /api/newsletter/subscribe via the single api-client).
   ============================================================ */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { waMeUrl, profileUrl, mailtoUrl } from '@/lib/social';
import {
  LOGO_DEFAULTS,
  fetchVisualSettings,
  resolveLogo,
  type LogoSettings,
} from '@/lib/hero-visual-content';
import { preferHealthy } from '@/lib/text-integrity';

interface FooterLink {
  href: string;
  en: string;
  ar: string;
}

const FALLBACK_LINKS: FooterLink[] = [
  { href: '/', en: 'Home', ar: 'الرئيسية' },
  { href: '/services', en: 'Services', ar: 'الخدمات' },
  { href: '/industries', en: 'Industries', ar: 'القطاعات' },
  { href: '/solutions', en: 'Solutions', ar: 'الحلول' },
  { href: '/portfolio', en: 'Portfolio', ar: 'أعمالنا' },
  { href: '/pricing', en: 'Pricing', ar: 'الأسعار' },
  { href: '/about', en: 'About', ar: 'من نحن' },
  { href: '/why', en: 'Why Noviq', ar: 'لماذا نوفيك' },
  { href: '/team', en: 'Our Team', ar: 'فريقنا' },
  { href: '/resources', en: 'Resources', ar: 'الموارد' },
  { href: '/careers', en: 'Careers', ar: 'الوظائف' },
  { href: '/contact', en: 'Contact', ar: 'تواصل معنا' },
];

const COMPANY_HREFS = ['/about', '/careers', '/contact', '/why'];
const SERVICES_HREFS = ['/services', '/solutions', '/industries', '/portfolio'];

/* The two link columns, by id. This is what shipped — and what renders whenever
   the CMS has no valid `footer.linkColumns` of its own. */
const SHIPPED_COLUMNS = [
  { id: 'company', hrefs: COMPANY_HREFS },
  { id: 'services', hrefs: SERVICES_HREFS },
];

interface FooterColumn {
  id: string;
  hrefs: string[];
}

export default function Footer({ locale }: { locale: 'en' | 'ar' }) {
  /* Same admin-controlled logo settings the navbar reads. A failed read
     falls back to the shipped artwork and sizes. */
  const [footerLogo, setFooterLogo] = useState<LogoSettings>(LOGO_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    fetchVisualSettings('logo', resolveLogo).then((next) => {
      if (!cancelled && next) setFooterLogo(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const t = useTranslations('footer');
  const isRTL = locale === 'ar';

  const [tagline, setTagline] = useState<string | null>(null);
  const [copyright, setCopyright] = useState<string | null>(null);
  const [links, setLinks] = useState<FooterLink[] | null>(null);
  /* Link-column membership from the CMS (`footer.linkColumns`), validated.
     Unknown hrefs are dropped — a typo'd slug would otherwise render a link
     to nowhere — and so is the retired ai-lab page. Absent or invalid CMS
     data falls back to the shipped columns, so this changes nothing until an
     admin arranges the columns in the dashboard. At most two columns render:
     the grid gives the brand block a double span, so a third would wrap. */
  const [linkColumns, setLinkColumns] = useState<FooterColumn[] | null>(null);
  const [social, setSocial] = useState<{
    email?: string;
    whatsapp?: string;
    facebook?: string;
    instagram?: string;
  }>({});

  const [email, setEmail] = useState('');
  const [newsState, setNewsState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  /* CMS footer/brand/pages — one bundle, best effort. */
  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(`${base}/api/content/footer`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}/api/content/pages`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}/api/content/brand`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([footer, pages, brand]) => {
      if (cancelled) return;
      if (footer && typeof footer === 'object') {
        const loc = locale as 'en' | 'ar';
        const pick = (v: unknown): string | null => {
          if (typeof v === 'string') return v || null;
          if (v && typeof v === 'object') {
            const p = v as Record<string, unknown>;
            if (typeof p[loc] === 'string' && (p[loc] as string).trim()) return p[loc] as string;
            const other = loc === 'en' ? p.ar : p.en;
            if (typeof other === 'string' && other.trim()) return other;
          }
          return null;
        };
        const tg = pick((footer as Record<string, unknown>).tagline);
        if (tg) setTagline(tg);
        const cp = pick((footer as Record<string, unknown>).copyright);
        if (cp) setCopyright(cp);
        const rawCols = (footer as Record<string, unknown>).linkColumns;
        if (Array.isArray(rawCols)) {
          const known = new Set(FALLBACK_LINKS.map((l) => l.href));
          const cols: FooterColumn[] = [];
          for (const c of rawCols) {
            if (!c || typeof c !== 'object') continue;
            const id = typeof (c as Record<string, unknown>).id === 'string'
              ? ((c as Record<string, unknown>).id as string).trim() || `col-${cols.length + 1}`
              : `col-${cols.length + 1}`;
            const hrefs = Array.isArray((c as Record<string, unknown>).hrefs)
              ? ((c as Record<string, unknown>).hrefs as unknown[]).filter(
                  (h): h is string => typeof h === 'string' && known.has(h) && h !== '/ai-lab',
                )
              : [];
            if (hrefs.length) cols.push({ id, hrefs });
            if (cols.length === 2) break;
          }
          if (cols.length) setLinkColumns(cols);
        }
      }
      if (pages && typeof pages === 'object') {
        const map = pages as Record<string, { enabled?: boolean; labelEn?: string; labelAr?: string }>;
        const visible = FALLBACK_LINKS.filter((l) => {
          const slug = l.href === '/' ? 'home' : l.href.slice(1);
          if (slug === 'ai-lab') return false;
          const entry = map[slug];
          if (!entry) return true;
          return entry.enabled !== false;
        }).map((l) => {
          const slug = l.href === '/' ? 'home' : l.href.slice(1);
          const entry = map[slug];
          if (entry && (entry.labelEn || entry.labelAr)) {
            /* preferHealthy, not `entry.labelAr ||`: every Arabic label in the
               CMS was once stored mis-decoded, and `||` happily shipped the
               garbage. A corrupt translation now falls through to the clean
               bundled fallback instead. See lib/text-integrity.ts. */
            return {
              href: l.href,
              en: preferHealthy(entry.labelEn, l.en),
              ar: preferHealthy(entry.labelAr, l.ar),
            };
          }
          return l;
        });
        setLinks(visible);
      }
      if (brand && typeof brand === 'object') {
        const b = brand as Record<string, string>;
        setSocial({
          email: b.email || '',
          whatsapp: b.whatsapp || '',
          facebook: b.facebook || '',
          instagram: b.instagram || '',
        });
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const navigation = links ?? FALLBACK_LINKS;

  function label(item: FooterLink): string {
    return isRTL ? item.ar : item.en;
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || newsState === 'busy') return;
    setNewsState('busy');
    try {
      await api.newsletter.subscribe(email.trim());
      setNewsState('done');
      setEmail('');
    } catch {
      setNewsState('error');
    }
  }

  return (
    <footer className="noviq-footer border-t border-slate-200 dark:border-slate-800">
      <div className="noviq-wrap py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
          <div className="col-span-2">
            <Link
                href={`/${locale}`}
                /* `w-full` is what makes the alignment control mean anything
                   here. An inline-flex link shrink-wraps to its image, so it
                   has no free space for justify-content to distribute and every
                   alignment rendered identically. Bounded by footerMaxWidth,
                   which is the "area" the position is measured within.
                   `start` reproduces the shipped appearance exactly. */
                className={`noviq-logo-align-${footerLogo.footerAlign} inline-flex w-full items-center min-h-[44px]`}
                style={{ maxWidth: footerLogo.footerMaxWidth, translate: `${footerLogo.footerOffsetX}px 0` }}
                aria-label="Noviq Home"
              >
              {/* Admin-controlled (Site Content → Logo). This used to be two
                  hardcoded copies of the wordmark at two hardcoded sizes, so
                  the footer logo could not be replaced, resized, swapped for
                  the mark, or removed at all.

                  Rendered height is the admin's value; the width follows the
                  artwork's own aspect ratio, so a logo is never squashed, and
                  maxWidth caps the column it can occupy. */}
              {footerLogo.showInFooter ? (
                <Image
                  src={
                    footerLogo.footerVariant === 'mark'
                      ? footerLogo.markSrc
                      : footerLogo.wordmarkSrc
                  }
                  alt={
                    footerLogo.footerVariant === 'mark'
                      ? footerLogo.markAlt
                      : footerLogo.wordmarkAlt
                  }
                  width={200}
                  height={footerLogo.footerHeight}
                  style={{ height: footerLogo.footerHeight, width: 'auto', maxWidth: footerLogo.footerMaxWidth }}
                  className="object-contain transition-transform duration-300 hover:scale-[1.02] drop-shadow-sm"
                  unoptimized
                />
              ) : null}
            </Link>
            <p className="mt-4 max-w-sm text-slate-600 dark:text-slate-400" dir="auto">
              {/* dir="auto": this string is CMS text with an Arabic sibling, so
                  on the Arabic page it is frequently still the English
                  fallback. Rendered in an RTL context, bidi moves its trailing
                  period to the far left — "…growth-minded businesses." read
                  as ".growth-minded businesses". The direction of an element
                  should follow its own first strong character, not its
                  ancestor's. */}
              {tagline ?? t('tagline') ?? 'Engineering the future through technology.'}
            </p>
            <form onSubmit={subscribe} className="mt-6 flex w-full max-w-sm gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRTL ? 'بريدك الإلكتروني' : 'you@company.com'}
                aria-label={isRTL ? 'النشرة البريدية' : 'Newsletter'}
                className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={newsState === 'busy'}
                className="min-h-[44px] shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {newsState === 'done' ? (isRTL ? 'تم!' : 'Done!') : isRTL ? 'اشترك' : 'Subscribe'}
              </button>
            </form>
            {newsState === 'error' && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {isRTL ? 'تعذر الاشتراك. حاول مرة أخرى.' : 'Subscription failed. Try again.'}
              </p>
            )}
            <p className="eyebrow mt-8">{isRTL ? 'جاهزون للبناء؟' : 'Ready to build?'}</p>
            <Link href={`/${locale}/contact`} className="noviq-view-all mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              {isRTL ? 'ابدأ مشروعك' : 'Start your project'}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {(linkColumns ?? SHIPPED_COLUMNS).map((col) => {
            /* Column headings stay dictionary-driven; membership is the CMS
               part. Unknown ids render as-is rather than blanking. */
            const heading =
              col.id === 'company' ? t('company') || 'Company'
              : col.id === 'services' ? t('services') || 'Services'
              : col.id;
            const items = col.hrefs
              .map((href) => navigation.find((n) => n.href === href))
              .filter((item): item is FooterLink => !!item);
            /* A column whose links are all hidden still renders its heading
               would be a dead signpost — but an emptied column means the
               admin hid everything in it, so keep the heading off too. */
            if (!items.length) return null;
            return (
              <nav key={col.id}>
                <h3 className="eyebrow">{heading}</h3>
                <ul className="mt-5 space-y-3">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link href={`/${locale}${item.href === '/' ? '' : item.href}`} className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors">
                        {label(item)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>

        <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-500 text-center" dir="auto">
            {copyright ?? t('copyright') ?? `© ${new Date().getFullYear()} Noviq Solutions. All rights reserved.`}
          </p>
          {/* Social Icons — same CMS fields as the contact section and the
              same lib/social.ts normalisation, so a wa.me link built here
              cannot disagree with the one built there. */}
          <div className="noviq-social-row">
            {(() => {
              const href = waMeUrl(social.whatsapp);
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="noviq-social noviq-social--whatsapp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </a>
              ) : null;
            })()}
            {(() => {
              const href = profileUrl(social.facebook, 'https://facebook.com');
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="noviq-social noviq-social--facebook"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              ) : null;
            })()}
            {(() => {
              const href = profileUrl(social.instagram, 'https://instagram.com');
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="noviq-social noviq-social--instagram"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              ) : null;
            })()}
            {(() => {
              const href = mailtoUrl(social.email);
              return href ? (
                <a
                  href={href}
                  aria-label="Email"
                  className="noviq-social noviq-social--email"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </a>
              ) : null;
            })()}
          </div>
        </div>
      </div>
    </footer>
  );
}
