/**
 * NOVIQ NAVIGATION CONFIG
 * ============================================================
 * Single source of truth for the header menu.
 *
 * The header is split in two so it never overflows its 1280px
 * container at laptop widths:
 *
 *   primary → rendered inline in the desktop bar
 *   more    → rendered inside the "More" dropdown
 *
 * An admin can additionally APPEND items (lib/nav-admin.ts).
 * Admin-added items always land in the "More" dropdown — that is the
 * overflow slot, so adding a page can never break the header layout.
 *
 * `key` is a stable identifier (never the label) because the admin
 * layer hides/un-hides and removes items by key: renaming a label
 * must not detach an item from its stored visibility.
 *
 * `href` is locale-less; the Navbar prefixes `/${locale}`.
 */

export interface NavItem {
  /** Stable id — used by the admin layer for hide/remove. */
  key: string;
  /** Locale-less path, e.g. '/services'. */
  href: string;
  labelEn: string;
  labelAr: string;
  /** Optional lucide icon name, shown in the "More" dropdown. */
  icon?: string;
}

/** Shown inline in the desktop bar (and first in the mobile menu).
 *  Kept deliberately slim — Industries / Our Team / About live in "More". */
export const NAV_PRIMARY: NavItem[] = [
  { key: 'home', href: '/', labelEn: 'Home', labelAr: 'الرئيسية' },
  { key: 'services', href: '/services', labelEn: 'Services', labelAr: 'الخدمات' },
  { key: 'solutions', href: '/solutions', labelEn: 'Solutions', labelAr: 'الحلول' },
  { key: 'portfolio', href: '/portfolio', labelEn: 'Portfolio', labelAr: 'أعمالنا' },
  { key: 'contact', href: '/contact', labelEn: 'Contact', labelAr: 'تواصل معنا' },
];

/** Collapsed into the "More" dropdown on desktop.
 * NOTE: `ai-lab` was retired from the site (admin marks it closed).
 * It stays in the pages-visibility map so the admin can show it as
 * "مغلقة", but it is NOT listed here so no link renders. */
export const NAV_MORE: NavItem[] = [
  { key: 'industries', href: '/industries', labelEn: 'Industries', labelAr: 'القطاعات', icon: 'factory' },
  { key: 'team', href: '/team', labelEn: 'Our Team', labelAr: 'فريقنا', icon: 'users' },
  { key: 'about', href: '/about', labelEn: 'About', labelAr: 'من نحن', icon: 'info' },
  { key: 'pricing', href: '/pricing', labelEn: 'Pricing', labelAr: 'الأسعار', icon: 'tag' },
  { key: 'resources', href: '/resources', labelEn: 'Resources', labelAr: 'الموارد', icon: 'book-open' },
  { key: 'careers', href: '/careers', labelEn: 'Careers', labelAr: 'الوظائف', icon: 'briefcase' },
  { key: 'clients', href: '/clients', labelEn: 'Our Clients', labelAr: 'عملاؤنا', icon: 'heart-pulse' },
  { key: 'toolkit', href: '/toolkit', labelEn: 'Toolkit', labelAr: 'الأدوات', icon: 'layers' },
  { key: 'faq', href: '/faq', labelEn: 'FAQ', labelAr: 'الأسئلة الشائعة', icon: 'help-circle' },
  { key: 'why', href: '/why', labelEn: 'Why Noviq', labelAr: 'لماذا نوفيك', icon: 'award' },
  { key: 'resource', href: '/resource', labelEn: 'API Docs', labelAr: 'وثائق API', icon: 'code' },
];

/** Every base key, for validation when an admin adds a duplicate. */
export const NAV_KEYS = new Set(
  [...NAV_PRIMARY, ...NAV_MORE].map((i) => i.key)
);

/** Localized label for an item, falling back to English. */
export function navLabel(item: NavItem, locale: string): string {
  return locale === 'ar' ? item.labelAr || item.labelEn : item.labelEn;
}
