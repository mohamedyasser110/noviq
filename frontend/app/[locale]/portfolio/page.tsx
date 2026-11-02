/* ============================================================
   NOVIQ Frontend — Portfolio Page (CMS-driven)
   Projects come from the admin dashboard (Site Content →
   Projects). Falls back to the static seed when offline.
   ============================================================ */
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { readMessage, loadMessages } from '@/lib/i18n';
import { normalizeImageSrc } from '@/lib/media';
import ContactCta from '@/components/contact/ContactCta';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

interface Project {
  id: string;
  tag: string;
  title: string;
  desc: string;
  img: string;
  results: string[];
  /* These two existed in the CMS with Arabic variants from the start, and the
     admin could always edit them, but the card never read them: a case study
     had no challenge or solution on the page, so typing one changed nothing.
     Empty on every shipped project, which is why nobody noticed — and also why
     rendering them now changes nothing visually until someone writes to them. */
  challenge: string;
  solution: string;
  /* Same story, third field: `link` has been in the CMS model all along with
     an editable box in the dashboard, but the card never read it. Optional
     external URL of the live project — rendered only when set. */
  link: string;
}

const FALLBACK_EN: Project[] = [
  { id: 'ai-platform', tag: 'AI Platform', title: 'Predictive Management & Guidance System', desc: 'Smart solution for predicting operational needs, improved efficiency and reduced downtime by 31% across six countries.', img: '/images/project-ai.webp', challenge: '', solution: '', link: '', results: ['40% Efficiency Gain', '99.9% Uptime', '3x ROI'] },
  { id: 'fintech', tag: 'FinTech', title: 'Digital Bank Settlement Infrastructure', desc: 'Real-time processing system handling 4M+ daily transactions with complete reliability.', img: '/images/project-fintech.webp', challenge: '', solution: '', link: '', results: ['4M+ Daily Txns', 'Zero Downtime', 'PCI DSS Compliant'] },
  { id: 'healthcare', tag: 'Healthcare', title: 'Medical Records & Services Platform', desc: 'Secure, fully protected medical platform connecting 200+ clinics with unified health records.', img: '/images/project-healthcare.webp', challenge: '', solution: '', link: '', results: ['200+ Clinics', 'HIPAA Compliant', 'Real-time Sync'] },
  { id: 'retail', tag: 'Smart Retail', title: 'Integrated Commerce Platform', desc: 'Seamless connection between inventory and sales for unified, delightful customer experience.', img: '/images/project-retail.webp', challenge: '', solution: '', link: '', results: ['Omnichannel Ready', 'Real-time Inventory', 'Personalization'] },
];

const FALLBACK_AR: Project[] = [
  { id: 'ai-platform', tag: 'منصة ذكاء اصطناعي', title: 'منظومة إدارة وإرشادات تنبؤية', desc: 'حل ذكي للتنبؤ بالاحتياجات التشغيلية رفع الكفاءة وخفّض زمن التوقف بنسبة 31% عبر ست دول.', img: '/images/project-ai.webp', challenge: '', solution: '', link: '', results: ['40% Efficiency Gain', '99.9% Uptime', '3x ROI'] },
  { id: 'fintech', tag: 'تقنية مالية', title: 'بنية تسويات مالية لبنك رقمي', desc: 'منظومة معالجة لحظية تعالج أكثر من 4 ملايين معاملة يومياً بسلامة واستقرار تام.', img: '/images/project-fintech.webp', challenge: '', solution: '', link: '', results: ['4M+ Daily Txns', 'Zero Downtime', 'PCI DSS Compliant'] },
  { id: 'healthcare', tag: 'رعاية صحية', title: 'منصة السجلات والخدمات الطبية', desc: 'منصة طبية آمنة ومحمية بالكامل تربط أكثر من 200 عيادة بملف صحي موحد.', img: '/images/project-healthcare.webp', challenge: '', solution: '', link: '', results: ['200+ Clinics', 'HIPAA Compliant', 'Real-time Sync'] },
  { id: 'retail', tag: 'التجزئة الذكية', title: 'منظومة التجارة المتكاملة', desc: 'ربط سلس بين المخزون والمبيعات لتوفير تجربة شراء موحدة وممتعة للعملاء.', img: '/images/project-retail.webp', challenge: '', solution: '', link: '', results: ['Omnichannel Ready', 'Real-time Inventory', 'Personalization'] },
];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

