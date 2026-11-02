/* ============================================================
   NOVIQ CONTENT ADMIN — localStorage override layer
   ============================================================
   Referenced from data/content.ts. Lets an admin edit site copy
   from the browser and see it applied at runtime, WITHOUT a
   rebuild — the static bundle in data/content.ts stays the base
   layer and localStorage holds a sparse patch on top of it.

   Design constraints (see .agents/skills/vercel-react-best-practices):
     - localStorage does not exist during SSR. Every read is guarded
       and returns the base value on the server, so the first paint is
       always the static content — no SSR crash, no hydration mismatch
       on the base render.
     - The key is VERSIONED so a schema change cannot leave a stale
       patch behind: noviq_content_overrides_v1. Reading falls back
       through older versions, writing always targets the current one.
     - The patch is SPARSE. Only edited paths are stored, so an override
       never has to re-send the whole content tree (keeps the localStorage
       payload small and makes merging a pure deep-merge).

   Shape of a stored patch — dotted paths map to replacement values:
     {
       "hero.title": "Custom headline",
       "services.0.title": "Renamed service",
       "footer.tagline": "New tagline"
     }

   Public API:
     getContentOverrides()                  -> Record<string, unknown>
     setContentOverride(path, value)        -> void
     clearContentOverride(path)             -> void
     clearAllContentOverrides()             -> void
     applyContentOverrides(base, overrides) -> merged deep copy

   applyContentOverrides is a pure deep-merge: numeric segments index
   into arrays, everything else indexes objects. A path that does not
   resolve against `base` is ignored rather than injected, so a typo in
   the admin UI cannot invent phantom fields in the content tree.
   ============================================================ */

const VERSION = 1;
const KEY = `noviq_content_overrides_v${VERSION}`;

export type ContentOverrides = Record<string, unknown>;

/** True only in the browser. */
function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Read the stored patch. Returns {} on the server, on a parse error, or
 * when the stored value is not a plain object — a corrupt patch must never
 * take the site down.
 */
export function getContentOverrides(): ContentOverrides {
  if (!canUseStorage()) return {};

  try {
    // Read current version first; fall back to older ones so an upgrade
    // does not silently drop an admin's pending edits.
    for (let v = VERSION; v >= 1; v--) {
      const raw = window.localStorage.getItem(`noviq_content_overrides_v${v}`);
      if (!raw) continue;

      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ContentOverrides;
      }
    }
  } catch {
    // Private-mode / quota / malformed JSON — fall back to no overrides.
    return {};
  }

  return {};
}

function writeContentOverrides(next: ContentOverrides): boolean {
  if (!canUseStorage()) return false;

  try {
    if (Object.keys(next).length === 0) {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    }
    return true;
  } catch {
    return false;
  }
}

/** Set (or replace) a single dotted-path override. */
export function setContentOverride(path: string, value: unknown): boolean {
  if (!path) return false;
  const next = getContentOverrides();
  next[path] = value;
  return writeContentOverrides(next);
}

/** Remove a single dotted-path override. */
export function clearContentOverride(path: string): boolean {
  const next = getContentOverrides();
  if (!(path in next)) return true;
  delete next[path];
  return writeContentOverrides(next);
}

/** Drop every override for every stored version. */
export function clearAllContentOverrides(): void {
  if (!canUseStorage()) return;
  for (let v = VERSION; v >= 1; v--) {
    try {
      window.localStorage.removeItem(`noviq_content_overrides_v${v}`);
    } catch {
      // Ignore — best effort.
    }
  }
}

/** Structured deep clone that keeps arrays and plain objects distinct. */
function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneValue(v);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Deep-merge a sparse dotted-path patch onto a base content tree.
 *
 * Returns a new value; `base` is never mutated. Paths that do not resolve
 * against the base are skipped, so the result's shape always matches the
 * shape the components expect.
 */
export function applyContentOverrides<T>(base: T, overrides: ContentOverrides = getContentOverrides()): T {
  const entries = Object.entries(overrides);
  if (entries.length === 0) return base;

  const result = cloneValue(base);

  for (const [path, replacement] of entries) {
    const segments = path.split('.').filter(Boolean);
    if (segments.length === 0) continue;

    // Walk to the parent container, verifying each hop exists.
    let cursor: unknown = result;
    let reachable = true;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (cursor === null || typeof cursor !== 'object') { reachable = false; break; }
      cursor = (cursor as Record<string, unknown>)[seg];
    }

    if (!reachable || cursor === null || typeof cursor !== 'object') continue;

    const last = segments[segments.length - 1];
    // Only overwrite a slot that genuinely exists in the base tree.
    if (Array.isArray(cursor)) {
      const idx = Number(last);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) continue;
      cursor[idx] = cloneValue(replacement);
    } else {
      const obj = cursor as Record<string, unknown>;
      if (!(last in obj)) continue;
      obj[last] = cloneValue(replacement);
    }
  }

  return result;
}

/**
 * Persist a patch and notify listeners in this tab. Use this instead of
 * calling setContentOverride directly when an admin UI is open, so the
 * live preview updates without a reload.
 */
export function saveContentOverrides(next: ContentOverrides): boolean {
  const ok = writeContentOverrides(next);
  if (ok && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('noviq:content-overrides'));
  }
  return ok;
}

export const CONTENT_OVERRIDES_KEY = KEY;
export const CONTENT_OVERRIDES_VERSION = VERSION;
