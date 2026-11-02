/* ============================================================
   NOVIQ Frontend — Toolkit Page (CMS-driven)
   Stack list + header come from the admin dashboard
   (Site Content → Tech Stack / Stack Header).
   ============================================================ */
import { api } from '@/lib/api-client';
import { notFound } from 'next/navigation';
import { isPageEnabled } from '@/lib/pages-content';
import { createIcon } from '@/lib/utils';
import Link from 'next/link';

const FALLBACK_STACK = [
  'React', 'Next.js', 'Node.js', 'TypeScript',
  'Python', 'TensorFlow', 'PyTorch', 'OpenAI',
  'PostgreSQL', 'MongoDB', 'Redis', 'Docker',
  'Kubernetes', 'AWS', 'Azure', 'Google Cloud',
];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default async function ToolkitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await isPageEnabled('toolkit'))) notFound();
  const isArabic = locale === 'ar';

  let eyebrow = isArabic ? 'أدواتنا' : 'Our Toolkit';
  let title = isArabic ? 'التقنيات التي نثق بها' : 'Technology We Trust';
  let desc = isArabic
    ? 'التقنيات المجرّبة التي نقود بها كل مشروع — مختارة للأداء والأمان وقابلية التوسع.'
    : 'The proven stack behind every project we ship — picked for performance, security and scale.';
  let stack: string[] = FALLBACK_STACK;
  try {
    const all = await api.content.get();
    const header = (all.stackHeader || {}) as Record<string, unknown>;
    /* The CMS stores the two languages side by side (`eyebrow` + `eyebrowAr`),
       so each field has to be picked per locale — reading the base key first
       would hand the Arabic page the English copy. */
    const pick = (base: string, arKey: string): string => {
      if (isArabic) { const a = str(header[arKey]); if (a) return a; }
      return str(header[base]);
    };
    const e = pick('eyebrow', 'eyebrowAr');
    if (e) eyebrow = e;
    const t = pick('title', 'titleAr');
    if (t) title = t;
    const d = pick('desc', 'descAr');
    if (d) desc = d;
    if (Array.isArray(all.stack) && all.stack.length) {
      stack = (all.stack as unknown[]).filter((s): s is string => typeof s === 'string' && !!s.trim());
      if (!stack.length) stack = FALLBACK_STACK;
    }
  } catch {
    /* offline → static seed above */
  }

  return (
    <>
      <div className="noviq-page-hero">
        <div className="noviq-breadcrumb">
          <a href={`/${locale}`}>{isArabic ? 'الرئيسية' : 'Home'}</a> <span>/</span>{' '}
          <span>{isArabic ? 'أدواتنا' : 'Our Toolkit'}</span>
        </div>
        <div className="noviq-hero-badge">
          {createIcon('layers', { className: 'inline-block h-4 w-4 align-middle' })}{' '}
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>

      <div className="noviq-page-section">
        <div className="noviq-stack-grid" data-no-translate="true">
          {stack.map((tech, i) => (
            <div
              key={tech}
              className="noviq-stack-tile"
              style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
            >
              {/* Monogram: the name itself is the mark, so no icon library
                  and no uploaded asset is needed per technology. */}
              <span className="noviq-stack-mark" aria-hidden="true">
                {tech.replace(/[^A-Za-z0-9+#.]/g, '').slice(0, 2) || '•'}
              </span>
              <span className="noviq-stack-name" dir="ltr">
                {tech}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="noviq-page-section-alt" style={{ textAlign: 'center' }}>
        <h2>{isArabic ? 'عندك stack في بالك؟' : 'Have a stack in mind?'}</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 28px' }}>
          {isArabic
            ? 'استخدم منشئ الحلول لترشيح مخصص يناسب احتياجاتك.'
            : 'Use our Solution Builder to get a custom recommendation.'}
        </p>
        <Link
          className="noviq-btn-primary"
          href={`/${locale}/builder`}
        >
          {isArabic ? 'ابنِ حلاً مخصصاً' : 'Build Custom'}
        </Link>
      </div>
    </>
  );
}
