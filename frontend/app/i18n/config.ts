/* ============================================================
   NOVIQ Frontend — i18n configuration (shared)
   Using next-intl v3 App Router pattern
   ============================================================ */
import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale = 'en' as const;

// Define routing for next-intl
export const routing = defineRouting({
  locales: locales,
  defaultLocale: defaultLocale,
  localePrefix: 'always',
});
