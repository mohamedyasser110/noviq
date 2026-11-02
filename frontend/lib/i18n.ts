/* ============================================================
   NOVIQ Frontend — i18n exports for client components
   ============================================================ */
export { locales, defaultLocale, type Locale } from '@/app/i18n/config';

import type { AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';
import { getRuntimeMessages, mergeMessages, type MessagesTree } from '@/lib/i18n-runtime';

/**
 * A generic node of a next-intl messages tree.
 *
 * Re-exported from lib/i18n-runtime so the runtime merger and every caller
 * agree on the shape: a leaf is a string, a group is a nested tree. (The wider
 * `Record<string, unknown>` this used to be cannot be handed to mergeMessages —
 * it allows a leaf of any type, which the merger deliberately does not accept.)
 */
export type { MessagesTree } from '@/lib/i18n-runtime';

/**
 * Safely resolve a dot-separated key against a next-intl messages object.
 *
 * Returns `undefined` when any segment of the path is missing, when an
 * intermediate value is a leaf string, or when the resolved value is not a
 * string — so callers can keep their own hard-coded fallback copy:
 *
 * ```tsx
 * {readMessage(messages, 'common.goHome') || 'Go Home'}
 * ```
 */
export function readMessage(
  messages: MessagesTree,
  key: string
): string | undefined {
  const value = key.split('.').reduce<unknown>((node, segment) => {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    return (node as Record<string, unknown>)[segment];
  }, messages);

  return typeof value === 'string' ? value : undefined;
}

/**
 * Load messages for a given locale: the bundled JSON, with the live
 * admin-editable dictionary layered on top.
 *
 * WHY the fetch matters: a plain `import('../i18n/<locale>.json')` is resolved
 * once and then held in the server module cache, so an admin reword would never
 * reach the site without a rebuild. Reading the dictionary from the API
 * (cached for 60s by the same ISR window as the rest of the CMS) is what makes
 * a translation edit go live on its own.
 *
 * The bundled JSON stays the base and the mandatory fallback: if the endpoint
 * 404s while it is still rolling out, the API is down, or the payload is not a
 * dictionary, getRuntimeMessages returns null and the shipped copy is used
 * unchanged. Never throws.
 */
export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  let bundled: MessagesTree = {};
  try {
    const mod = await import(`../i18n/${locale}.json`);
    bundled = mod.default as MessagesTree;
  } catch {
    bundled = {};
  }
  const runtime = await getRuntimeMessages(locale);
  return mergeMessages(bundled, runtime) as AbstractIntlMessages;
}
