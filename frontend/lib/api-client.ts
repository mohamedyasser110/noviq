/**
 * ============================================================
 * NOVIQ API Client — single typed boundary to the Express API
 * (backend/). The backend returns the BARE success payload on
 * 2xx (e.g. { status:'ok' }) and the error envelope
 * { error: { code, message, details } } on 4xx/5xx. This client
 * mirrors that exactly — there is no { data, success } wrapper.
 *
 * Usage (call from a Server Action / server component / client
 * component alike):
 *
 *   import { api } from '@/lib/api-client';
 *   const { results } = await api.chat.search('invoice', { lang: 'en' });
 *
 * On a 4xx/5xx the call rejects with ApiError (envelope fields).
 * The base URL is resolved by apiBaseUrl() below — server-only
 * API_INTERNAL_URL first, then NEXT_PUBLIC_API_URL, empty = same-origin.
 * ============================================================
 */

/** ISR window for every `api.content.*` read. Admin edits in the dashboard
 *  are CMS content, not code: caching them for 1 minute means an edit shows
 *  up on the site without a rebuild, while the API still sees at most one
 *  request per window per page (no per-request uncached hammering).
 *
 *  This number MUST stay in step with the `revalidate` export on the CMS
 *  pages and on app/[locale]/layout.tsx (which carries the dictionary for
 *  every client component). They are two halves of one behaviour: the page
 *  segment decides WHEN a route is regenerated, this decides WHEN the API
 *  is re-read inside that regeneration. If they disagree, a page can
 *  regenerate and still serve yesterday's copy. */
const CONTENT_REVALIDATE = 60;

/** Shorthand spread into every `api.content.*` read below. */
const CMS = { revalidate: CONTENT_REVALIDATE } as const;

/* ============================================================
   CACHE TAG — the on-demand revalidation hook
   ------------------------------------------------------------
   The 60s window above is the SAFETY NET, not the happy path. Next
   serves a stale page first and regenerates it in the BACKGROUND, so
   a plain "save, then refresh" can show the old copy once and only
   reveal the edit on a second refresh.

   Every CMS read therefore also carries the `noviq-cms` cache tag.
   The backend pings POST /api/revalidate after each admin save, which
   drops this tag, and the very next visitor gets the new copy — no
   rebuild, and no extra cost per visitor (one tiny POST per SAVE).
   ============================================================ */
export const CMS_CACHE_TAG = 'noviq-cms';

export interface ApiError extends Error {
  name: 'ApiError';
  status: number;
  code: string;
  details?: unknown;
}

/** Every CMS text field is a localized pair (see backend validateTeam). */
export interface LocalizedText { en: string; ar: string }

/** GET /api/content/team — mirrors validateTeam in backend/routes/_shared.js */
export interface TeamPayload {
  hero?: { eyebrow?: LocalizedText; title?: LocalizedText; description?: LocalizedText };
  members?: Array<{
    id?: string;
    name?: LocalizedText;
    role?: LocalizedText;
    bio?: LocalizedText;
    photo?: string;
    email?: string;
    portfolio?: string;
    cv?: string;
    linkedin?: string;
    github?: string;
    facebook?: string;
    status?: 'draft' | 'published';
    featured?: boolean;
  }>;
}

/** GET /api/content/resources — mirrors validateResources in backend/routes/_shared.js */
export interface ResourcesPayload {
  hero?: { eyebrow?: LocalizedText; title?: LocalizedText; description?: LocalizedText };
  tabs?: Array<{ id?: string; label?: LocalizedText; active?: boolean }>;
  items?: Record<string, Array<{
    id?: string;
    title?: LocalizedText;
    excerpt?: LocalizedText;
    content?: LocalizedText;
    cat?: LocalizedText;
    image?: string;
    file?: string;
    link?: string;
    status?: 'draft' | 'published';
    featured?: boolean;
  }>>;
}

function makeError(res: Response, envelope: { error?: { code?: string; message?: string; details?: unknown } } | null): ApiError {
  const body = envelope && envelope.error;
  const err: ApiError = new Error(body && body.message ? body.message : (res.statusText || 'API request failed')) as ApiError;
  err.name = 'ApiError';
  err.status = res.status;
  err.code = (body && body.code) || `HTTP_${res.status}`;
  err.details = body && body.details;
  return err;
}

