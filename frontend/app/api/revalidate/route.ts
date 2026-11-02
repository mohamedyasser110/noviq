/* ============================================================
   NOVIQ — on-demand revalidation endpoint
   ------------------------------------------------------------
   WHY THIS EXISTS
   The CMS pages are statically generated with a 60s ISR window as
   a safety net, but Next serves a stale page FIRST and regenerates
   it in the background. An admin who saves copy and hits refresh
   would therefore still see the old text once — the edit only
   appeared on a second refresh.

   So the backend pings this route after every successful content
   save. The `noviq-cms` cache tag is dropped, the next visitor gets
   the new copy on their FIRST request, and the 60s window stays in
   place as a fallback for edits made outside the dashboard.

   COST: one small POST per admin SAVE (never per visitor). The route
   answers 204/200 and does no rendering of its own.

   AUTH: shared secret only. It must never be callable from a
   browser, so it is read from REVALIDATE_SECRET (server-only, never
   a NEXT_PUBLIC_ var) and compared in constant time. If the secret
   is not configured the route refuses every call rather than
   defaulting to something guessable.

   Call it from the backend with:
     POST {FRONTEND_URL}/api/revalidate
     headers: { 'x-revalidate-secret': REVALIDATE_SECRET }
     body:    { "reason": "content:hero" }   // optional, logged only
   ============================================================ */

import { revalidateTag, revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { CMS_CACHE_TAG } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

/** Locales whose routes exist, so a purge covers every page. */
const LOCALES = ['en', 'ar'];

/** Every CMS-backed page, so the purge does not depend on the root-layout
 *  call alone. Must stay in step with app/[locale]/* — a new CMS page that
 *  is missing here is still covered by revalidatePath('/', 'layout'), so
 *  this list is redundancy, not the primary mechanism. */
const CMS_PATHS = [
  '', 'about', 'services', 'industries', 'solutions', 'portfolio',
  'pricing', 'team', 'resources', 'resource', 'faq', 'careers',
  'contact', 'why', 'toolkit', 'clients',
];

/** Constant-time string compare — a plain `===` leaks length/prefix by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    /* Fail CLOSED. An unconfigured secret must not become "no auth". */
    console.error('[revalidate] REVALIDATE_SECRET is not set — refusing the request.');
    return NextResponse.json(
      { error: { code: 'NOT_CONFIGURED', message: 'REVALIDATE_SECRET is not configured.' } },
      { status: 503 }
    );
  }

  const provided = request.headers.get('x-revalidate-secret') ?? '';
  if (!safeEqual(provided, secret)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Invalid revalidation secret.' } },
      { status: 401 }
    );
  }

  /* Body is optional and only used for the log line, so a malformed one
     must not fail the purge. */
  let reason = 'unspecified';
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body?.reason === 'string' && body.reason) reason = body.reason.slice(0, 120);
  } catch {
    /* no/invalid JSON — the purge below is what matters */
  }

  /* 1. Drop the CMS data tag: every page that read api.content.* is
        invalidated, in both locales, at once. */
  revalidateTag(CMS_CACHE_TAG);

  /* 2. Drop the rendered routes, so a static page is rebuilt on the
        next request instead of waiting out its own 60s window.

        revalidatePath('/en', 'layout') alone was NOT enough in
        production. '/en' is the RESOLVED form of the dynamic segment
        `[locale]`, and purging a dynamic segment by its resolved path is
        the weak spot: the purge logged as executed, the route re-rendered
        (x-nextjs-cache went MISS) and the page STILL served the old text
        for 100s+, because the tagged fetch inside it kept returning its
        cached entry.

        '/' with type 'layout' targets the ROOT layout, which every route
        is nested beneath, so it is the one call that cannot miss a
        dynamic segment. The concrete paths after it are belt and braces:
        if the root-layout call is ever dropped, the CMS pages below are
        still purged. 'services' is listed rather than '/services/[slug]'
        because one entry revalidates the whole subtree. */
  revalidatePath('/', 'layout');
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}`, 'layout');
    revalidatePath(`/${locale}`);
    for (const slug of CMS_PATHS) {
      revalidatePath(`/${locale}/${slug}`);
    }
  }

  console.log(`[revalidate] cache purged (${reason})`);
  return NextResponse.json({ revalidated: true, tag: CMS_CACHE_TAG, at: new Date().toISOString() });
}

/** GET is a cheap health probe so an operator can confirm the wiring
 *  (it purges nothing and never reveals the secret). */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/revalidate',
    method: 'POST',
    configured: Boolean(process.env.REVALIDATE_SECRET),
  });
}
