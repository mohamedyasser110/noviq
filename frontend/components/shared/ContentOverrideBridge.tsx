'use client';

/* ============================================================
   NOVIQ — Content override bridge (client)
   ============================================================
   Applies localStorage content overrides to the live DOM at runtime.

   Why a DOM bridge instead of threading overrides through props:
   server components render the content, and server components cannot
   read localStorage. Passing overrides down as props would mean
   restructuring every content page. Tagging the nodes that carry
   editable copy keeps this purely additive — nothing about the
   existing render tree changes, and pages opt in one node at a time.

   Usage (server component, no 'use client' needed):

     <h1 data-content-path="hero.title">{content.hero.title}</h1>

   The bridge finds every [data-content-path], resolves the dotted path
   against the patch, and writes the value into the node:
     - string  -> textContent
     - number  -> textContent
     - boolean -> toggles the `hidden` attribute
     - array   -> joins with ' · ' (use for chip/tag lists)
   A path with no override is left completely untouched.

   Mounted once from app/[locale]/layout.tsx.

   Note on ordering: this runs in an effect after hydration, so the
   server HTML and the first client render always agree (no hydration
   mismatch). Overrides appear a tick later, which is the correct
   trade-off — an admin edit must never be able to break SSR.
   ============================================================ */
import { useEffect } from 'react';
import { getContentOverrides, type ContentOverrides } from '@/lib/content-admin';

const SELECTOR = '[data-content-path]';

function renderValue(value: unknown): { text?: string; hidden?: boolean } {
  if (typeof value === 'string') return { text: value };
  if (typeof value === 'number' || typeof value === 'bigint') return { text: String(value) };
  if (typeof value === 'boolean') return { hidden: !value };
  if (Array.isArray(value)) return { text: value.filter((v) => v != null).map(String).join(' · ') };
  // Objects/other shapes are not safely representable as text — skip them
  // rather than dumping "[object Object]" into the page.
  return {};
}

function applyPatch(root: ParentNode, overrides: ContentOverrides): number {
  let touched = 0;

  for (const node of Array.from(root.querySelectorAll(SELECTOR))) {
    const path = node.getAttribute('data-content-path');
    if (!path) continue;

    const value = Object.prototype.hasOwnProperty.call(overrides, path)
      ? overrides[path]
      : undefined;
    if (value === undefined) continue;

    const { text, hidden } = renderValue(value);
    const el = node as HTMLElement;

    if (hidden !== undefined) {
      if (hidden) el.setAttribute('hidden', '');
      else el.removeAttribute('hidden');
      touched++;
    }
    if (text !== undefined) {
      el.textContent = text;
      touched++;
    }
  }

  return touched;
}

export default function ContentOverrideBridge() {
  useEffect(() => {
    const run = () => applyPatch(document, getContentOverrides());

    // Apply once on mount, then whenever an admin edit is saved in this tab
    // or in another one.
    run();
    window.addEventListener('noviq:content-overrides', run);
    window.addEventListener('storage', run);

    return () => {
      window.removeEventListener('noviq:content-overrides', run);
      window.removeEventListener('storage', run);
    };
  }, []);

  return null;
}
