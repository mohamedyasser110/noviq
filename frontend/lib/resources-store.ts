/* ============================================================
   NOVIQ — Knowledge Hub personal state (pins + read receipts)
   ------------------------------------------------------------
   Two per-visitor lists, both in localStorage, both device-local:

     noviq_resources_pinned  — item ids the visitor pinned (tثبيت).
     noviq_resources_seen    — item ids the visitor has opened.

   WHY localStorage AND NOT THE BACKEND
   Pins and "have I read this" are personal reading-list state, not CMS
   content: they differ per visitor, the admin never edits them, and they
   must work for logged-out visitors too. A server table would add a
   migration, new endpoints, and an account requirement for what is
   fundamentally a bookmark. The header unread badge and the pinned strip
   both read from here.

   SSR contract: every function guards `typeof window` and returns the
   empty state on the server, so the first client render matches the
   prerendered HTML exactly — no hydration mismatch. Components subscribe
   via the `noviq:resources` window event (fired here on every mutation)
   plus the native `storage` event for cross-tab sync.

   "Unread" means "published but never opened". An item the admin adds
   tomorrow has an id that is in no one's seen-set, so it is automatically
   unread for everyone — no timestamps, no publish-date parsing (the CMS
   `date` field is free text and cannot be trusted for ordering).
   ============================================================ */

const PINNED_KEY = 'noviq_resources_pinned';
const SEEN_KEY = 'noviq_resources_seen';

/** Broadcast channel name for same-tab updates (storage events don't fire
 *  in the tab that wrote). */
export const RESOURCES_EVENT = 'noviq:resources';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readIds(key: string): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Cap the list: a decade of browsing must not grow storage forever.
       Seen ids beyond the cap are simply forgotten (they become unread
       again), which is the safe direction to fail. */
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, 500);
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 500)));
    window.dispatchEvent(new Event(RESOURCES_EVENT));
  } catch {
    /* private mode / quota — pins simply don't persist */
  }
}

/* ---------------- pins ---------------- */

export function getPinnedIds(): string[] {
  return readIds(PINNED_KEY);
}

export function isPinned(id: string): boolean {
  return getPinnedIds().includes(id);
}

/** Toggle one id. Returns the new list so callers can setState directly. */
export function togglePin(id: string): string[] {
  const current = getPinnedIds();
  const next = current.includes(id)
    ? current.filter((v) => v !== id)
    : [...current, id];
  writeIds(PINNED_KEY, next);
  return next;
}

/* ---------------- read receipts ---------------- */

export function getSeenIds(): string[] {
  return readIds(SEEN_KEY);
}

/** Mark one item read. Idempotent — re-opening changes nothing. */
export function markSeen(id: string): void {
  if (!id) return;
  const current = getSeenIds();
  if (current.includes(id)) return;
  writeIds(SEEN_KEY, [...current, id]);
}

/** How many of `allIds` have never been opened. */
export function countUnread(allIds: string[]): number {
  if (!allIds.length) return 0;
  const seen = new Set(getSeenIds());
  let n = 0;
  for (const id of allIds) {
    if (!seen.has(id)) n++;
  }
  return n;
}

/** WhatsApp-style cap: the badge shows "99+" past 99, never four digits. */
export function formatBadgeCount(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}
