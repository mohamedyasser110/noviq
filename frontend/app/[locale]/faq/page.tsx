/* ============================================================
   NOVIQ Frontend — FAQ Page (CMS-driven)
   Content comes from the admin dashboard (backend `faq`
   key via lib/faq-content.ts). Falls back to the static
   seed when the API is offline.
   ============================================================ */
import { getFaqContent } from '@/lib/faq-content';
import ContactCta from '@/components/contact/ContactCta';
import { readMessage, loadMessages } from '@/lib/i18n';
import { createIcon } from '@/lib/utils';
import FaqExplorer from '@/components/faq/FaqExplorer';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  const content = await getFaqContent(locale);
  const faqs = content.items.map((item) => ({ q: item.q, a: item.a }));
  /* `faq.stillHaveQuestions`, `faq.contactUs` and `common.home` have existed in
     the dictionary all along — the page simply hardcoded the same words, so an
     admin edit to them could never reach the site. Now it can. */
  const messages = await loadMessages(locale);
  const homeLabel = readMessage(messages, 'common.home') || (isArabic ? 'الرئيسية' : 'Home');
  const stillHaveQuestions = readMessage(messages, 'faq.stillHaveQuestions') || (isArabic ? 'ما زالت لديك أسئلة؟' : 'Still Have Questions?');
  const contactUs = readMessage(messages, 'faq.contactUs') || (isArabic ? 'تواصل معنا' : 'Contact Us');

  return (
    <>
      <div className="noviq-page-hero">
        <div className="noviq-breadcrumb">
          <a href={`/${locale}`}>{homeLabel}</a> <span>/</span>{' '}
          <span>{content.title}</span>
        </div>
        <div className="noviq-hero-badge">
          {createIcon('help-circle', { className: 'inline-block h-4 w-4 align-middle' })}{' '}
          {content.eyebrow}
        </div>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>

      <div className="noviq-page-section">
        <FaqExplorer
          items={faqs}
          isArabic={isArabic}
          searchPlaceholder={
            readMessage(messages, 'faq.searchPlaceholder') ||
            (isArabic ? 'ابحث في الأسئلة…' : 'Search questions…')
          }
          noResults={
            readMessage(messages, 'faq.noResults') ||
            (isArabic ? 'لا توجد أسئلة مطابقة لبحثك.' : 'No questions match your search.')
          }
          resultsTemplate={
            readMessage(messages, 'faq.resultsTemplate') ||
            (isArabic ? 'عرض {shown} من {total}' : 'Showing {shown} of {total}')
          }
        />

        {/* Contact CTA as a gradient-ring card instead of a bare section:
            same copy and destination, drawn as a destination. */}
        <div className="mx-auto mt-14 max-w-3xl">
          <div className="rounded-3xl bg-gradient-to-br from-primary via-primary/70 to-accent-action p-[1.5px] shadow-xl shadow-primary/10">
            <div className="rounded-3xl bg-white dark:bg-slate-900 px-8 py-10 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                {createIcon('life-buoy', { className: 'h-6 w-6' })}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{stillHaveQuestions}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {isArabic
                  ? 'نحن هنا للمساعدة. تواصل معنا وسنعاود إليك خلال يوم عمل واحد.'
                  : "We're here to help. Reach out and we'll get back to you within one business day."}
              </p>
              <ContactCta locale={locale} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                {contactUs}
              </ContactCta>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
