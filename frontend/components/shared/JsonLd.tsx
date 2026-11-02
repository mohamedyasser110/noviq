/* ============================================================
   NOVIQ — JSON-LD Structured Data (SEO)
   Organization + WebSite graph, rendered once per locale layout.
   ============================================================ */

const SITE_URL = 'https://noviqsolutions.com';

export default function JsonLd({ locale }: { locale: 'en' | 'ar' }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Noviq Solutions',
        alternateName: ['Noviq', 'نوفيك'],
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/images/project-ai.png`,
          width: 1200,
          height: 630,
          caption: 'Noviq Solutions logo',
        },
        description:
          'Global software and AI engineering company building custom AI solutions, ERP and CRM systems, SaaS platforms, cloud infrastructure, and web and mobile applications.',
        slogan: 'Engineering the Future Through Technology',
        foundingDate: '2014',
        email: 'hello@noviqsolutions.com',
        telephone: '+1-415-555-0182',
        address: [
          { '@type': 'PostalAddress', addressLocality: 'San Francisco', addressRegion: 'CA', addressCountry: 'US' },
          { '@type': 'PostalAddress', addressLocality: 'London', addressCountry: 'GB' },
          { '@type': 'PostalAddress', addressLocality: 'Singapore', addressCountry: 'SG' },
        ],
        sameAs: ['https://linkedin.com/company/noviq', 'https://x.com/noviq', 'https://github.com/noviq'],
        knowsAbout: [
          'Artificial Intelligence',
          'Machine Learning',
          'ERP Systems',
          'CRM Platforms',
          'Cloud Computing',
          'SaaS Development',
          'Web Development',
          'Mobile App Development',
          'API Development',
          'Digital Transformation',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Noviq Solutions',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: [locale, locale === 'en' ? 'ar' : 'en'],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
