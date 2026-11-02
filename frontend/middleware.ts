import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/app/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|_not-found|.*\\..*).*)'],
};
