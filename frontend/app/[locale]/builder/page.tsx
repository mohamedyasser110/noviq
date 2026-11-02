/* ============================================================
   NOVIQ Frontend — Solution Builder Page (CMS visibility-aware)
   ------------------------------------------------------------
   A configurator with NO prices: the visitor describes their project
   and sends that description to the team as a project request.

   What it renders is decided by the admin, not by this file:

     solutionBuilder.steps = [{ key, label, title, desc, multi,
                                options: [{ value, label, icon }] }]

   Each step becomes one labelled section; `multi: true` allows several
   picks, otherwise it is a single choice. Production ships eight of
   them (Business, Scope, Features, AI, Integrations, Design,
   Timeline, Budget) and the admin can add, rename or remove any.

   Why this shape and not the old two-grid version
   ------------------------------------------------
   It used to flatten the options of EVERY step into one grid under the
   second step's label, so "Under $10K" (a budget) sat in the same row as
   "SaaS / Tech" (an industry) under a heading called "Scope", and the
   request that reached the team named one feature plus one of those —
   silently dropping everything else the visitor had chosen. A builder
   that throws away the answer is worse than no builder: the team
   receives a description of a project nobody described.

   Sending requires a client account. Visitors are asked to register;
   signed-in clients post straight to /api/portal/requests, the queue the
   admin triages in Client Projects.

   Visibility is controlled from the admin (Site Content → Pages): when
   `builder` is disabled the page renders the locale 404. Offline/API
   failure falls back to the two shipped dimensions below.
   ============================================================ */
'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api-client';

/* Offline fallback only — no prices, no cost factors. */
const FALLBACK_SERVICES = [
  { id: 'ai', en: 'AI Solutions', ar: 'حلول الذكاء الاصطناعي' },
  { id: 'custom', en: 'Custom Software', ar: 'برمجيات مخصصة' },
  { id: 'erp', en: 'ERP System', ar: 'نظام ERP' },
  { id: 'crm', en: 'CRM Platform', ar: 'منصة CRM' },
  { id: 'saas', en: 'SaaS Product', ar: 'منتج SaaS' },
  { id: 'web', en: 'Web Application', ar: 'تطبيق ويب' },
  { id: 'mobile', en: 'Mobile App', ar: 'تطبيق موبايل' },
  { id: 'api', en: 'API Development', ar: 'تطوير API' },
];

const FALLBACK_SCALES = [
  { id: 'mvp', en: 'MVP (4–6 weeks)', ar: 'نموذج أولي (4–6 أسابيع)' },
  { id: 'growth', en: 'Growth (2–4 months)', ar: 'نمو (2–4 أشهر)' },
  { id: 'enterprise', en: 'Enterprise (4+ months)', ar: 'مؤسسي (4+ أشهر)' },
];

type Opt = { id: string; en: string; ar: string };
type Dim = { key: string; label: string; labelAr: string; multi: boolean; options: Opt[] };

/* First value that is actually a non-empty string.
   `??` is not enough here: when the admin saves a row with its Arabic box
   cleared, the field exists and holds "", which is not nullish — so `??`
   would keep the empty string and the Arabic page would render a blank
   label for that step or option. Only a MISSING field should fall back. */
function firstText(...values: unknown[]): string {
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  }
  return '';
}

/* Request mapping: builder options are capabilities, request categories are
   product shapes — closest fit wins, unknown falls back to other. */
const BUILDER_CATEGORY: Record<string, string> = {
  web: 'website',
  website: 'website',
  mobile: 'mobile-app',
  erp: 'erp-crm',
  crm: 'erp-crm',
  ai: 'ai-solution',
};