async function getProjects(locale: string): Promise<Project[]> {
  const isRTL = locale === 'ar';
  try {
    const data = (await api.content.projects()) as Record<string, unknown>[];
    if (!Array.isArray(data) || !data.length) throw new Error('empty');
    const list: Project[] = data.map((p, i) => {
      const tag = isRTL ? str(p.tagAr) || str(p.tag) : str(p.tag);
      const title = isRTL ? str(p.titleAr) || str(p.title) : str(p.title);
      const desc = isRTL ? str(p.descAr) || str(p.desc) : str(p.desc);
      /* Same precedence as every other field: the Arabic page reads the `Ar`
         sibling and falls back to English rather than dropping the row. A
         missing case study is NOT fatal — it renders no block at all, which is
         what the shipped projects do. */
      const challenge = isRTL ? str(p.challengeAr) || str(p.challenge) : str(p.challenge);
      const solution = isRTL ? str(p.solutionAr) || str(p.solution) : str(p.solution);
      /* The admin stores `images/…` with no leading slash, which the browser
         resolves relative to /en/portfolio and 404s. Root-absolute it. */
      const img = normalizeImageSrc(p.img, '/images/project-ai.webp');
      /* Result chips come from ONE comma-separated admin field (`results`),
         so the pills are editable from Site Content → Projects like any
         other field. Arabic reads the `resultsAr` sibling and falls back to
         the English chips rather than dropping the row. */
      const rawResults = isRTL ? str(p.resultsAr) || str(p.results) : str(p.results);
      const results = rawResults
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      return {
        id: `project-${i}`,
        tag: tag || (isRTL ? 'مشروع' : 'Project'),
        title,
        desc,
        img,
        challenge,
        solution,
        /* Optional live-project URL. https-only: anything else (including
           javascript:) is dropped rather than rendered, because this href
           goes straight into the DOM. Empty everywhere today, so no card
           changes until an admin pastes one. */
        link: /^https:\/\/[^\s"'<>]+$/i.test(str(p.link)) ? str(p.link).trim() : '',
        results: results.length ? results : (isRTL ? FALLBACK_AR[i % FALLBACK_AR.length].results : FALLBACK_EN[i % FALLBACK_EN.length].results),
      };
    }).filter((p) => p.title && p.desc);
    if (!list.length) throw new Error('no usable');
    return list;
  } catch {
    return isRTL ? FALLBACK_AR : FALLBACK_EN;
  }
}

/* The CMS header for this page. Falls back to the shipped copy when the API is
   offline or the key is missing, exactly like the other content libs. */
async function getPortfolioHeader(locale: string): Promise<{ title: string; description: string }> {
  const isRTL = locale === 'ar';
  const fallback = {
    title: isRTL ? 'أعمال مختارة' : 'Featured Work',
    description: isRTL
      ? 'مشاريع حقيقية ونتائج حقيقية — شاهد كيف ساعدنا الشركات على التحوّل.'
      : "Real projects, real results — see how we've helped businesses transform.",
  };
  try {
    const all = (await api.content.get()) as Record<string, unknown>;
    const header = (all.portfolioHeader || {}) as Record<string, unknown>;
    /* Arabic reads the `Ar` sibling only, so the English key can never leak
       into the Arabic page; English reads the plain key. */
    const pick = (field: string) => {
      const v = isRTL ? header[field + 'Ar'] : header[field];
      return typeof v === 'string' && v.trim() ? v : '';
    };
    const title = pick('title');
    const description = pick('desc') || pick('description');
    if (!title && !description) throw new Error('empty header');
    return { title: title || fallback.title, description: description || fallback.description };
  } catch {
    return fallback;
  }
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await loadMessages(locale);
  const isRTL = locale === 'ar';
  const projects = await getProjects(locale);
  /* Card CTA is dictionary-driven so the admin can reword it from
     Site Content → Translations; the literal is the unchanged fallback. */
  const viewCaseStudy = readMessage(messages, 'portfolio.viewCaseStudy') || (isRTL ? 'عرض دراسة الحالة' : 'View Case Study');
  /* The two case-study labels are dictionary-driven for the same reason the CTA
     is: the admin can reword them from Site Content → Translations. */
  const challengeLabel = readMessage(messages, 'portfolio.challenge') || (isRTL ? 'التحدي' : 'Challenge');
  const solutionLabel = readMessage(messages, 'portfolio.solution') || (isRTL ? 'الحل' : 'Solution');
  /* Secondary link label, dictionary-driven like the rest so it can be
     reworded from Translations. */
  const liveProjectLabel = readMessage(messages, 'portfolio.liveProject') || (isRTL ? 'المشروع المباشر' : 'Live project');

  /* The page heading now honours the CMS `portfolioHeader` section. It used to
     read only the i18n dictionary, which made the whole admin section a dead
     key — an edit there could never reach the page. Same precedence as the
     other CMS pages: CMS → dictionary → the original literal, with Arabic
     taking the `Ar` sibling and never borrowing the English key. */
  const header = await getPortfolioHeader(locale);
  const heading = header.title;
  const intro = header.description;

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {heading}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {intro}
          </p>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={project.img}
                    alt=""
                    width={1024}
                    height={1024}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 text-xs font-medium bg-primary/90 text-white rounded-full">
                      {project.tag}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {project.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-4" dir="auto">
                    {/* dir="auto" for the same reason as the footer tagline:
                        this is CMS prose with an `Ar` sibling, so the Arabic
                        page usually shows the English fallback. In an RTL
                        context bidi relocates terminal punctuation to the
                        wrong end of the line. */}
                    {project.desc}
                  </p>
                  {/* The case study block only exists when the admin wrote
                      something, so a project without one looks exactly as it did
                      before this was wired. `border-s`/`ps` rather than
                      `border-l`/`pl` so the accent follows the text in Arabic. */}
                  {project.challenge || project.solution ? (
                    <dl className="mb-4 space-y-2">
                      {project.challenge ? (
                        <div className="border-s-2 border-primary ps-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {challengeLabel}
                          </dt>
                          <dd className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                            {project.challenge}
                          </dd>
                        </div>
                      ) : null}
                      {project.solution ? (
                        <div className="border-s-2 border-primary ps-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {solutionLabel}
                          </dt>
                          <dd className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                            {project.solution}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.results.map((result, j) => (
                      <span
                        key={j}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                  {/* Primary CTA keeps the contact chooser (names the project).
                      The live-project URL is a SECONDARY external link that
                      exists only when the admin pasted one — empty on every
                      shipped project, so cards without it look exactly as
                      before. */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <ContactCta
                      locale={locale}
                      isArabic={isRTL}
                      className="inline-flex items-center gap-2 min-h-[44px] text-primary font-medium hover:underline"
                      subject={project.title}
                    >
                      {viewCaseStudy}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </ContactCta>
                    {project.link ? (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 transition-colors hover:text-primary dark:hover:text-primary"
                      >
                        {liveProjectLabel}
                        {/* External-link glyph, mirrored in RTL like the logout icon. */}
                        <span aria-hidden="true" style={isRTL ? { transform: 'scaleX(-1)' } : undefined} className="inline-flex">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 17 17 7" />
                            <path d="M8 7h9v9" />
                          </svg>
                        </span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
