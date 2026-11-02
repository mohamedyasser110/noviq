import { fileURLToPath } from 'url';
import { dirname } from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The request config (getRequestConfig) lives at ./i18n.ts — the canonical
// v3 location, and the same file v3 auto-discovers.
//
// The plugin is NOT optional and NOT Pages-Router-only. It works by aliasing
// `next-intl/config` to the request config module:
//     resolve.alias['next-intl/config'] = path.resolve(context, configPath)
// Without it, that specifier keeps resolving to the stub at
// next-intl/dist/*/config.js, whose default export throws
// "Couldn't find next-intl config file" — so any server component that needs
// the request config fails while prerendering:
//     Export encountered an error on /[locale]/services/[slug]/page
//
// Note v3 auto-discovery only looks at ./i18n/request.* and ./i18n.* (plus
// ./src/... variants) at the project ROOT — never at ./app/i18n/request.ts.
// Keep exactly ONE getRequestConfig in the project, at ./i18n.ts, using only
// relative imports so the plugin resolves it without the `@/` alias.
const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  /* IMPORTANT: `next dev` and `next build` must NOT run at the same time.

     They share this distDir, and a dev server continuously rewrites it. A dev
     server does not emit a production BUILD_ID, so a build that finishes while
     `next dev` is running gets its BUILD_ID (and various manifests) wiped
     afterwards. Symptoms seen here: `next start` reporting
     "Could not find a production build in the '.next' directory" right after a
     successful build, and intermittent ENOENT on pages-manifest.json /
     build-manifest.json / *.nft.json during the build itself.

     Stop the dev server before building or starting a production build.
     If you need both at once, give one of them its own directory:
       set NEXT_DIST_DIR=.next-dev && npm run dev

     Note the error text above always says "'.next'" regardless of the
     configured distDir, so it is not a reliable indicator of which folder
     was searched. */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /* Standalone output (.next/standalone/server.js) lets production run from
     a copied folder immune to .next cache wipes during parallel work.
     Disabled: it previously got the blame for the ENOENT above, but that
     attribution was wrong — the error occurs with standalone output off. */
  // output: 'standalone',
  reactStrictMode: true,
  /* Hide the Next.js dev-tools badge (the circular "N" pinned bottom-left).
     It is injected by the dev overlay, not by the app, so it cannot be
     removed from the markup — the config key is the only switch. Dev-only
     by nature: it has no effect on `next build` / `next start`. */
  devIndicators: false,
  // i18n is now handled by middleware and next-intl
  async redirects() {
    return [
      // Legacy hash route redirects
      {
        source: '/stack',
        destination: '/toolkit',
        permanent: true,
      },
      // Legacy bare path redirects to localized versions
      {
        source: '/services',
        destination: '/en/services',
        permanent: false,
      },
      {
        source: '/about',
        destination: '/en/about',
        permanent: false,
      },
      {
        source: '/contact',
        destination: '/en/contact',
        permanent: false,
      },
      // Root redirect to default locale
      {
        source: '/',
        destination: '/en',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.pixabay.com',
      },
    ],
  },
  /* ---- Uploaded media proxy --------------------------------------------
     The CMS stores every uploaded file as a RELATIVE path
     (`images/uploads/<file>` — see backend/routes/admin.js) and the
     backend serves exactly that shape on the API origin. Local dev keeps
     one filesystem (backend/.env points UPLOADS_DIR at
     frontend/public/images/uploads), so the browser resolves the relative
     path against the site itself and never touches the API.

     On Railway the two tiers are separate containers with separate
     filesystems, so a site-relative `/images/uploads/x.png` would 404.
     This rewrite forwards those requests to the API.

     It must point at the PUBLIC API origin, NOT API_INTERNAL_URL:
     Next.js evaluates `rewrites()` during `next build` and writes the
     result into .next/routes-manifest.json, so a runtime-only variable
     is never seen here. Gating on API_INTERNAL_URL therefore produced a
     build with NO rewrite at all, and every uploaded image 404'd on the
     live site while the sibling /api/health proxy (a route handler, which
     does read env per request) kept working and hid the mistake.

     These are `afterFiles` rewrites, so the shipped public/images/*
     (testimonial SVGs, project art) still win and are served locally;
     only the misses — i.e. newly uploaded files — are proxied. */
  async rewrites() {
    const api = (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_INTERNAL_URL ||
      'http://127.0.0.1:4322'
    ).replace(/\/+$/, '');
    return [
      { source: '/images/:path*', destination: `${api}/images/:path*` },
    ];
  },
  // Type errors now fail the build: `npx tsc --noEmit` is clean, so
  // ignoreBuildErrors was only hiding real problems. Re-enable it if the
  // generated route types (.next/types) are stale from a killed build —
  // re-run the build once with it off before committing that.
  eslint: {
    // Kept for now: lint is not currently part of the project's gate and
    // turning it on can fail an otherwise healthy production build.
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);