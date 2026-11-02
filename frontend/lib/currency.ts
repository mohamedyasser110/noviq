/* ============================================================
   NOVIQ — display currency for marketing prices
   ------------------------------------------------------------
   Pricing page plans and ready-made solutions are authored in USD.
   Visitors pick USD / EUR / EGP once; the choice persists in
   localStorage (`noviq_currency`) and every <Price> on the page
   re-renders via the `noviq:currency` event — no reload, no request.

   Rates are display-only snapshots (not a checkout): contracts keep
   their contractual currency untouched. One file owns rates, symbols
   and formatting so the two priced surfaces can never drift apart.
   ============================================================ */

'use client';

export interface Currency {
  code: 'USD' | 'EUR' | 'EGP';
  /** Symbol/prefix shown before the converted figure. */
  symbol: string;
  /** Multiplied straight onto the USD figure. */
  rate: number;
  /** BCP-47 tag used for digit grouping. */
  locale: string;
  /** Fraction digits: pounds read better rounded. */
  maximumFractionDigits: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', rate: 1, locale: 'en-US', maximumFractionDigits: 0 },
  { code: 'EUR', symbol: '€', rate: 0.92, locale: 'de-DE', maximumFractionDigits: 0 },
  { code: 'EGP', symbol: 'EGP ', rate: 48.5, locale: 'en-US', maximumFractionDigits: 0 },
];

export const CURRENCY_KEY = 'noviq_currency';
export const CURRENCY_EVENT = 'noviq:currency';

export function normalizeCurrency(raw: unknown): Currency {
  const code = typeof raw === 'string' ? raw.toUpperCase() : '';
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function getStoredCurrency(): Currency {
  if (typeof window === 'undefined') return CURRENCIES[0];
  try {
    return normalizeCurrency(window.localStorage.getItem(CURRENCY_KEY));
  } catch {
    return CURRENCIES[0];
  }
}

export function setStoredCurrency(code: Currency['code']): void {
  try {
    window.localStorage.setItem(CURRENCY_KEY, code);
  } catch {
    /* private mode — the page simply keeps USD for this visit */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CURRENCY_EVENT));
  }
}

/** 4800 * 48.5 = 232800 → "232,800". Rounds to whole units everywhere:
    cents on marketing prices are noise, not precision. */
export function convertUsd(usd: number, currency: Currency): string {
  const n = Math.round(usd * currency.rate);
  const grouped = new Intl.NumberFormat(currency.locale, {
    maximumFractionDigits: currency.maximumFractionDigits,
  }).format(n);
  return `${currency.symbol}${grouped}`;
}

/** Pull the leading dollar figure out of a CMS string ("$150",
    "$249/year", "USD 4800.00"). Returns null when there is no USD
    figure to convert — the caller then renders the raw string. */
export function parseUsd(raw: string): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
