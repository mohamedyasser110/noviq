/* ============================================================
   NOVIQ Frontend — API Documentation Page (resource)
   Static endpoint reference for the public backend API.
   ============================================================ */
import { notFound } from 'next/navigation';
import { isPageEnabled } from '@/lib/pages-content';

const ENDPOINTS = [
  { method: 'POST', path: '/api/contact', en: 'Submit contact form', ar: 'إرسال نموذج التواصل' },
  { method: 'POST', path: '/api/newsletter/subscribe', en: 'Subscribe to newsletter', ar: 'الاشتراك في النشرة البريدية' },
  { method: 'POST', path: '/api/assessment', en: 'Submit assessment', ar: 'إرسال التقييم' },
  { method: 'POST', path: '/api/consultation', en: 'Submit consultation request', ar: 'طلب استشارة' },
  { method: 'GET', path: '/api/health', en: 'Health check', ar: 'فحص حالة الخدمة' },
  { method: 'GET', path: '/api/content', en: 'Get public content', ar: 'جلب المحتوى العام' },
  { method: 'GET', path: '/api/content/home', en: 'Get homepage bundle', ar: 'جلب حزمة الرئيسية' },
  { method: 'GET', path: '/api/content/pages', en: 'Get page visibility', ar: 'جلب ظهور الصفحات' },
];

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await isPageEnabled('resource'))) notFound();
  const isArabic = locale === 'ar';

  return (
    <>
      <div className="noviq-page-hero">
        <div className="noviq-breadcrumb">
          <a href={`/${locale}`}>{isArabic ? 'الرئيسية' : 'Home'}</a> <span>/</span>{' '}
          <span>{isArabic ? 'التوثيق' : 'Documentation'}</span>
        </div>
        <h1>{isArabic ? 'توثيق API' : 'API Documentation'}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isArabic ? 'اتصل برمجياً مع واجهة الباكند.' : 'Connect programmatically to the backend API.'}
        </p>
      </div>

      <div className="noviq-page-section">
        <div className="noviq-glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
            {isArabic ? 'النقاط النهائية' : 'Endpoints'}
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {ENDPOINTS.map((e) => (
              <div key={e.path} style={{ fontFamily: 'JetBrains Mono', fontSize: '13px' }}>
                <code>{e.method} {e.path}</code> —{' '}
                {isArabic ? e.ar : e.en}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
