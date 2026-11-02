/* ============================================================
   NOVIQ Frontend — Locale Root Layout
   THIS is the single owner of <html>/<body> for the whole app.

   There is deliberately NO app/layout.tsx: a root layout plus a
   [locale] layout that both render <html> produces NESTED <html>
   elements, which is invalid HTML. The browser then keeps the outer
   element's attributes, so /ar served lang="en" (only dir="rtl" came
   through) and React logged a hydration mismatch.

   Everything that used to live in app/layout.tsx (metadata, viewport,
   font links) now lives here, and metadata is generated per locale.
   ============================================================ */
import '../../styles/globals.css';
import type React from 'react';
import type { Metadata, Viewport } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BackToTop from '@/components/shared/BackToTop';
import JsonLd from '@/components/shared/JsonLd';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { locales, loadMessages } from '@/lib/i18n';
import { api } from '@/lib/api-client';
import ContentOverrideBridge from '@/components/shared/ContentOverrideBridge';
import VisitTracker from '@/components/shared/VisitTracker';
import { AuthProvider } from '@/lib/auth';

const SITE_URL = 'https://noviqsolutions.com';

/** Brand name for metadata. Reads the CMS `brand` key; returns empty strings
 *  when the API is offline so the caller can fall back to its literals.
 *  Never throws. */
