/* ============================================================
   NOVIQ — Knowledge Hub header shortcut (logged-in only)
   ------------------------------------------------------------
   When a visitor is signed in, Resources leaves the "More" overflow and
   sits with the rest of the header elements, carrying a WhatsApp-style
   unread badge: the number of published items never opened on this
   device. Zero unread renders the plain link with no badge — a badge
   that says "0" is noise, not information.

   Read state lives in lib/resources-store.ts (localStorage, per device).
   "Unread" therefore means "published but never opened HERE", and an item
   the admin publishes tomorrow is automatically unread for everyone. No
   timestamps, no account requirement, no extra backend.

   HYDRATION CONTRACT
   First render always shows the bare link with no badge: the unread count
   is computed in an effect (localStorage + network), never during render.
   Logged-out renders null — but the CALLER gates on isLoggedIn, so this
   never flashes for visitors.
   ============================================================ */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { RESOURCES_EVENT, countUnread, formatBadgeCount } from '@/lib/resources-store';

/* One in-flight request shared by every mounted instance (desktop link +
   drawer link), plus a 60s floor between refetches: the badge must not
   cost a request per navigation. */
let cachedIds: string[] | null = null;
let cachedAt = 0;
let inflight: Promise<string[]> | null = null;

const CACHE_TTL_MS = 60_000;

async function fetchPublishedIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedIds && now - cachedAt < CACHE_TTL_MS) return cachedIds;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${base}/api/content/resources`, { cache: 'no-store' });
      if (!res.ok) return cachedIds ?? [];
      const data = (await res.json().catch(() => null)) as {
        items?: Record<string, Array<{ id?: unknown }>>;
      } | null;
      if (!data || typeof data.items !== 'object' || !data.items) return cachedIds ?? [];
      const ids: string[] = [];
      for (const list of Object.values(data.items)) {
        if (!Array.isArray(list)) continue;
        for (const it of list) {
          if (it && typeof it === 'object' && typeof it.id === 'string' && it.id) {
            ids.push(it.id);
          }
        }
      }
      cachedIds = ids;
      cachedAt = Date.now();
      return ids;
    } catch {
      return cachedIds ?? [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Live unread count for the badge. 0 until the first check finishes. */
export function useResourcesUnread(): number {
  const { isLoggedIn } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setUnread(0);
      return;
    }
    const ids = await fetchPublishedIds();
    setUnread(countUnread(ids));
  }, [isLoggedIn]);

  useEffect(() => {
    refresh();
    window.addEventListener(RESOURCES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    /* A returning tab re-checks: the admin may have published since. */
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(RESOURCES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return unread;
}

interface ShortcutProps {
  locale: string;
  label: string;
  onNavigate?: () => void;
  variant: 'desktop' | 'drawer';
}

export default function ResourcesShortcut({ locale, label, onNavigate, variant }: ShortcutProps) {
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const unread = useResourcesUnread();

  if (!isLoggedIn) return null;

  const href = `/${locale}/resources`;
  const active = pathname === href || pathname === `${href}/`;
  const badge = formatBadgeCount(unread);

  if (variant === 'drawer') {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className="noviq-drawer-link noviq-shortcut-link"
        data-nav-key="resources"
        aria-label={unread > 0 ? `${label}, ${unread} unread` : label}
      >
        <span>{label}</span>
        {badge ? (
          <span className="noviq-unread-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`nav-link noviq-shortcut-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={unread > 0 ? `${label}, ${unread} unread` : label}
      onClick={onNavigate}
    >
      <span>{label}</span>
      {badge ? (
        <span className="noviq-unread-badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