/** The API origin this process should talk to.
 *
 *  Two variables, two very different lifetimes:
 *    · NEXT_PUBLIC_API_URL is inlined into the browser bundle, so the client
 *      can only ever use it. Empty means "same origin" (production deploy
 *      where the reverse proxy serves frontend + API from one domain).
 *    · API_INTERNAL_URL (documented in .env.example) is a plain, server-only
 *      name — Next.js does NOT inline it, so the browser bundle must never
 *      depend on it. That is why it is read only when there is no `window`
 *      (and only when `process` exists at all): on the server it lets ISR /
 *      server components reach a private backend origin, in the browser the
 *      expression is never evaluated and the resolution stays exactly as
 *      before — NEXT_PUBLIC_API_URL, then ''. */
function apiBaseUrl(): string {
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    const internal = process.env.API_INTERNAL_URL;
    if (internal) return internal;
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

/** Read the stored JWT on the client (noviq_token, fallback admin_token). Server-side → undefined. */
function getStoredToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('noviq_token') || window.localStorage.getItem('admin_token') || undefined;
  } catch {
    return undefined;
  }
}

/** The one fetch wrapper. Returns the parsed success body as T,
 *  or rejects with ApiError on a non-2xx response.
 *
 *  `opts.revalidate` (seconds) is forwarded to Next's extended fetch as
 *  `next: { revalidate }`, which is what turns an admin edit into a visible
 *  site change: the page is still served statically/ISR, it is just allowed
 *  to go back to the API once the window expires. Omitted = Next's default
 *  cache behaviour, so nothing outside the CMS groups changes semantics. */
async function request<T>(
  method: string,
  endpoint: string,
  opts: { body?: unknown; query?: Record<string, unknown>; headers?: HeadersInit; token?: string; revalidate?: number } = {}
): Promise<T> {
  const base = apiBaseUrl();
  let path = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    }
    if (params.toString()) path += `?` + params.toString();
  }

  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers: Record<string, string> = {};
  // Only send JSON content-type for JSON bodies — FormData needs its own multipart boundary.
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (opts.headers) Object.assign(headers, opts.headers);

  // Attach Bearer token: explicit opt wins, otherwise the stored client token.
  const token = opts.token ?? getStoredToken();
  if (token && !headers['Authorization'] && !(opts.headers && 'Authorization' in (opts.headers as object))) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit & { next?: { revalidate: number; tags?: string[] } } = {
    method,
    headers,
    // FormData is forwarded untouched; otherwise JSON-encode.
    body: isFormData ? (opts.body as FormData) : (opts.body ? JSON.stringify(opts.body) : undefined),
    // Server-side: no credentials needed (Express CORS is server-facing).
    // Client-side: keep cookies off — tokens ride as Bearer headers only.
    credentials: 'omit',
  };
  // ISR: only set when a revalidate window was asked for, so every other
  // call keeps Next's default caching exactly as it is today.
  // The tag is what makes an admin save take effect immediately — see
  // CMS_CACHE_TAG above.
  if (typeof opts.revalidate === 'number' && Number.isFinite(opts.revalidate)) {
    init.next = { revalidate: opts.revalidate, tags: [CMS_CACHE_TAG] };
  }

  const res = await fetch(path, init);

  let envelope: { error?: { code?: string; message?: string; details?: unknown } } | null = null;
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    envelope = (await res.json().catch(() => null)) as typeof envelope;
  }

  if (!res.ok) throw makeError(res, envelope);
  // 2xx: a 204/empty body yields null — that is the real payload shape.
  return (envelope ?? null) as T;
}

function get<T>(endpoint: string, opts: { query?: Record<string, unknown>; headers?: HeadersInit; token?: string; revalidate?: number } = {}) {
  return request<T>('GET', endpoint, opts);
}
function post<T>(endpoint: string, body: unknown, opts: { headers?: HeadersInit; token?: string } = {}) {
  return request<T>('POST', endpoint, { ...opts, body });
}
function put<T>(endpoint: string, body: unknown, opts: { headers?: HeadersInit; token?: string } = {}) {
  return request<T>('PUT', endpoint, { ...opts, body });
}
function patch<T>(endpoint: string, body: unknown, opts: { headers?: HeadersInit; token?: string } = {}) {
  return request<T>('PATCH', endpoint, { ...opts, body });
}
function del<T>(endpoint: string, opts: { query?: Record<string, unknown>; headers?: HeadersInit; token?: string } = {}) {
  return request<T>('DELETE', endpoint, opts);
}