export default function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Client component: unwrap the params promise with use().
  const { locale } = use(params);
  const isArabic = locale === 'ar';

  /* CMS visibility: hide the whole page when the admin disables it. */
  const [visibility, setVisibility] = useState<'loading' | 'open' | 'closed'>('loading');
  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/content/pages`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const entry =
          data && typeof data === 'object'
            ? (data as Record<string, { enabled?: boolean }>)['builder']
            : undefined;
        if (!entry) return setVisibility('open');
        setVisibility(entry.enabled === false ? 'closed' : 'open');
      })
      .catch(() => {
        if (!cancelled) setVisibility('open');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* One section per CMS step. Starts on the shipped fallback so the first
     paint is never empty, then replaced by whatever the admin published. */
  const [dims, setDims] = useState<Dim[]>([
    {
      key: 'services',
      label: isArabic ? 'الخدمات' : 'Services',
      labelAr: 'الخدمات',
      multi: true,
      options: FALLBACK_SERVICES,
    },
    {
      key: 'scales',
      label: isArabic ? 'حجم المشروع' : 'Project scale',
      labelAr: 'حجم المشروع',
      multi: false,
      options: FALLBACK_SCALES,
    },
  ]);
  /* picks[dimKey] = the chosen option ids for that dimension. */
  const [picks, setPicks] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/content`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== 'object') return;
        const all = data as Record<string, unknown>;
        const steps = (all.solutionBuilder as { steps?: unknown })?.steps;

        const next: Dim[] = [];
        /* Two dimensions sharing a key would share one entry in `picks`, so a
           picking made in one would show up — and be sent — in the other. The
           CMS is admin-editable, so a duplicated key is one typo away. Keep
           the first and suffix the rest. */
        const usedKeys = new Set<string>();
        if (Array.isArray(steps)) {
          for (const raw of steps) {
            if (!raw || typeof raw !== 'object') continue;
            const step = raw as Record<string, unknown>;
            const options: Opt[] = (Array.isArray(step.options) ? step.options : [])
              .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
              .map((o) => {
                const id = String(o.value ?? o.id ?? '').trim();
                const label = String(o.label ?? '').trim();
                return { id, en: label, ar: firstText(o.labelAr, label) };
              })
              .filter((o) => o.id && o.en);
            if (!options.length) continue;
            let key = String(step.key ?? '').trim() || `step${next.length + 1}`;
            if (usedKeys.has(key)) key = `${key}-${usedKeys.size + 1}`;
            usedKeys.add(key);
            next.push({
              key,
              label: String(step.label ?? '').trim() || key,
              labelAr: firstText(step.labelAr, step.label, key),
              /* `multi` absent means single-choice: picking one replaces the
                 last, which is what a radio group does. */
              multi: step.multi === true,
              options,
            });
          }
        }

        /* costEstimator.features is the other admin-maintained list — it was
           the original services grid. Keep it, but only if it does not merely
           repeat options already present in a step (the `features` step is
           the same list in most installs). */
        const features = (all.costEstimator as { features?: unknown })?.features;
        if (Array.isArray(features)) {
          const caps: Opt[] = features
            .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
            .map((f) => {
              const id = String(f.key ?? f.id ?? '').trim();
              const label = String(f.label ?? '').trim();
              return { id, en: label, ar: firstText(f.labelAr, label) };
            })
            .filter((o) => o.id && o.en);
          const seen = new Set(next.flatMap((d) => d.options.map((o) => o.id)));
          const extra = caps.filter((c) => !seen.has(c.id));
          if (extra.length) {
            /* Same collision rule as the steps above: this synthetic section
               must not land on a key a CMS step already claimed. */
            let capKey = 'capabilities';
            if (usedKeys.has(capKey)) capKey = `${capKey}-extra`;
            usedKeys.add(capKey);
            next.push({
              key: capKey,
              label: 'Capabilities',
              labelAr: 'الإمكانات',
              multi: true,
              options: extra,
            });
          }
        }

        if (!next.length) return; /* keep the shipped fallback */
        setDims(next);
        /* Drop picks whose option no longer exists, so a CMS edit can never
           leave an invisible stale selection in the request. */
        setPicks((prev) => {
          const valid: Record<string, string[]> = {};
          for (const d of next) {
            const ids = d.options.map((o) => o.id);
            const kept = (prev[d.key] || []).filter((id) => ids.includes(id));
            valid[d.key] = d.multi ? kept : kept.slice(-1);
          }
          return valid;
        });
      })
      .catch(() => {
        /* offline / API down — the shipped fallback above stays in place */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (dim: Dim, id: string) =>
    setPicks((prev) => {
      const current = prev[dim.key] || [];
      if (dim.multi) {
        return {
          ...prev,
          [dim.key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
        };
      }
      /* single choice — clicking the active one clears it */
      return { ...prev, [dim.key]: current.includes(id) ? [] : [id] };
    });

  const label = (o: Opt) => (isArabic && o.ar ? o.ar : o.en);

  /* Everything the visitor chose, dimension by dimension. */
  const answered = useMemo(
    () =>
      dims
        .map((d) => ({
          dim: d,
          name: isArabic ? d.labelAr : d.label,
          chosen: d.options.filter((o) => (picks[d.key] || []).includes(o.id)),
        }))
        .filter((row) => row.chosen.length > 0),
    [dims, picks, isArabic]
  );

  const chosenIds = answered.flatMap((row) => row.chosen.map((o) => o.id));

  /* The title names the first dimension answered (usually the industry);
     the description carries every dimension, so the team sees the whole
     brief rather than a fragment. */
  const primary = answered[0];
  const requestTitle = primary
    ? primary.chosen.map(label).join(' + ').slice(0, 160)
    : '';

  const detail = answered
    .map((row) => `${row.name}: ${row.chosen.map(label).join(', ')}`)
    .join('\n');
  const detailAr = answered
    .map((row) => `${row.name}: ${row.chosen.map((o) => o.ar || o.en).join('، ')}`)
    .join('\n');

  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const { isLoggedIn, loading: authLoading } = useAuth();
  const router = useRouter();

  const sendAsRequest = () => {
    /* Accounts only: visitors are asked to register first. */
    if (!isLoggedIn) {
      router.push(`/${locale}/signup`);
      return;
    }
    if (!requestTitle || sendState === 'sending') return;
    setSendState('sending');
    const category =
      chosenIds.map((id) => BUILDER_CATEGORY[id]).find(Boolean) || 'other';
    /* The request form has a timeline column — feed it the Timeline step
       when the admin published one. */
    const timelineRow = answered.find((r) => /timeline|جدول|زمن/i.test(r.dim.key));
    api.portal
      .createRequest({
        title: requestTitle,
        category,
        timeline: timelineRow ? timelineRow.chosen.map(label).join(', ') : '',
        description: (isArabic
          ? `طلب مبني من منشئ الحلول:\n${detailAr}`
          : `Built with the Solution Builder:\n${detail}`
        ).slice(0, 4000),
      })
      .then(() => setSendState('sent'))
      .catch(() => setSendState('error'));
  };

  if (visibility === 'closed') notFound();
  if (visibility === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">{isArabic ? 'جاري التحميل…' : 'Loading…'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {isArabic ? 'منشئ الحلول' : 'Solution Builder'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {isArabic
              ? 'اختر ما يناسب مشروعك — ثم أرسل اختيارك كطلب مشروع يصل فريقنا مباشرة.'
              : 'Tell us what your project needs — then send your selection as a project request straight to our team.'}
          </p>
        </div>
      </div>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* One section per CMS step, in the admin's order. Multi steps take
              several picks; single steps replace the previous choice. */}
          {dims.map((dim, i) => (
            <div key={dim.key} className="mb-12 last:mb-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                {i + 1}. {isArabic ? dim.labelAr : dim.label}
              </h2>
              {dim.multi ? null : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {isArabic ? 'اختر خياراً واحداً' : 'Choose one'}
                </p>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dim.options.map((o) => {
                  const active = (picks[dim.key] || []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(dim, o.id)}
                      aria-pressed={active}
                      className={`rounded-xl border p-4 text-start transition-all ${
                        active
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-slate-900 dark:text-white text-sm">
                        {label(o)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Summary + send: no prices anywhere on this surface. Signed-in
              clients file the selection as a project request (tracked on
              their dashboard, triaged by the admin); visitors are asked to
              create an account first. */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {isArabic ? 'اختيارك' : 'Your selection'}
            </p>
            {answered.length === 0 ? (
              <p className="text-lg text-slate-500 dark:text-slate-400 mb-2">
                {isArabic ? 'اختر خياراً للبدء' : 'Pick an option to get started'}
              </p>
            ) : (
              <ul className="mx-auto mb-4 max-w-xl space-y-1.5 text-start">
                {answered.map((row) => (
                  <li key={row.dim.key} className="text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {row.name}:
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">
                      {row.chosen.map(label).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {!isLoggedIn && !authLoading
                ? isArabic
                  ? 'إرسال الطلب يتطلب حساباً — ستنتقل لإنشاء واحد.'
                  : 'Sending requires an account — you’ll be asked to create one.'
                : isArabic
                  ? 'سيصل الفريق مباشرة ويمكنك متابعته من لوحتك.'
                  : 'Reaches the team directly, tracked on your dashboard.'}
            </p>
            {sendState === 'sent' ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                {isArabic ? 'تم إرسال طلبك — تابع حالته من لوحتك.' : 'Request sent — track its status on your dashboard.'}
              </p>
            ) : (
              <button
                type="button"
                onClick={sendAsRequest}
                disabled={!requestTitle || sendState === 'sending' || authLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sendState === 'sending'
                  ? isArabic
                    ? 'جارٍ الإرسال…'
                    : 'Sending…'
                  : !isLoggedIn && !authLoading
                    ? isArabic
                      ? 'إنشاء حساب وإرسال الطلب'
                      : 'Create account & send request'
                    : isArabic
                      ? 'إرسال كطلب مشروع'
                      : 'Send as project request'}
              </button>
            )}
            {sendState === 'error' && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {isArabic ? 'تعذر الإرسال. حاول مجدداً.' : 'Could not send. Please try again.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}