/* ============================================================
   NOVIQ Frontend — Contact API (same-origin proxy)
   ============================================================
   The browser form (components/sections/Contact.tsx) normally
   calls the Express backend DIRECTLY via lib/api-client.ts
   (NEXT_PUBLIC_API_URL -> http://127.0.0.1:4322), which works
   because the backend allowlists the frontend origin in CORS
   (backend/config/index.js -> CORS_ORIGINS).

   This route is the same-origin path to the exact same backend
   endpoint. It exists so the flow keeps working when the browser
   cannot use a cross-origin request — e.g. a preview deployment
   on a port/origin outside CORS_ORIGINS, or a same-origin
   reverse proxy in production.

   Contract (mirrors backend/routes/public.js -> POST /contact):
     400 { error: { code:'VALIDATION_ERROR', message } }
     201 { id, message }
     500 { error: { code:'INTERNAL_ERROR', message } }

   The backend stays the single source of truth: it owns the
   SQLite INSERT into `contacts` and the notifyNewLead() email.
   This route only forwards and relays the envelope + status.
   ============================================================ */
import { NextRequest, NextResponse } from 'next/server';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 5000;
const MAX_PHONE = 40;

/* Mirrors cleanPhone() in backend/routes/public.js. Sanitising only — the
   proxy must not be more permissive than the endpoint it fronts, but it
   must not be stricter either: phone is optional, so turning a typo into a
   400 would silently discard a real lead. The proxy rejects exactly what
   the backend rejects: a missing name, email or message, a malformed
   email, and an over-long message. */
function cleanPhone(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^\d+()\-. ]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_PHONE);
}

function backendBase(): string {
  // Server-side only: no NEXT_PUBLIC_ prefix needed, and this value is
  // never shipped to the browser bundle.
  return (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4322').replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; company?: string; message?: string; phone?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    );
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim();
  const company = (body.company ?? '').trim();
  const message = (body.message ?? '').trim();
  const phone = cleanPhone(body.phone);

  // Validate locally first so an obviously-bad payload never costs a
  // round trip and never reaches the rate limiter.
  if (!name || !email || !message) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Name, email, and message are required.' } },
      { status: 400 }
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid email address.' } },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `Message too long (max ${MAX_MESSAGE} characters).` } },
      { status: 400 }
    );
  }
  /* `phone` is deliberately NOT validated into a rejection — see the note
     on cleanPhone(). A malformed optional field must not cost the visitor
     their message. */

  try {
    const res = await fetch(`${backendBase()}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Server-to-server: no browser cookies involved, so this stays a
      // plain request and the backend assigns no session state.
      body: JSON.stringify({ name, email, phone, company, message }),
      cache: 'no-store',
    });

    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      // Relay the backend's own envelope verbatim so the client sees the
      // same code/message it would get from a direct call.
      return NextResponse.json(
        payload ?? { error: { code: `HTTP_${res.status}`, message: res.statusText || 'Upstream error' } },
        { status: res.status }
      );
    }

    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    // Backend unreachable — surface it as such rather than a fake success.
    console.error('[contact-proxy] backend unreachable:', (err as Error).message);
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Failed to send message. Please try again.' } },
      { status: 502 }
    );
  }
}
