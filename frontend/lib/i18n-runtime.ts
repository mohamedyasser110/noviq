/* ============================================================
   NOVIQ — runtime i18n dictionary (optional, fail-soft)
   ------------------------------------------------------------
   The bundled `i18n/en.json` + `i18n/ar.json` remain the dictionary the
   site ships and builds against. This module layers the ADMIN-EDITABLE
   dictionary on top of them:

       GET /api/content/i18n/{locale}  →  { locale, value }

   `value` has the same nested shape as the bundled JSON, so a caller can
   keep using its existing dotted-path lookup and just resolve against this
   object first, then fall back to the JSON.

   HONEST CAVEAT: the `/api/content/i18n/:locale` endpoint is being added on
   the backend in parallel by another agent. It may answer 404 for a while,
   and the API can always be down. So this module is written to fail SOFT:
   every failure path — network error, non-2xx, wrong/missing `value` —
   returns `null` and never throws. Callers MUST treat `null` as "use the
   bundled dictionary"; nothing in the site may depend on this succeeding.
   ============================================================ */

import { api } from '@/lib/api-client';

export type RuntimeMessages = Record<string, unknown>;

/** Shape of GET /api/content/i18n/:locale. Everything optional on purpose:
 *  a partial/renamed payload must degrade to the bundled dictionary, not throw. */
interface I18nPayload {
  locale?: string;
  value?: unknown;
}

/** Runtime dictionary for `locale`, or `null` when it is unavailable.
 *
 *  Public read (the admin token is never attached by this path) and cached
 *  for the same 60s ISR window as the rest of the CMS content, so it costs
 *  at most one request per window per page. */
export async function getRuntimeMessages(locale: string): Promise<RuntimeMessages | null> {
  const loc = locale === 'ar' ? 'ar' : 'en';
  try {
    const data = await api.content.i18nMessages(loc) as I18nPayload | null;
    if (!data || typeof data !== 'object') return null;
    const value = data.value;
    // A dictionary is a nested object. null / [] / "string" are all "not a
    // dictionary" as far as the caller is concerned → fall back to the JSON.
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as RuntimeMessages;
  } catch {
    // 404 while the endpoint is being rolled out, 5xx, ECONNREFUSED, abort…
    // All of them mean the same thing to the site: keep the bundled copy.
    return null;
  }
}

/** Dotted lookup with the SAME semantics every message reader in this project
 *  already uses: a missing segment, an intermediate scalar, or a non-string
 *  leaf all yield `undefined`. Provided so callers that have a runtime object
 *  and a bundled object can share one implementation. */
export function lookupMessages(source: RuntimeMessages | null | undefined, dotted: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  let cursor: unknown = source;
  for (const seg of dotted.split('.')) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as RuntimeMessages)[seg];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

/** A next-intl messages tree: a string, or a nested group of them. */
export type MessagesTree = { [key: string]: string | MessagesTree };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Layer the live dictionary on top of the bundled one.
 *
 * The bundled `i18n/<locale>.json` is ALWAYS the base and is never mutated: it
 * is what the build ships, what the site falls back to when the API is down,
 * and what keeps a build reproducible. The runtime object is strictly
 * additive — a key it does not mention keeps the bundled string, so a partial
 * or half-translated payload can never blank out a section.
 *
 * Only strings and nested objects are taken from the runtime side. A number,
 * boolean, array or null is not a message, so it is ignored and the bundled
 * string survives rather than reaching `t()` as a non-renderable value.
 */
export function mergeMessages(base: MessagesTree, override: Record<string, unknown> | null | undefined): MessagesTree {
  if (!override) return base;
  const out: MessagesTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (isPlainObject(value)) {
      const current = out[key];
      out[key] = mergeMessages(isPlainObject(current) ? (current as MessagesTree) : {}, value);
    }
  }
  return out;
}

export default getRuntimeMessages;