async function getBrandName(): Promise<{ short: string; full: string }> {
  try {
    const brand = (await api.content.brand()) as Record<string, unknown> | null;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    return { short: str(brand?.name), full: str(brand?.fullName) };
  } catch {
    return { short: '', full: '' };
  }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * The same 60s window the CMS pages use, applied to the LAYOUT on purpose.
 *
 * `NextIntlClientProvider` is rendered here, so the messages every client
 * component reads (`useTranslations` in the Navbar, Footer, section headers)
 * are part of the layout's output. Without a revalidate on this segment the
 * layout stays a static shell generated at build time, the page below it
 * re-renders every minute, and a reworded translation keeps serving the
 * dictionary that was current at build. This is what makes an admin edit to
 * i18n/<locale>.json actually go live on the whole route.
 */
export const revalidate = 60;

/* Render on request, never at build time: static generation hung on every
   page (on Hostinger and locally alike) with no API reachable during the
   build, so the build could never finish. At runtime server.js points the
   server-side fetches at the API in the same process. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';

  /* Brand identity from the CMS. `brand.name` / `brand.fullName` were a dead
     key: the whole metadata block below hardcoded the company name, so an edit
     to the brand in the dashboard never reached the <title>, og:site_name or
     the author tags. The hardcoded values stay as the offline fallback — this
     fetch never throws (api.content.brand() degrades to null). */
  const brand = await getBrandName();
  /* `name` is the short form and is what a page title wants; `fullName` is the
     long form for og:site_name / author tags. Both locales use the same short
     form in the template — an earlier version mixed the two, which made the
     English title ignore an edit to `brand.name`. */
  const shortName = brand.short || (isArabic ? 'نوفيك' : 'Noviq');
  const fullName = brand.full || shortName;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      /* The leading brand word comes from the CMS `brand.name`, so an edit
         there changes the homepage title too — not only child pages, which get
         it through the template below. */
      default: isArabic
        ? `${shortName} — هندسة البرمجيات والذكاء الاصطناعي | حلول مخصصة وأنظمة ERP وCRM وسحابة`
        : `${shortName} — Global Software & AI Engineering Company | Custom AI, ERP, CRM & Cloud`,
      template: `%s | ${shortName}`,
    },
    description: isArabic
      ? 'نوفيك تبني برمجيات ذكية: حلول ذكاء اصطناعي مخصصة، أنظمة ERP وCRM، منصات SaaS، وبنية سحابية. أكثر من 480 مشروعاً في 32 دولة.'
      : 'Noviq builds intelligent software: custom AI solutions, ERP & CRM systems, SaaS platforms, cloud infrastructure, and web & mobile applications. 480+ projects delivered across 32 countries.',
    keywords: isArabic
      ? ['تطوير برمجيات', 'حلول ذكاء اصطناعي', 'نظام ERP', 'منصة CRM', 'تطوير SaaS', 'تحول رقمي']
      : [
          'software engineering',
          'AI solutions',
          'artificial intelligence',
          'ERP system',
          'CRM platform',
          'SaaS development',
          'cloud migration',
          'custom software',
          'mobile apps',
          'web development',
          'digital transformation',
          'machine learning',
          'chatbot development',
        ],
    authors: [{ name: fullName }],
    creator: fullName,
    openGraph: {
      type: 'website',
      siteName: fullName,
      locale: isArabic ? 'ar_AR' : 'en_US',
      alternateLocale: isArabic ? 'en_US' : 'ar_AR',
      url: `${SITE_URL}/${locale}`,
      images: [
        {
          url: '/images/project-ai.png',
          width: 1200,
          height: 630,
          alt: isArabic ? 'نوفيك — هندسة البرمجيات والذكاء الاصطناعي' : 'Noviq — Global Software & AI Engineering',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@noviq',
      title: isArabic ? 'نوفيك — هندسة المستقبل عبر التقنية' : 'Noviq — Global Software & AI Engineering',
      description: isArabic
        ? 'حلول ذكاء اصطناعي مخصصة، أنظمة ERP وCRM، منصات SaaS، وبنية سحابية. 480+ مشروع عبر 32 دولة.'
        : 'Custom AI solutions, ERP & CRM systems, SaaS platforms, and cloud infrastructure. 480+ projects across 32 countries.',
      images: ['/images/project-ai.png'],
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        ar: `${SITE_URL}/ar`,
      },
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  /* A single value, not a prefers-color-scheme pair: the site now has an
     explicit theme toggle, and media-query entries would pin the browser
     chrome to the OS setting while the page itself follows the user's
     stored choice — the address bar and the page would disagree. The
     pre-paint script below rewrites this meta's content on toggle. */
  themeColor: '#FFFFFF',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Required for static prerendering with next-intl server APIs
  // (getMessages/getTranslations) — see next-intl "static rendering" docs.
  setRequestLocale(locale as (typeof locales)[number]);
  const messages = await loadMessages(locale);
  const isRTL = locale === 'ar';

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&display=swap"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/*
          Applies the stored theme BEFORE the first paint. Without this the
          page renders light, then React mounts and flips to dark — a white
          flash on every load for anyone who chose dark.

          It cannot be a component: nothing has hydrated yet, so the only way
          to run before paint is an inline blocking script in <head>. The
          storage key must match THEME_STORAGE_KEY in components/layout/Navbar.tsx.

          Falls back to the OS preference when the user has never toggled, so
          a dark-OS visitor gets dark on the very first visit too.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('noviq_theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');if(d){r.classList.add('dark');}else{r.classList.remove('dark');}r.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#0A0A0F':'#FFFFFF');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-primary">
          {isRTL ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
        </a>

        <NextIntlClientProvider messages={messages} locale={locale}>
          {/* One page-view POST per path per session. This is the only
              caller of POST /api/analytics/visit — without it the
              dashboard's Analytics and Site Monitor pages render
              correctly and permanently report zero. Placed inside the
              provider so it can read nothing it does not need, and first
              so the count is queued before any heavier component mounts. */}
          <VisitTracker locale={locale} />
          {/* Client session lives here and only here. Navbar and every page
              below read it via useAuth() — a second provider would fork the
              state and the header could disagree with the page. */}
          <AuthProvider>
            <Navbar locale={locale as 'en' | 'ar'} />
            <main id="main-content" className="flex-1 pt-16">
              {children}
            </main>
          </AuthProvider>
          <Footer locale={locale as 'en' | 'ar'} />
          <BackToTop />
          <JsonLd locale={locale as 'en' | 'ar'} />
        </NextIntlClientProvider>
        {/* Applies localStorage content overrides (lib/content-admin.ts) to
            any [data-content-path] node, at runtime, after hydration. */}
        <ContentOverrideBridge />
      </body>
    </html>
  );
}
