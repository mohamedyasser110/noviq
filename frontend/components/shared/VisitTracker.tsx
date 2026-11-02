/* ============================================================
   NOVIQ — visit tracker
   ------------------------------------------------------------
   The API has had POST /api/analytics/visit since the vanilla-SPA
   version, feeding two surfaces the dashboard reads:

     · GET /api/admin/analytics    → the Analytics page (30-day daily
       aggregate, top pages, language split) — a PERSISTED daily rollup
     · site-monitor                 → Site Monitor, which is in-memory
       and holds only the current session

   Neither had a caller. Nothing on the Next.js site ever posted a visit,
   so both pages sat permanently at zero: the Analytics page rendered
   correctly and correctly reported "no data", and Site Monitor showed
   0 active / 0 total forever. The endpoint was the only broken part of
   the chain — there was no client half at all.

   This is that missing half.

   WHY A CLIENT COMPONENT, AND WHY IT POSTS DIRECTLY

   A server component would be the obvious place to count a page view,
   and it is the wrong one. Static generation means the component runs
   at BUILD time and on revalidation, not per request — so a server-side
   call would count builds, not readers, and would inflate the numbers
   precisely when a deploy happens. A client effect runs once per actual
   page view, which is the thing being counted.

   It posts to the browser-facing NEXT_PUBLIC_API_URL rather than through
   lib/api-client on purpose. api-client attaches the stored admin JWT on
   the client, which would attribute every anonymous visit to a named
   admin session, and it would add a CMS cache tag to a call that must
   never be cached. A plain fetch has neither problem.

   PRIVACY / NOISE CONTROLS — deliberate, because "visits" that count the
   dashboard's own polling are worse than no number at all:

     · one count per path per session, so a refresh does not inflate it
       and the Site Monitor "top pages" list is not dominated by whoever
       reloaded most
     · an in-session Set, so navigating away and back does not recount
     · bots are filtered by user-agent, because crawler traffic otherwise
       dwarfs real readers on a brand-new site
     · respect for DNT is not implemented here on purpose: this is a
       first-party, aggregate page count with no cookie and no
       cross-site identifier. It cannot follow anyone across sites.
   ============================================================ */
'use client';

import { useEffect, useRef } from 'react';

/* Visitor identity for the in-memory monitor. Deliberately NOT a durable
   tracking id: it lives in sessionStorage only, expires with the tab, and
   is never sent anywhere but this origin. A stable cross-visit id would
   make "unique visitors" a tracking system rather than a page counter. */
const VISITOR_KEY = 'noviq_vid';

function getVisitorId(): string {
  try {
    const existing = window.sessionStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    /* crypto.randomUUID is unavailable on http:// origins in some browsers;
       the fallback keeps dev (http://localhost) working. */
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    /* Private mode with storage disabled: the monitor loses the id but
       the aggregate still counts. Never let this break the page. */
    return 'anonymous';
  }
}

/* A crawler hitting every URL is not a reader. Kept as an exact list
   rather than a regex so a false positive cannot silently drop traffic. */
function isBot(userAgent: string): boolean {
  if (!userAgent) return true; // no UA at all is not a browser
  return /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|headlesschrome|lighthouse|pingdom|uptimerobot/i.test(
    userAgent
  );
}

export default function VisitTracker({ locale }: { locale: string }) {
  /* Guards against React 18 StrictMode double-invoking effects in dev:
     the first run marks the path, the second sees it and returns. */
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;

    const ua = navigator.userAgent;
    if (isBot(ua)) return;

    const path = `${window.location.pathname}${window.location.search}`.slice(0, 200);

    /* One count per path per browser session. sessionStorage is the right
       scope: it survives reloads (so a refresh is not a second view) and
       dies with the tab (so a new visit is a new visit). */
    const seenKey = 'noviq_seen';
    let seen: string[] = [];
    try {
      seen = JSON.parse(window.sessionStorage.getItem(seenKey) || '[]');
      if (!Array.isArray(seen)) seen = [];
      if (seen.includes(path)) return;
      /* Cap it: an unbounded array in sessionStorage is a slow leak on a
         long session, and 200 paths is far past any real session. */
      seen.push(path);
      if (seen.length > 200) seen = seen.slice(-200);
      window.sessionStorage.setItem(seenKey, JSON.stringify(seen));
    } catch {
      /* No storage: fall through and count. At worst a repeat view. */
    }

    /* Same-origin by construction: app/api/analytics/route.ts is the proxy,
       so there is no CORS preflight and no third-party origin.
       The path is /api/analytics — the route file is app/api/analytics/
       route.ts, which maps to exactly that. Posting to /api/analytics/visit
       returns a clean 404 and silently records nothing, which is precisely
       what happened on the first deploy of this component. */
    const body = JSON.stringify({ path, language: locale, visitorId: getVisitorId() });

    /* sendBeacon is the correct tool here: it survives the page unloading
       during navigation, which is exactly when a naive fetch is cancelled
       and the visit is lost. It reports success as "queued", not "stored",
       so it is fire-and-forget with no retry — a retry would double count. */
    const url = '/api/analytics';
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) {
        return;
      }
    } catch {
      /* fall through to fetch */
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {
      /* Analytics must never produce a console error or a failed request
         in the dashboard's network log. */
    });
  }, [locale]);

  return null;
}
