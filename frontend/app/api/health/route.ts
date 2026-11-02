/* ============================================================
   NOVIQ Frontend — Health API (same-origin proxy)
   ------------------------------------------------------------
   Proxies the Express backend GET /api/health so the browser
   and the Next.js tier never disagree: /api/health on :4321
   returns exactly what the backend on :4322 returns.
   Falls back to a local payload only when the backend is
   unreachable (502 with UPSTREAM_UNAVAILABLE).
   ============================================================ */
import { NextResponse } from 'next/server';

function backendBase(): string {
  return (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4322').replace(/\/+$/, '');
}

export async function GET() {
  try {
    const res = await fetch(`${backendBase()}/api/health`, { cache: 'no-store' });
    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!res.ok) {
      return NextResponse.json(
        payload ?? { error: { code: `HTTP_${res.status}`, message: res.statusText || 'Upstream error' } },
        { status: res.status }
      );
    }
    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    // Backend unreachable — report it honestly, don't fake success.
    console.error('[health-proxy] backend unreachable:', (err as Error).message);
    return NextResponse.json(
      { status: 'degraded', timestamp: new Date().toISOString(), error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend unreachable' } },
      { status: 502 }
    );
  }
}
