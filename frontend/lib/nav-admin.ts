/* ============================================================
   NOVIQ NAV ADMIN — admin-editable navigation
   ============================================================
   Same persistence model as lib/content-admin.ts (versioned
   localStorage key, sparse patch, SSR-safe) but with one crucial
   difference: it can APPEND items, not just overwrite existing ones.

   Why it cannot reuse applyContentOverrides():
   that function deliberately refuses to invent slots — "a path that
   does not resolve against `base` is ignored rather than injected" —
   which is right for copy, but makes "admin adds a nav link" impossible.
   So the nav keeps its own small store with an explicit shape:

     {
       "hidden": ["pricing"],            // base keys to hide
       "extra":  [{ key, href, labelEn, labelAr, icon? }]  // admin-added
     }

   Admin-added items are always placed in the "More" dropdown (see
   data/nav.ts) so appending a page can never overflow the header.

   Hydration contract (same as useContentOverrides): the server and the
   first client render both use the BASE nav, then the stored state is
   applied in an effect. An admin edit therefore can never cause a
   hydration mismatch.
   ============================================================ */

import { NAV_KEYS, type NavItem } from '@/data/nav';

const VERSION = 1;
const KEY = `noviq_nav_v${VERSION}`;

export interface NavState {
  /** Base keys the admin hid. Unknown keys are dropped on read. */
  hidden: string[];
  /** Admin-added items. Rendered in the "More" dropdown. */
  extra: NavItem[];
}

export const EMPTY_NAV_STATE: NavState = { hidden: [], extra: [] };

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/* ---------- validation ---------- */

const MAX_EXTRA = 40;
const MAX_LABEL = 60;
const MAX_HREF = 200;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Only same-origin, locale-less absolute paths are accepted. */
function safeHref(raw: string): string {
  if (!raw) return '';
  // Reject protocol-relative and absolute URLs — a nav link must stay
  // inside the app so the locale prefix and next-intl routing still work.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return '';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.length <= MAX_HREF ? path : '';
}

function normalizeItem(raw: unknown): NavItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const key = str(o.key, 40);
  const href = safeHref(str(o.href, MAX_HREF));
  const labelEn = str(o.labelEn, MAX_LABEL);
  const labelAr = str(o.labelAr, MAX_LABEL);

  // An item with no usable English label or no safe href is unusable.
  if (!key || !href || !labelEn) return null;

  const item: NavItem = { key, href, labelEn, labelAr: labelAr || labelEn };
  const icon = str(o.icon, 40);
  if (icon) item.icon = icon;
  return item;
}

/** Coerce anything read from storage into a valid NavState. */
export function normalizeNavState(raw: unknown): NavState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_NAV_STATE };
  const o = raw as Record<string, unknown>;

  const hidden = Array.isArray(o.hidden)
    ? Array.from(
        new Set(
          o.hidden
            .map((k) => str(k, 40))
            // An admin-added item cannot be "hidden" — it has no base slot.
            .filter((k) => k && NAV_KEYS.has(k))
        )
      )
    : [];

  const seen = new Set<string>();
  const extra: NavItem[] = [];
  if (Array.isArray(o.extra)) {
    for (const rawItem of o.extra) {
      if (extra.length >= MAX_EXTRA) break;
      const item = normalizeItem(rawItem);
      if (!item) continue;
      // Duplicate keys would produce two identical React keys and two
      // links pointing at the same place. First one wins.
      if (seen.has(item.key) || NAV_KEYS.has(item.key)) continue;
      seen.add(item.key);
      extra.push(item);
    }
  }

  return { hidden, extra };
}

/* ---------- read / write ---------- */

/** Read the stored nav state. Returns the base state on the server. */
export function getNavState(): NavState {
  if (!canUseStorage()) return { ...EMPTY_NAV_STATE };

  try {
    for (let v = VERSION; v >= 1; v--) {
      const raw = window.localStorage.getItem(`noviq_nav_v${v}`);
      if (!raw) continue;
      return normalizeNavState(JSON.parse(raw));
    }
  } catch {
    // Private mode / quota / malformed JSON — keep the base nav.
    return { ...EMPTY_NAV_STATE };
  }

  return { ...EMPTY_NAV_STATE };
}

function writeNavState(next: NavState): boolean {
  if (!canUseStorage()) return false;
  const clean = normalizeNavState(next);

  try {
    const isEmpty = clean.hidden.length === 0 && clean.extra.length === 0;
    if (isEmpty) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** Persist and notify this tab + other tabs (mirrors content-admin). */
export function saveNavState(next: NavState): boolean {
  const ok = writeNavState(next);
  if (ok && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('noviq:nav'));
  }
  return ok;
}

/* ---------- mutations ---------- */

/** Hide a base nav item. Returns false for unknown / admin keys. */
export function hideNavItem(key: string): boolean {
  if (!NAV_KEYS.has(key)) return false;
  const cur = getNavState();
  if (cur.hidden.includes(key)) return true;
  return saveNavState({ ...cur, hidden: [...cur.hidden, key] });
}

export function showNavItem(key: string): boolean {
  const cur = getNavState();
  return saveNavState({ ...cur, hidden: cur.hidden.filter((k) => k !== key) });
}

/**
 * Toggle a base item's visibility.
 *
 * Returns the item's NEW visibility: `true` when it is now shown, `false`
 * when it is now hidden. Callers should not have to remember which way
 * round the toggle went, so this is deliberately not "did I hide it".
 */
export function toggleNavItem(key: string): boolean {
  if (!NAV_KEYS.has(key)) return false;

  const wasHidden = getNavState().hidden.includes(key);
  if (wasHidden) showNavItem(key);
  else hideNavItem(key);

  // wasHidden === true  -> we just SHOWED it  -> visible
  // wasHidden === false -> we just HIDDEN it -> not visible
  return wasHidden;
}

/**
 * Append an admin-created item. It is rendered in the "More" dropdown.
 * Rejects duplicates, unsafe hrefs and empty labels.
 */
export function addNavItem(item: {
  key: string;
  href: string;
  labelEn: string;
  labelAr?: string;
  icon?: string;
}): { ok: boolean; reason?: string } {
  const cur = getNavState();

  if (cur.extra.length >= MAX_EXTRA) return { ok: false, reason: 'Too many menu items' };
  if (NAV_KEYS.has(item.key)) return { ok: false, reason: 'An item with that id already exists' };
  if (cur.extra.some((e) => e.key === item.key)) return { ok: false, reason: 'Duplicate id' };

  const normalized = normalizeItem(item);
  if (!normalized) return { ok: false, reason: 'A label and a valid in-app path are required' };

  return saveNavState({ ...cur, extra: [...cur.extra, normalized] })
    ? { ok: true }
    : { ok: false, reason: 'Could not save (storage unavailable)' };
}

export function removeNavItem(key: string): boolean {
  const cur = getNavState();
  if (!cur.extra.some((e) => e.key === key)) return true;
  return saveNavState({ ...cur, extra: cur.extra.filter((e) => e.key !== key) });
}

export function clearNavState(): void {
  if (!canUseStorage()) return;
  for (let v = VERSION; v >= 1; v--) {
    try {
      window.localStorage.removeItem(`noviq_nav_v${v}`);
    } catch {
      // Best effort.
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('noviq:nav'));
}

export const NAV_STORAGE_KEY = KEY;
export const NAV_STORAGE_VERSION = VERSION;
