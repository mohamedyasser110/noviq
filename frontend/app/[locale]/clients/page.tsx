/* ============================================================
   NOVIQ Frontend — Clients Page (CMS-driven, in MORE menu)
   Same source as the homepage logo cloud (Site Content →
   Our Clients) but here every client renders WITH its image.
   ============================================================ */
import ContactCta from '@/components/contact/ContactCta';
import { notFound } from 'next/navigation';
import { isPageEnabled } from '@/lib/pages-content';
import { getHomeContent } from '@/lib/home-content';
import { readMessage, loadMessages } from '@/lib/i18n';
import { createIcon } from '@/lib/utils';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await isPageEnabled('clients'))) notFound();
  const isRTL = locale === 'ar';
  const home = await getHomeContent(locale);
  const clients = home.clients;
  /* The heading used to be a hardcoded literal, which is why editing the
     "Our Clients" title in the dashboard changed nothing on this page. It now
     resolves CMS → translation dictionary → the original copy, so the admin
     owns it. The literals stay as the last resort (API down, key removed). */
  const heading = home.clientsHeader.title || (isRTL ? 'عملاؤنا' : 'Our Clients');
  const subheading =
    home.clientsHeader.description ||
    (isRTL
      ? 'نخبة من المؤسسات التي تعتمد على نوفيك في أنظمتها الحرجة.'
      : 'Organizations that rely on Noviq for mission-critical systems.');
  /* Interface strings (not section copy) now resolve through the translation
     dictionary, so an admin edits them in Site Content → Translations. The
     literals stay as the fallback and are unchanged. */
  const messages = await loadMessages(locale);
  const trustedPartner = readMessage(messages, 'clients.trustedPartner') || (isRTL ? 'شريك موثوق' : 'Trusted partner');
  const ctaLabel = readMessage(messages, 'clients.cta') || (isRTL ? 'كن عميلنا التالي' : 'Become our next client');

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {home.clientsEyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              {home.clientsEyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {heading}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {subheading}
          </p>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <article
                key={c.name}
                className="group flex items-center gap-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:-translate-y-1"
              >
                {c.img ? (
                  <span className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
                    {/* Plain <img>: CMS paths are runtime data, not static imports. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.img}
                      alt={c.name}
                      width={176}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full w-auto object-contain"
                    />
                  </span>
                ) : c.icon ? (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    {createIcon(c.icon.toLowerCase(), { className: 'h-9 w-9' })}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary"
                  >
                    {initials(c.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white break-words">
                    {c.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {trustedPartner}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-14 text-center">
            <ContactCta locale={locale} className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors">
              {ctaLabel}
            </ContactCta>
          </div>
        </div>
      </section>
    </div>
  );
}
