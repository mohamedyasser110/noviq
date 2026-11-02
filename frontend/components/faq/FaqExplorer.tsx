/* FAQ explorer (client): live search over questions + answers with a
   smooth single-open accordion. The page stays a server component for
   ISR; only this island hydrates. First item opens by default so the
   list never greets visitors as a wall of closed rows. */
'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FaqEntry {
  q: string;
  a: string;
}

export default function FaqExplorer({
  items,
  isArabic,
  searchPlaceholder,
  noResults,
  resultsTemplate,
}: {
  items: FaqEntry[];
  isArabic: boolean;
  searchPlaceholder: string;
  noResults: string;
  /* "Showing {shown} of {total}" — a plain string, because function props
     cannot cross the server/client boundary (prerender serialization). */
  resultsTemplate: string;
}) {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.map((item, i) => ({ ...item, i }));
    return items
      .map((item, i) => ({ ...item, i }))
      .filter(
        (item) =>
          item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      );
  }, [items, query]);

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="relative mb-6">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 text-slate-400 start-4"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ps-11 pe-4 py-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
        />
      </div>

      {query.trim() && (
        <p className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          {resultsTemplate
            .replace('{shown}', String(filtered.length))
            .replace('{total}', String(items.length))}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{noResults}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const open = item.i === openIndex;
            return (
              <div
                key={`${item.i}-${item.q.slice(0, 24)}`}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 transition-all duration-300',
                  open
                    ? 'border-primary/60 shadow-lg shadow-primary/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-md'
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : item.i)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 p-5 text-start min-h-[44px]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'font-mono text-[11px] font-bold shrink-0',
                      open ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {String(item.i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 font-semibold text-slate-900 dark:text-white text-[15px] sm:text-base">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300',
                      open
                        ? 'bg-primary text-white rotate-45'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </button>
                {/* Grid-rows animation: smooth height without measuring,
                    works in both directions, no JS resize observers. */}
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-out',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 ps-[52px] text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
