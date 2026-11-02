/* ============================================================
   NOVIQ Frontend — Localized 404 (/{locale}/* unknown routes)
   NOTE: not-found boundaries receive NO props in App Router
   (no params), so locale is detected from the pathname instead.
   ============================================================ */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function LocaleNotFound() {
  const pathname = usePathname();
  const isArabic = pathname?.startsWith('/ar') ?? false;
  const locale = isArabic ? 'ar' : 'en';

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="text-9xl font-bold text-primary/20">404</div>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          {isArabic ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {isArabic
            ? 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.'
            : "The page you're looking for doesn't exist or has been moved."}
        </p>
        <Link
          href={`/${locale}`}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors"
        >
          {isArabic ? 'العودة للرئيسية' : 'Go Home'}
        </Link>
      </div>
    </div>
  );
}
