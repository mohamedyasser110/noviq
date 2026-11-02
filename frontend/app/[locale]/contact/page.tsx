/* ============================================================
   NOVIQ Frontend — Contact Page (CMS-driven header + section)
   ============================================================ */
import Contact from '@/components/sections/Contact';
import { getHomeContent } from '@/lib/home-content';

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = await getHomeContent(locale);

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {home.contact.eyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              {home.contact.eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {home.contact.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {home.contact.desc}
          </p>
        </div>
      </header>
      <Contact locale={locale} content={home.contact} brand={home.brand} />
    </div>
  );
}
