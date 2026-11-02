/* ============================================================
   NOVIQ — /resources  (Knowledge Hub)
   ------------------------------------------------------------
   Rendered from the ADMIN DASHBOARD via lib/resources-content.ts,
   exactly like /team: the backend stores `content.resources` in
   SQLite and serves it on GET /api/content/resources. Nothing on
   this page is hardcoded — every tab, title, excerpt, image and
   file is edited in the admin and read from the CMS at build time.

   This file stays a SERVER component: it fetches the content once
   (ISR, 60s) and hands it to <ResourcesExplorer/>, which owns every
   interactive bit (search, section/category/sort filters, pins, read
   receipts) in the browser with zero additional requests.

   The build must never break on an offline API, so an empty CMS
   renders an honest empty state rather than throwing.
   ============================================================ */

import { BookOpen, ArrowRight } from 'lucide-react';
import { getResourcesContent } from '@/lib/resources-content';
import ResourcesExplorer from '@/components/sections/ResourcesExplorer';
import ContactCta from '@/components/contact/ContactCta';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ResourcesPage({ params }: PageProps) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const content = await getResourcesContent(locale);

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {content.eyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              {content.eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
            {content.title}
          </h1>
          {content.description ? (
            <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
              {content.description}
            </p>
          ) : null}
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {content.sections.length === 0 && content.featured.length === 0 ? (
            /* Honest empty state. No invented articles, no fake counts. */
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
              <BookOpen
                className="mx-auto mb-4 h-10 w-10 text-slate-400"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isRTL ? 'لا توجد موارد منشورة بعد' : 'Nothing published yet'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">
                {isRTL
                  ? 'سيظهر هنا المحتوى فور نشره من لوحة التحكم.'
                  : 'Content appears here as soon as it is published from the admin dashboard.'}
              </p>
            </div>
          ) : (
            <ResourcesExplorer content={content} locale={locale} />
          )}

          {/* Only reached when the CMS is unreachable; a real CTA, not filler. */}
          {!content.live ? (
            <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-slate-600 dark:text-slate-300">
                {isRTL
                  ? 'تعذر تحميل المحتوى من لوحة التحكم. يرجى المحاولة لاحقًا.'
                  : 'Could not load content from the CMS. Please try again shortly.'}
              </p>
              <ContactCta
                locale={locale}
                isArabic={isRTL}
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white"
              >
                {isRTL ? 'تواصل معنا' : 'Talk to us'}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </ContactCta>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
