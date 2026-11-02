/* ============================================================
   NOVIQ — Robots (App Router)
   ============================================================ */
import type { MetadataRoute } from 'next';

const SITE_URL = 'https://noviqsolutions.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/account/', '/login/', '/signup/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
