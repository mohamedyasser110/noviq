'use client';

import { useTranslations } from 'next-intl';
import { Search, PenTool, Layers, Hammer, Bug, UploadCloud, LifeBuoy } from 'lucide-react';

interface ProcessProps {
  locale: string;
  header?: { eyebrow: string; title: string; desc: string };
  items?: { title: string; desc: string }[];
}

const stepIcons = [Search, PenTool, Layers, Hammer, Bug, UploadCloud, LifeBuoy];
const stepKeys = ['discovery', 'planning', 'design', 'development', 'testing', 'launch', 'support'];

export default function Process({ locale, header, items }: ProcessProps) {
  const t = useTranslations();
  /* CMS-first: resolved strings from the homepage bundle; otherwise i18n. */
  const head = {
    eyebrow: header?.eyebrow || t('process.eyebrow') || 'How we work',
    title: header?.title || t('process.title'),
    desc: header?.desc || t('process.description'),
  };
  const steps = (items && items.length ? items : stepKeys.map((k) => ({ title: t(`process.${k}`), desc: t(`process.${k}Desc`) }))).map((s, i) => ({
    ...s,
    number: String(i + 1).padStart(2, '0'),
    icon: stepIcons[i % stepIcons.length],
  }));

  return (
    <section className="noviq-section-qodix bg-slate-50/60 dark:bg-slate-900/40" aria-labelledby="process-heading">
      <div className="noviq-wrap">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow">{head.eyebrow}</p>
          <h2 id="process-heading" className="noviq-h2 mt-5 text-slate-900 dark:text-white">
            {head.title}
          </h2>
          <p className="noviq-lead">
            {head.desc}
          </p>
        </div>

        <div className="relative">
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="noviq-process-step border-t pt-8"
                style={{ borderColor: 'hsl(var(--color-accent) / 0.4)' }}
              >
                <div className="flex items-center gap-4">
                  <span className="noviq-process-num font-mono font-bold">{step.number}</span>
                  <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
