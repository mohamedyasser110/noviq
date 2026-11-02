/* ============================================================
   NOVIQ Frontend — Team Page
   ------------------------------------------------------------
   Content comes from the ADMIN DASHBOARD (backend content.team
   via GET /api/content/team) — see lib/team-content.ts, which
   degrades to the static seed when the API is unreachable.
   Never hand-edit member data here: edit it in the dashboard.
   ============================================================ */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTeamContent } from '@/lib/team-content';
import { readMessage, loadMessages } from '@/lib/i18n';

/* Initials avatar fallback when a member has no photo. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!['en', 'ar'].includes(locale)) notFound();
  setRequestLocale(locale);

  const isArabic = locale === 'ar';
  const team = await getTeamContent(locale);

  /* Interface labels resolve through the translation dictionary (admin →
     Site Content → Translations); the literals are the unchanged fallback. */
  const messages = await loadMessages(locale);
  const copy = {
    breadcrumb: readMessage(messages, 'team.breadcrumb') || (isArabic ? 'فريقنا' : 'Our Team'),
    featured: readMessage(messages, 'team.featured') || (isArabic ? 'عضو مميّز' : 'Featured'),
    viewCv: readMessage(messages, 'team.viewCv') || (isArabic ? 'السيرة الذاتية' : 'View CV'),
    portfolio: readMessage(messages, 'team.portfolio') || (isArabic ? 'الأعمال' : 'Portfolio'),
    email: readMessage(messages, 'team.email') || (isArabic ? 'البريد' : 'Email'),
    joinUs: readMessage(messages, 'team.joinUs') || (isArabic ? 'انضم إلينا' : 'Join Us'),
  };

  /* Social/contact affordances, in the order the dashboard lists them. */
  const linksOf = (m: (typeof team.members)[number]) =>
    [
      { href: m.portfolio, label: copy.portfolio, icon: 'globe' },
      { href: m.linkedin, label: 'LinkedIn', icon: 'in' },
      { href: m.github, label: 'GitHub', icon: 'github' },
      { href: m.facebook, label: 'Facebook', icon: 'facebook' },
      { href: m.email ? `mailto:${m.email}` : '', label: copy.email, icon: 'mail' },
    ].filter((l) => l.href);

  return (
    <div className="min-h-screen">
      {/* ---- Hero: Qodix eyebrow + extrabold title ---- */}
      <section className="noviq-section-qodix">
        <div className="noviq-wrap">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1 text-sm">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center min-h-[44px] text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              {isArabic ? 'الرئيسية' : 'Home'}
            </Link>
            <span className="mx-2 text-slate-400">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {copy.breadcrumb}
            </span>
          </nav>

          <p className="eyebrow">{team.eyebrow}</p>
          <h1 className="noviq-h2 mt-5 text-slate-900 dark:text-white">{team.title}</h1>
          <p className="noviq-lead">{team.description}</p>
        </div>
      </section>

      {/* ---- Members: hairline-ruled cards, featured first ---- */}
      <section className="noviq-section-qodix noviq-section-qodix--stack">
        <div className="noviq-wrap">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.members.map((m) => {
              const links = linksOf(m);
              return (
                <li
                  key={m.id}
                  className="noviq-svc-card group flex h-full flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 transition-colors duration-300 hover:border-primary"
                >
                  <div className="flex items-start gap-4">
                    {m.photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.photo}
                        alt={m.name}
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary"
                      >
                        {initials(m.name)}
                      </div>
                    )}

                    <div className="min-w-0">
                      {m.featured && (
                        <span className="eyebrow mb-1 inline-block">{copy.featured}</span>
                      )}
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white break-words">{m.name}</h2>
                      <p className="mt-1 text-sm font-medium" style={{ color: 'hsl(var(--color-accent-action))' }}>
                        {m.role}
                      </p>
                    </div>
                  </div>

                  {m.bio && (
                    <p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-400">{m.bio}</p>
                  )}

                  {links.length > 0 && (
                    <ul className="mt-auto flex flex-wrap gap-2 pt-6">
                      {m.cv && (
                        <li>
                          <a
                            href={m.cv}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="noviq-chip"
                          >
                            {copy.viewCv}
                          </a>
                        </li>
                      )}
                      {links.map((l) => (
                        <li key={l.icon}>
                          <a
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="noviq-chip"
                          >
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-14 flex justify-center">
            <Link href={`/${locale}/careers`} className="noviq-cta-outline">
              {copy.joinUs}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
