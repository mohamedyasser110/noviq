/* ============================================================
   NOVIQ Frontend — Why Noviq Page (CMS-driven)
   Cards + header come from the admin dashboard (Site Content →
   Why Noviq / Why Header). Falls back to the static seed offline.
   ============================================================ */
import { api } from '@/lib/api-client';
import ContactCta from '@/components/contact/ContactCta';
import { readMessage, loadMessages, type MessagesTree } from '@/lib/i18n';
import { createIcon } from '@/lib/utils';

interface WhyItem {
  title: string;
  desc: string;
  icon: string;
}

const FALLBACK_EN: WhyItem[] = [
  { title: 'Engineering Excellence', desc: 'Clean, tested code — every line reviewed before it ships.', icon: 'code' },
  { title: 'Radical Transparency', desc: 'Clear scope, clear pricing, weekly progress reports. No surprises.', icon: 'eye' },
  { title: 'Partnership, Not Contracting', desc: 'We measure success by your growth, and we stay after launch.', icon: 'users' },
  { title: 'Security First', desc: 'Encryption, access control, and auditing baked into every layer.', icon: 'shield-check' },
];

const FALLBACK_AR: WhyItem[] = [
  { title: 'التميز الهندسي', desc: 'نكتب كوداً نظيفاً قابلاً للاختبار، ونراجع كل سطر قبل الشحن.', icon: 'code' },
  { title: 'الشفافية الكاملة', desc: 'نطاق واضح، سعر واضح، وتقارير تقدم أسبوعية — بلا مفاجآت.', icon: 'eye' },
  { title: 'الشراكة لا المقاولة', desc: 'نقيس نجاحنا بنمو عملك، ونبقى بعد الإطلاق.', icon: 'users' },
  { title: 'الأمان أولاً', desc: 'تشفير، صلاحيات، وتدقيق — مدمجة في كل طبقة.', icon: 'shield-check' },
];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Read a flat CMS header field for this locale.
 *  The admin object editor writes Arabic into a `<field>Ar` sibling, so Arabic
 *  must read that first and must NEVER fall back to the plain English key — that
 *  leak is what made the Arabic "Why Noviq" page show English headings. */
function localized(
  header: Record<string, unknown>,
  field: string,
  isArabic: boolean,
  messages: MessagesTree | null,
  dictionaryKey: string,
  literal: string
): string {
  if (!isArabic) {
    return str(header[field]) || readMessage(messages || {}, dictionaryKey) || literal;
  }
  const ar = header[field + 'Ar'];
  if (typeof ar === 'string' && ar.trim()) return ar;
  return readMessage(messages || {}, dictionaryKey) || literal;
}

async function getWhy(
  locale: string,
  messages: MessagesTree
): Promise<{ eyebrow: string; title: string; desc: string; items: WhyItem[] }> {
  const isRTL = locale === 'ar';
  const fb = isRTL ? FALLBACK_AR : FALLBACK_EN;
  const meta = {
    eyebrow: isRTL ? 'لماذا نوفيك' : 'Why Noviq',
    title: isRTL ? 'لماذا نوفيك' : 'Why Noviq',
    desc: isRTL ? 'صُممت لتكون مختلفة، وبُنيت لتدوم.' : 'Built different. Built to last.',
  };
  try {
    const all = await api.content.get();
    const header = (all.whyHeader || {}) as Record<string, unknown>;
    const raw = Array.isArray(all.why) ? (all.why as Record<string, unknown>[]) : [];
    /* The `why` cards are CMS-authored copy; Arabic honours `titleAr`/`descAr`
       when the admin filled them in, and keeps the Arabic seed otherwise. */
    const items: WhyItem[] = raw.map((w) => ({
      title: isRTL ? str(w.titleAr) || str(w.title) : str(w.title),
      desc: isRTL ? str(w.descAr) || str(w.desc) : str(w.desc),
      icon: str(w.icon) || 'sparkles',
    })).filter((w) => w.title);
    return {
      eyebrow: localized(header, 'eyebrow', isRTL, messages, 'why.title', meta.eyebrow),
      title: localized(header, 'title', isRTL, messages, 'why.title', meta.title),
      desc: localized(header, 'desc', isRTL, messages, 'why.desc', meta.desc),
      items: items.length ? items : fb,
    };
  } catch {
    return { ...meta, items: fb };
  }
}

export default async function WhyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  const messages = await loadMessages(locale);
  const content = await getWhy(locale, messages);
  const homeLabel = readMessage(messages, 'common.home') || (isArabic ? 'الرئيسية' : 'Home');
  const talkToUs = readMessage(messages, 'common.talkToUs') || (isArabic ? 'تحدث معنا' : 'Talk to Us');

  return (
    <>
      <div className="noviq-page-hero">
        <div className="noviq-breadcrumb">
          <a href={`/${locale}`}>{homeLabel}</a> <span>/</span>{' '}
          <span>{content.title}</span>
        </div>
        <div className="noviq-hero-badge">
          {createIcon('sparkles', { className: 'inline-block h-4 w-4 align-middle' })}{' '}
          {content.eyebrow}
        </div>
        <h1>{content.title}</h1>
        <p>{content.desc}</p>
      </div>

      <div className="noviq-page-section">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {content.items.map((item, i) => (
            <div
              key={item.title}
              className="noviq-glass-card"
              style={{ padding: '32px', transitionDelay: `${(i % 4) * 90}ms` }}
            >
              <div className="noviq-icon-badge" style={{ margin: '0 auto 12px' }}>
                {createIcon(item.icon || 'sparkles', { className: 'h-5 w-5' })}
              </div>
              <h3 style={{ textAlign: 'center' }}>
                {item.title}
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  marginTop: '12px',
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <ContactCta locale={locale} className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors">
            {talkToUs}
          </ContactCta>
        </div>
      </div>
    </>
  );
}
