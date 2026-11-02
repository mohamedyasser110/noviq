'use client';

/* ============================================================
   NOVIQ — Liftoff Band + Terminal Card
   Antigravity-inspired "Experience liftoff" section, adapted to
   Noviq identity (deep navy, gold rule, liquid-N glow).
   Self-contained locale literals — no translation-file edits needed.
   ============================================================ */
import Link from 'next/link';
import ContactCta from '@/components/contact/ContactCta';

interface LiftoffProps {
  locale: 'en' | 'ar';
  /* Partial on purpose: the homepage feeds title/desc from the CONTACT
     bundle (never the hero), CTA labels fall back to the distinct
     defaults below so this band never echoes the hero. */
  copy?: { eyebrow?: string; titleLead?: string; titleAccent?: string; desc?: string; primary?: string; secondary?: string };
}

const copy = {
  en: {
    eyebrow: 'New · Agent-first engineering',
    titleLead: 'Experience liftoff',
    titleAccent: 'with Noviq',
    desc: 'From first sketch to production — intelligent software, AI platforms, and enterprise systems engineered end to end.',
    primary: 'Meet Our Team',
    secondary: 'Talk to Us',
    terminal: [
      { prompt: true, text: 'noviq init --ai' },
      { prompt: false, text: '✓ Scaffolding SaaS platform…' },
      { prompt: false, text: '✓ Wiring API + auth + billing…' },
      { prompt: false, text: '✓ Deploying to edge · 32 regions…' },
      { prompt: false, text: '→ Live in 6 weeks.', caret: true },
    ],
  },
  ar: {
    eyebrow: 'جديد · هندسة بعقلية الوكلاء',
    titleLead: 'انطلق',
    titleAccent: 'مع نوفيك',
    desc: 'من أول فكرة إلى الإنتاج — برمجيات ذكية ومنصات ذكاء اصطناعي وأنظمة مؤسسية تُهندس من البداية إلى النهاية.',
    primary: 'تعرف على فريقنا',
    secondary: 'تحدث معنا',
    terminal: [
      { prompt: true, text: 'noviq init --ai' },
      { prompt: false, text: '✓ تجهيز منصة SaaS…' },
      { prompt: false, text: '✓ ربط API + الدخول + الفوترة…' },
      { prompt: false, text: '✓ النشر على الأطراف · 32 منطقة…' },
      { prompt: false, text: '→ الإطلاق خلال 6 أسابيع.', caret: true },
    ],
  },
} as const;

export function LiftoffBand({ locale, copy: copyProp }: LiftoffProps) {
  const base = copy[locale] ?? copy.en;
  /* CMS-first: homepage CTA copy from the contact content bundle. */
  const t = { ...base, ...(copyProp || {}) };
  return (
    <section className="noviq-liftoff" aria-labelledby="liftoff-title">
      <div className="noviq-liftoff-inner">
        <div className="noviq-liftoff-copy">
          <span className="noviq-liftoff-eyebrow">
            {t.eyebrow}
          </span>
          <h2 id="liftoff-title" className="noviq-liftoff-title">
            {t.titleLead}{' '}
            {t.titleAccent ? <span className="text-gradient-brand">{t.titleAccent}</span> : null}
          </h2>
          <p className="noviq-liftoff-desc">{t.desc}</p>
          <div className="noviq-liftoff-actions">
            <Link href={`/${locale}/team`} className="noviq-btn-primary noviq-btn-sm">
              {t.primary}
            </Link>
            <ContactCta locale={locale} className="noviq-btn-ghost noviq-btn-sm">
              {t.secondary}
            </ContactCta>
          </div>
        </div>
        <div className="noviq-liftoff-visual">
          <TerminalCard locale={locale} />
        </div>
      </div>
    </section>
  );
}

export function TerminalCard({ locale }: LiftoffProps) {
  const t = copy[locale] ?? copy.en;
  return (
    <div className="noviq-terminal" role="img" aria-label="Noviq delivery pipeline preview">
      <div className="noviq-terminal-bar" aria-hidden="true">
        <span className="noviq-terminal-dot noviq-terminal-dot--red" />
        <span className="noviq-terminal-dot noviq-terminal-dot--yellow" />
        <span className="noviq-terminal-dot noviq-terminal-dot--green" />
        <span className="noviq-terminal-title">noviq — zsh</span>
      </div>
      <div className="noviq-terminal-body" dir="ltr">
        {t.terminal.map((line, i) => (
          <p key={i} className={line.prompt ? 'noviq-terminal-prompt' : 'noviq-terminal-ok'}>
            {line.prompt && <span className="noviq-terminal-ps">$ </span>}
            {line.text}
            {'caret' in line && line.caret && <span className="noviq-terminal-caret" aria-hidden="true" />}
          </p>
        ))}
      </div>
    </div>
  );
}