/* ---- typed resource groups (mirrors the contract paths) ---- */
export const api = {
  health: {
    check: () => get<{ status: string; timestamp: string }>('/api/health'),
  },

  /* Every method in this group is CMS content the admin edits at runtime, so
     every one of them is cached for CONTENT_REVALIDATE seconds. That is what
     makes an admin edit appear on the site without a rebuild, and it also caps
     the API at one read per window instead of one per request. */
  content: {
    /* Full site content object, built from SQLite by the backend's
       content-store. Served as raw JSON (NOT JSON-in-JS). */
    get: () => get<Record<string, unknown>>('/api/content', CMS),
    /* Aggregated homepage bundle (one round-trip for the landing page). */
    home: () => get<Record<string, unknown>>('/api/content/home', CMS),
    typewriter: () => get<{ en?: string[]; ar?: string[] }>('/api/content/typewriter', CMS),
    /* Translation dictionary for one locale: { locale, value }. A PUBLIC read
       (no admin token, so it is safe to expose) used by lib/i18n-runtime.ts to
       let admins edit wording without a rebuild. Fails soft when absent. */
    i18nMessages: (locale: string) =>
      get<{ locale?: string; value?: Record<string, unknown> }>(`/api/content/i18n/${locale}`, CMS),
    /* Section endpoints (public, no auth) — see backend/routes/public.js.
       These are what the CMS-driven pages read (e.g. /team). */
    team: () => get<TeamPayload>('/api/content/team', CMS),
    /** Knowledge Hub — tabs + per-tab items, admin-editable. */
    resources: () => get<ResourcesPayload>('/api/content/resources', CMS),
    hero: () => get<Record<string, unknown>>('/api/content/hero', CMS),
    pricing: () => get<Record<string, unknown>>('/api/content/pricing', CMS),
    faq: () => get<Record<string, unknown>>('/api/content/faq', CMS),
    careers: () => get<Record<string, unknown>>('/api/content/careers', CMS),
    about: () => get<Record<string, unknown>>('/api/content/about', CMS),
    pages: () => get<Record<string, { enabled: boolean; labelEn?: string; labelAr?: string; note?: string }>>('/api/content/pages', CMS),
    contactInfo: () => get<Record<string, unknown>>('/api/content/contact', CMS),
    footerInfo: () => get<Record<string, unknown>>('/api/content/footer', CMS),
    solutionsList: () => get<unknown[]>('/api/content/solutions', CMS),
    services: () => get<unknown[]>('/api/content/services', CMS),
    industries: () => get<unknown[]>('/api/content/industries', CMS),
    projects: () => get<unknown[]>('/api/content/projects', CMS),
    testimonials: () => get<unknown[]>('/api/content/testimonials', CMS),
    stats: () => get<unknown[]>('/api/content/stats', CMS),
    brand: () => get<Record<string, unknown>>('/api/content/brand', CMS),
  },

  contact: {
    /* `phone` is optional and passed through untouched — the backend
       sanitises it. Omitting it from this type is what made the field
       silently unusable: the form still had to send it, so the signature
       has to admit it. */
    submit: (data: { name: string; email: string; phone?: string; company?: string; message: string }) =>
      post<{ id: number | string; message: string }>('/api/contact', data),
    list: (q?: { limit?: number; offset?: number }) =>
      get<unknown[]>('/api/contact', { query: q }),
  },

  newsletter: {
    subscribe: (email: string) =>
      post<{ message: string; subscribed: boolean; id?: number | string }>('/api/newsletter/subscribe', { email }),
    unsubscribe: (email: string) =>
      post<{ message: string; subscribed: boolean }>('/api/newsletter/unsubscribe', { email }),
  },

  /* The `chat` group (chatbot) was removed on 2026-09-27: the feature is gone
     from the site and its API routes were deleted with it. Nothing in the
     frontend called these — the group was dead weight. */

  auth: {
    login: (data: { email: string; password: string }) =>
      post<{ token: string; user: Record<string, unknown> }>('/api/auth/login', data),
    register: (data: { firstName: string; lastName?: string; email: string; password: string }) =>
      post<{ token: string; user: Record<string, unknown> }>('/api/auth/register', data),
    forgotPassword: (email: string) =>
      post<{ message: string }>('/api/auth/forgot-password', { email }),
    resetPassword: (data: { token: string; password: string }) =>
      post<{ message: string }>('/api/auth/reset-password', data),
  },

  /* Signed-in client dashboard (backend/routes/portal.js). The Bearer token
     is attached automatically from localStorage by request() — see
     getStoredToken. 401 = session dead (the AuthProvider clears it). */
  portal: {
    /* Session validation + dashboard headline numbers. */
    me: () =>
      get<{
        user: Record<string, unknown>;
        unread: number;
        counts: { projects: number; contracts: number };
      }>('/api/portal/me'),
    projects: () =>
      get<{
        projects: Array<{
          id: number | string;
          name: string;
          summary?: string;
          status: string;
          progress: number;
          startDate?: string;
          targetDate?: string;
          milestones: Array<{
            id: number | string;
            title: string;
            description?: string;
            progress: number;
            status: string;
            dueDate?: string;
          }>;
        }>;
      }>('/api/portal/projects'),
    /* One project with its milestone steps plus its contracts — the detail
       view the admin "Client Projects" page mirrors. */
    project: (id: number | string) =>
      get<{
        project: {
          id: number | string;
          name: string;
          summary?: string;
          status: string;
          progress: number;
          startDate?: string;
          targetDate?: string;
          milestones: Array<{
            id: number | string;
            title: string;
            description?: string;
            progress: number;
            status: string;
            dueDate?: string;
          }>;
        };
        contracts: Array<{
          id: number | string;
          title: string;
          reference?: string;
          value?: string;
          currency?: string;
          status: string;
          signedAt?: string;
          startsOn?: string;
          endsOn?: string;
          notes?: string;
          file?: string;
        }>;
      }>(`/api/portal/projects/${id}`),
    /* Structured contract documents (milestones, amounts, dates). */
    contracts: () =>
      get<{
        contracts: Array<{
          id: number | string;
          projectId?: number | string | null;
          projectName?: string;
          title: string;
          reference?: string;
          value?: string;
          currency?: string;
          status: string;
          signedAt?: string;
          startsOn?: string;
          endsOn?: string;
          notes?: string;
          file?: string;
        }>;
      }>('/api/portal/contracts'),
    /* Update feed: admin-written project/contract/message notes. */
    notifications: () =>
      get<{
        notifications: Array<{
          id: number | string;
          type: string;
          title: string;
          body?: string;
          link?: string;
          createdAt?: string;
          read: boolean;
          scope: string;
        }>;
        unread: number;
      }>('/api/portal/notifications'),
    markNotificationRead: (id: number | string) =>
      post<{ ok: boolean }>(`/api/portal/notifications/${id}/read`, {}),
    /* One call clears the whole feed badge (dashboard "Mark all read"). */
    markAllNotificationsRead: () =>
      post<{ ok: boolean; marked: number }>('/api/portal/notifications/read-all', {}),
    /* Message the team from inside the dashboard. Lands in the shared
       contacts inbox the admin reads — the other half of the loop the
       admin "Message this client" composer starts. */
    sendMessage: (message: string) =>
      post<{ ok: boolean; id: number | string; emailed: boolean }>('/api/portal/contact', { message }),
    /* Two-way conversation (backend client_messages): the thread the team
       reads and answers inside admin Client Projects. Opening marks the
       team's rows read, which clears the unread badge. */
    messages: () =>
      get<{
        messages: Array<{
          id: number | string;
          sender: string;
          body: string;
          read: boolean;
          createdAt?: string;
        }>;
      }>('/api/portal/messages'),
    sendChatMessage: (message: string) =>
      post<{ ok: boolean; id: number | string }>('/api/portal/messages', { message }),
    /* Own contact data. Email is the identity and never changes here. */
    profile: () =>
      get<{
        user: {
          id: number | string;
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          avatar?: string;
        };
      }>('/api/portal/profile'),
    updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) =>
      put<{
        user: {
          id: number | string;
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          avatar?: string;
        };
      }>('/api/portal/profile', data),
    /* Profile photo (PNG/JPG/WebP/GIF, 2MB). The returned uploads-relative
       path renders at /<path> and surfaces in the admin workspace. */
    uploadAvatar: (dataUrl: string, filename: string) =>
      post<{ ok: boolean; avatar: string }>('/api/portal/profile/avatar', { data: dataUrl, filename }),
    deleteAvatar: () => del<{ ok: boolean; avatar: string }>('/api/portal/profile/avatar'),
    /* Project activation requests with preset data (category/budget/
       timeline). The admin triages in Client Projects; status + admin
       notes read back here. */
    requests: () =>
      get<{
        requests: Array<{
          id: number | string;
          title: string;
          category: string;
          budget?: string;
          timeline?: string;
          description?: string;
          status: string;
          adminNote?: string;
          createdAt?: string;
        }>;
      }>('/api/portal/requests'),
    createRequest: (data: { title: string; category?: string; budget?: string; timeline?: string; description?: string }) =>
      post<{ ok: boolean; id: number | string }>('/api/portal/requests', data),
  },
};

export { get, post, put, patch, del };
export default api;
