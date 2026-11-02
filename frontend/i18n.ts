/* ============================================================
   NOVIQ Frontend — i18n request configuration (next-intl)
   Consumed by the next-intl plugin (see next.config.mjs).
   ============================================================ */
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './app/i18n/config';
// Relative import on purpose — see next.config.mjs: the plugin resolves this
// config module itself, outside the normal `@/` alias resolution.
import { getRuntimeMessages, mergeMessages, type MessagesTree } from './lib/i18n-runtime';

// Re-export locales and defaultLocale for middleware
export { locales, defaultLocale };

/**
 * This config is the dictionary source for `useTranslations` in SERVER
 * components. Client components get their messages from
 * `NextIntlClientProvider`, which app/[locale]/layout.tsx fills from
 * lib/i18n.ts `loadMessages()` — so both paths merge the same runtime
 * dictionary over the same bundled JSON. Keep them in step.
 */

// Export default for next-intl server config
export default getRequestConfig(async ({ requestLocale }) => {
  // During static prerendering, requestLocale may be undefined.
  // Fall back to the default locale in that case.
  const locale = (await requestLocale) ?? defaultLocale;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  // Bundled dictionary: always loaded, always the fallback.
  const bundled = (await import(`./i18n/${locale}.json`)).default as MessagesTree;

  // Admin-editable dictionary (GET /api/content/i18n/:locale), layered on top.
  // getRuntimeMessages never throws — a 404 while the endpoint is still rolling
  // out, a 5xx, or a dead API all resolve to `null`, and the bundled copy is
  // used unchanged.
  const runtime = await getRuntimeMessages(locale);

  return {
    locale,
    messages: mergeMessages(bundled, runtime),
  };
});
