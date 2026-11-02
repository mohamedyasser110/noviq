/* ============================================================
   NOVIQ — analytics: record a page view
   ------------------------------------------------------------
   Same-origin passthrough to the Express backend.

   WHY THIS EXISTS
   POST /api/analytics/visit is the write half of the dashboard's
   Analytics and Site Monitor pages. VisitTracker posts to a RELATIVE
   path so the call is same-origin, and in production the site and the
   API are two different Railway services — so without this route every
   visit POST would 404 and both pages would sit at zero forever.

   THE PATH IS /api/analytics
   This file is app/api/analytics/route.ts, so Next.js serves it at
   /api/analytics. It forwards to /api/analytics/visit on the backend,
   which is a DIFFERENT path — the two are not the same endpoint and
   conflating them is easy because both contain the word "analytics".
   VisitTracker posts to /api/analytics; the earlier version posted to
   /api/analytics/visit, which 404s cleanly and records nothing.

   (That is not hypothetical: this file did not exist, the tracker had no
   route to reach, and the dashboard correctly rendered empty analytics.)

   Same shape as app/api/contact/route.ts and app/api/health/route.ts: the
   backend stays the single source of truth, this forwards and relays.

   Contract (mirrors backend/routes/analytics.js):
     200 { ok: true }
     400 { error: { code, message } }
     502 { error: { code: 'UPSTREAM_UNAVAILABLE', message } }

   fail-soft: an analytics outage must never produce a console error in a
   visitor's browser, so every failure answers 204 with no body. The
   dashboard reading zero is better than a red error on the site.
   ============================================================ */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_PATH = 200;
const MAX_LANG = 5;
const MAX_VISITOR = 64;

/** Same resolution as the other proxy routes: private network first, then
 *  the public API origin, so the internal hostname never reaches the client. */
function backendBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4322'
  ).replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  let body: { path?: unknown; language?: unknown; visitorId?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* A malformed body is not worth an error on the page. */
    return new NextResponse(null, { status: 204 });
  }

  const path = typeof body.path === 'string' ? body.path.slice(0, MAX_PATH) : '/';
  const language = typeof body.language === 'string' ? body.language.slice(0, MAX_LANG) : 'en';
  const visitorId = typeof body.visitorId === 'string' ? body.visitorId.slice(0, MAX_VISITOR) : '';

  try {
    const res = await fetch(`${backendBase()}/api/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, language, visitorId }),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[analytics-proxy] upstream ${res.status}`);
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[analytics-proxy] backend unreachable:', (err as Error).message);
    return new NextResponse(null, { status: 204 });
  }
}
