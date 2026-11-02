/* ============================================================
   NOVIQ Frontend — Industries Page (CMS-driven header + grid)
   ============================================================ */
import ContactCta from '@/components/contact/ContactCta';
import Industries from '@/components/sections/Industries';
import { getHomeContent } from '@/lib/home-content';

export default async function IndustriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = await getHomeContent(locale);

  return (
    <div className="min-h-screen">
      <div className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {home.industriesHeader.eyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              {home.industriesHeader.eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {home.industriesHeader.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {home.industriesHeader.desc}
          </p>
        </div>
      </div>
      <Industries locale={locale} header={home.industriesHeader} items={home.industries} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 text-center">
        <ContactCta locale={locale} className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors">
          {locale === 'ar' ? 'تحدث معنا' : 'Talk to Us'}
        </ContactCta>
      </div>
    </div>
  );
}
