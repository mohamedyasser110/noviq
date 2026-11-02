/* Currency switcher + converted price display (client-only).
   <CurrencySwitcher> persists the choice and notifies every <Price>
   through the `noviq:currency` event. <Price> takes the CMS string as-is
   ("$150", "$249/year") and converts its dollar figure; anything without
   a figure renders untouched. */
'use client';

import { useEffect, useState } from 'react';
import {
  CURRENCIES,
  CURRENCY_EVENT,
  convertUsd,
  getStoredCurrency,
  parseUsd,
  setStoredCurrency,
  type Currency,
} from '@/lib/currency';
import { cn } from '@/lib/utils';

export function CurrencySwitcher({ className }: { className?: string }) {
  const [code, setCode] = useState<Currency['code']>('USD');

  useEffect(() => {
    setCode(getStoredCurrency().code);
    const onChange = () => setCode(getStoredCurrency().code);
    window.addEventListener(CURRENCY_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CURRENCY_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return (
    <div
      role="group"
      aria-label="Display currency"
      className={cn(
        'inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1',
        className
      )}
    >
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => {
            setCode(c.code);
            setStoredCurrency(c.code);
          }}
          aria-pressed={code === c.code}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors min-h-[36px]',
            code === c.code
              ? 'bg-primary text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {c.code}
        </button>
      ))}
    </div>
  );
}

export function Price({
  value,
  className,
}: {
  /** CMS price string, e.g. "$150" or "$249/year". */
  value: string;
  className?: string;
}) {
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);

  useEffect(() => {
    setCurrency(getStoredCurrency());
    const onChange = () => setCurrency(getStoredCurrency());
    window.addEventListener(CURRENCY_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CURRENCY_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const usd = parseUsd(value);
  /* First paint (and any unparseable string) shows the authored figure:
     no hydration mismatch, no blank prices. */
  if (usd === null || currency.code === 'USD') {
    return <span className={className}>{value}</span>;
  }
  return <span className={className}>{convertUsd(usd, currency)}</span>;
}
