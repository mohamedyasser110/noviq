'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NAV_MORE, NAV_PRIMARY, navLabel, type NavItem } from '@/data/nav';
import { EMPTY_NAV_STATE, getNavState, type NavState } from '@/lib/nav-admin';
import { buildSearchIndex, runSearch, type SearchHit } from '@/lib/search';
import { useAuth } from '@/lib/auth';
import {
  LOGO_DEFAULTS,
  fetchVisualSettings,
  resolveLogo,
  type LogoSettings,
} from '@/lib/hero-visual-content';
import ResourcesShortcut from '@/components/layout/ResourcesShortcut';

interface NavbarProps {
  locale: 'en' | 'ar';
}

type Theme = 'light' | 'dark';

/* Where the choice is kept, and the key the pre-paint script in
   app/[locale]/layout.tsx reads. They must stay in sync — that script
   runs before React exists, so it cannot import anything from here. */
export const THEME_STORAGE_KEY = 'noviq_theme';

export default function Navbar({ locale }: NavbarProps) {
  /* Active-route highlighting for the desktop links. */
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  /* Mobile drawer's "More" group is a COLLAPSIBLE disclosure, not a flat
     list. On a phone the drawer already carries the primary links, the
     search field and the sign-in CTA; always expanding the overflow group
     added 4-6 rows of dead weight that pushed the CTA below the fold on
     short screens. Collapsed by default, and the label stays visible so
     the items remain discoverable. Deliberately separate from `moreOpen`,
     which drives the desktop dropdown. */
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  /* Hydration contract (same as useContentOverrides): render the BASE nav
     on the server AND on the first client render, then swap in the admin's
     stored state in an effect. An admin edit can never cause a mismatch. */
  const [navState, setNavState] = useState<NavState>(EMPTY_NAV_STATE);
  const [hydrated, setHydrated] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const isArabic = locale === 'ar';

  /* ---- theme ---------------------------------------------------------
     Synchronizes BOTH data-theme attribute AND the .dark class on <html>
     so that Tailwind's `darkMode: 'class'` utilities and custom tokens both work. */
  const [theme, setTheme] = useState<Theme>('light');

  /* Adopt whatever the pre-paint script already applied, so the icon
     matches the page on first paint instead of flashing. */
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const isDark = current === 'dark' || hasDarkClass;
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      const root = document.documentElement;
      root.setAttribute('data-theme', next);
      if (next === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      // Keep the browser chrome (address bar, form controls) in step.
      root.style.colorScheme = next;
      // Mirror the pre-paint script, which owns this meta on first load.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#0A0A0F' : '#FFFFFF');
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* private mode / storage disabled */
      }
      return next;
    });
  }, []);

  /* ---- search --------------------------------------------------------
     Searches the real index, supporting desktop and mobile modal dialogs. */
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Rebuilt only when the locale flips — the index is locale-specific. */
  const searchIndex = useMemo(() => buildSearchIndex(locale), [locale]);
  const hits: SearchHit[] = useMemo(
    () => runSearch(searchIndex, query),
    [searchIndex, query]
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setActiveHit(0);
  }, []);

  /* "/" or Ctrl+K / Cmd+K focuses search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        const el = e.target as HTMLElement | null;
        const typing =
          el &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        if (window.innerWidth < 1280) {
          setMobileSearchOpen(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
        } else {
          searchInputRef.current?.focus();
          setSearchOpen(true);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Click outside closes the desktop results panel. */
  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [searchOpen, closeSearch]);

  const goToHit = useCallback((hit: SearchHit) => {
    closeSearch();
    setMobileSearchOpen(false);
    setQuery('');
    router.push(hit.href);
  }, [closeSearch, router]);

  /* Arrow keys move, Enter opens, Escape closes */
  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        setMobileSearchOpen(false);
        searchInputRef.current?.blur();
        return;
      }
      if (!hits.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveHit((i) => (i + 1) % hits.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveHit((i) => (i - 1 + hits.length) % hits.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        goToHit(hits[activeHit] ?? hits[0]);
      }
    },
    [hits, activeHit, goToHit, closeSearch]
  );

  const searchText = isArabic
    ? {
        results: 'نتائج البحث',
        noResults: 'لا توجد نتائج',
        hint: 'اكتب للبحث…',
        categories: 'التصنيفات',
      }
    : {
        results: 'Search results',
        noResults: 'No results found',
        hint: 'Type to search…',
        categories: 'Categories',
      };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* Load admin nav edits after mount, and stay in sync with other tabs. */
  useEffect(() => {
    const read = () => {
      setNavState(getNavState());
      setHydrated(true);
    };
    read();
    window.addEventListener('noviq:nav', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('noviq:nav', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  /* Page visibility from the CMS (admin → Site Content → Pages).
     Disabled pages vanish from the header in both locales.
     ai-lab is retired: it is absent from NAV_MORE AND disabled
     in the map, so it can never render even via admin extras. */
  const [pageVisibility, setPageVisibility] = useState<Record<string, boolean> | null>(null);
  /* Per-page placement from the same map: 'bar' renders a MORE item inline,
     'more' parks a primary item in the overflow menu. Absent = static split
     (NAV_PRIMARY → bar, NAV_MORE → more), so older maps behave as before. */
  const [pagePlacement, setPagePlacement] = useState<Record<string, 'bar' | 'more'>>({});
  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/content/pages`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== 'object') return;
        const map: Record<string, boolean> = {};
        const place: Record<string, 'bar' | 'more'> = {};
        for (const [slug, entry] of Object.entries(data as Record<string, unknown>)) {
          if (entry && typeof entry === 'object' && 'enabled' in (entry as object)) {
            map[slug] = (entry as { enabled: boolean }).enabled === true;
            const at = (entry as { placement?: unknown }).placement;
            if (at === 'bar' || at === 'more') place[slug] = at;
          }
        }
        setPageVisibility(map);
        setPagePlacement(place);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isVisible = useCallback(
    (key: string) => {
      if (key === 'ai-lab') return false;
      if (!pageVisibility) return true;
      if (!(key in pageVisibility)) return true;
      return pageVisibility[key] === true;
    },
    [pageVisibility]
  );

  const closeAll = useCallback(() => {
    setMoreOpen(false);
    setMobileMoreOpen(false);
    setMobileMenuOpen(false);
  }, []);

  /* Escape closes both layers and returns focus to the More trigger. */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (moreOpen) {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
      setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [moreOpen]);

  /* Freeze page scroll while the drawer is open, compensating for the
     scrollbar width so the layout behind it does not jump sideways. */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingInlineEnd;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingInlineEnd = prevPadding;
    };
  }, [mobileMenuOpen]);

  /* Click outside closes the dropdown. */
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [moreOpen]);

  /* Close the dropdown when the viewport drops to the mobile layout. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => {
      if (mq.matches) setMoreOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const labels = isArabic
    ? {
        home: 'الرئيسية', services: 'الخدمات', industries: 'القطاعات',
        solutions: 'الحلول', aiLab: 'مختبر الذكاء الاصطناعي', portfolio: 'أعمالنا', team: 'فريقنا',
        more: 'المزيد', login: 'Login',
        language: 'English', searchPlaceholder: 'ابحث...', resources: 'الموارد', careers: 'الوظائف',
        contact: 'تواصل معنا', pricing: 'الأسعار', about: 'من نحن',
      }
    : {
        home: 'Home', services: 'Services', industries: 'Industries',
        solutions: 'Solutions', aiLab: 'AI Lab', portfolio: 'Portfolio', team: 'Our Team',
        more: 'More', login: 'Login',
        language: 'العربية', searchPlaceholder: 'Search...', resources: 'Resources', careers: 'Careers',
        contact: 'Contact', pricing: 'Pricing', about: 'About',
      };

  /* i18n dictionary wins for the base routes so translators can adjust
     them; data/nav.ts supplies the Arabic label for everything else
     (including admin-added items). */
  const labelFor = useCallback(
    (item: NavItem): string => {
      const key = item.key;
      const fromI18n = t.has(key) ? t(key) : undefined;
      return fromI18n || navLabel(item, locale);
    },
    [t, locale]
  );

  const hidden = hydrated ? navState.hidden : EMPTY_NAV_STATE.hidden;

  /* The Knowledge Hub shortcut joins the header ONLY for signed-in visitors
     (with its unread badge). Logged-out visitors keep the exact previous
     layout — Resources stays in "More" and nothing shifts. */
  const { isLoggedIn } = useAuth();
  const hubItem = NAV_MORE.find((i) => i.key === 'resources');
  const showHub =
    isLoggedIn &&
    !!hubItem &&
    !hidden.includes('resources') &&
    isVisible('resources');

  const primary = [
    ...NAV_PRIMARY.filter((i) => !hidden.includes(i.key) && isVisible(i.key) && pagePlacement[i.key] !== 'more'),
    /* MORE items the admin promoted to the bar render after the static
       primaries, in MORE order — the bar never re-sorts itself. */
    ...NAV_MORE.filter((i) => !hidden.includes(i.key) && isVisible(i.key) && pagePlacement[i.key] === 'bar'),
  ];
  const primaryWithHub: NavItem[] =
    showHub && hubItem && !primary.some((i) => i.key === 'resources') ? [...primary, hubItem] : primary;

  /* Admin-added items always land in the overflow dropdown. When the hub
     shortcut is promoted to the bar it leaves "More", so it never appears
     twice for signed-in visitors. Primary items parked in MORE join here. */
  const more: NavItem[] = [
    ...NAV_MORE.filter(
      (i) => !hidden.includes(i.key) && isVisible(i.key) && pagePlacement[i.key] !== 'bar' && !(showHub && i.key === 'resources')
    ),
    ...NAV_PRIMARY.filter((i) => !hidden.includes(i.key) && isVisible(i.key) && pagePlacement[i.key] === 'more'),
    ...(hydrated ? navState.extra.filter((i) => isVisible(i.key)) : []),
  ];

  const moreLabel = t.has('more') ? t('more') : labels.more;

  return (
    <>
    <nav
      id="navbar"
      className={`noviq-navbar ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
      aria-label={isArabic ? 'التنقل الرئيسي' : 'Main navigation'}
    >
      <div className="noviq-navbar-container">
        <Link href={`/${locale}`} className="noviq-logo" aria-label="Noviq Home">
          <LogoIcon isArabic={isArabic} />
        </Link>

        <div className="noviq-desktop-nav" id="desktop-nav">
          {primaryWithHub.map((item) => {
            /* The hub shortcut carries its own unread badge — it renders
               itself instead of the plain link. */
            if (showHub && item.key === 'resources') {
              return (
                <ResourcesShortcut
                  key={item.key}
                  locale={locale}
                  label={labelFor(item)}
                  onNavigate={closeAll}
                  variant="desktop"
                />
              );
            }
            /* Home stores href '/' but renders at '/{locale}' (no trailing
               slash); normalize it here so the active rule below can match. */
            const full = `/${locale}${item.href === '/' ? '' : item.href}`;
            const isHome = item.key === 'home';
            const active = isHome || item.href === ''
              ? pathname === full || pathname === `${full}/`
              : pathname === full || pathname?.startsWith(`${full}/`);
            return (
              <Link
                key={item.key}
                href={full}
                className={`nav-link${active ? ' is-active' : ''}${isHome ? ' nav-link-home' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={closeAll}
              >
                {labelFor(item)}
              </Link>
            );
          })}

          {more.length > 0 && (
            <div className="noviq-more" ref={moreRef}>
              <button
                type="button"
                ref={moreButtonRef}
                className="nav-link noviq-more-trigger"
                id="more-trigger"
                aria-haspopup="true"
                aria-expanded={moreOpen}
                aria-controls="more-menu"
                onClick={() => setMoreOpen((v) => !v)}
              >
                {moreLabel}
                <ChevronIcon open={moreOpen} />
              </button>

              <div
                id="more-menu"
                className={`noviq-more-menu ${moreOpen ? 'open' : ''}`}
                role="menu"
                hidden={!moreOpen}
              >
                {more.map((item) => (
                  <Link
                    key={item.key}
                    href={`/${locale}${item.href}`}
                    className="noviq-more-item"
                    role="menuitem"
                    data-nav-key={item.key}
                    tabIndex={moreOpen ? 0 : -1}
                    onClick={closeAll}
                  >
                    {labelFor(item)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="noviq-nav-actions">
          {/* Theme Toggle — quiet utility button */}
          <button
            type="button"
            className={`noviq-theme-toggle is-${theme}`}
            id="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? (isArabic ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode') : (isArabic ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode')}
            title={theme === 'dark' ? (isArabic ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode') : (isArabic ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode')}
            aria-pressed={theme === 'dark'}
          >
            <span className="noviq-theme-track" aria-hidden="true">
              <span className="noviq-theme-knob">
                <ThemeToggleIcon dark={theme === 'dark'} />
              </span>
            </span>
          </button>

          {/* Desktop Search Bar */}
          <div className="noviq-header-search" role="search" ref={searchRef}>
            <SearchIcon className="noviq-search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              id="header-search-input"
              placeholder={labels.searchPlaceholder}
              aria-label={isArabic ? 'البحث في الموقع' : 'Search the site'}
              className="noviq-search-input"
              autoComplete="off"
              value={query}
              role="combobox"
              aria-expanded={searchOpen && query.trim().length >= 2}
              aria-controls="header-search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                searchOpen && hits.length
                  ? `header-search-hit-${activeHit}`
                  : undefined
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
                setActiveHit(0);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
            />

            {query.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="noviq-search-clear-btn"
                aria-label={isArabic ? 'مسح البحث' : 'Clear search'}
              >
                ✕
              </button>
            ) : (
              <span className="noviq-search-kbd-hint" aria-hidden="true">/</span>
            )}

            {searchOpen && query.trim().length >= 2 && (
              <div
                className="noviq-search-results"
                id="header-search-results"
                role="listbox"
                aria-label={searchText.results}
              >
                {hits.length === 0 ? (
                  <p className="noviq-search-empty">{searchText.noResults}</p>
                ) : (
                  <>
                    <p className="noviq-search-heading" aria-hidden="true">
                      {searchText.results}
                    </p>
                    {hits.map((hit, i) => (
                      <a
                        key={`${hit.category}-${hit.href}-${hit.title}`}
                        id={`header-search-hit-${i}`}
                        role="option"
                        aria-selected={i === activeHit}
                        className={`noviq-search-hit ${i === activeHit ? 'is-active' : ''}`}
                        href={hit.href}
                        onMouseEnter={() => setActiveHit(i)}
                        onClick={(e) => {
                          e.preventDefault();
                          goToHit(hit);
                        }}
                      >
                        <span className="noviq-search-hit-title">{hit.title}</span>
                        {hit.desc && (
                          <span className="noviq-search-hit-desc">{hit.desc}</span>
                        )}
                        <span className="noviq-search-hit-cat">{hit.category}</span>
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`noviq-language-toggle is-${locale}`}
            aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            id="language-toggle"
            onClick={() => {
              window.location.href = `/${isArabic ? 'en' : 'ar'}${window.location.pathname.replace(/^\/(en|ar)/, '')}`;
            }}
          >
            <span className="lang-code">{isArabic ? 'EN' : 'عربي'}</span>
          </button>

          {/* Session-aware: identical Login pill until the session resolves,
              then the account link + sign-out. Same slot, same size class,
              so no layout shift and no hydration mismatch. */}
          <AuthArea locale={locale} isArabic={isArabic} />

          <button
            id="mobile-toggle"
            className="noviq-mobile-toggle"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setMobileMenuOpen((v) => !v);
              setMoreOpen(false);
              setMobileMoreOpen(false);
            }}
          >
            {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Responsive Search Modal (for mobile, tablet, and quick search) */}
        {mobileSearchOpen && (
          <div className="noviq-search-modal-backdrop" onClick={() => setMobileSearchOpen(false)}>
            <div 
              className="noviq-search-modal-card" 
              onClick={(e) => e.stopPropagation()} 
              role="dialog" 
              aria-modal="true" 
              aria-label={searchText.results}
            >
              <div className="noviq-search-modal-header">
                <SearchIcon className="h-5 w-5 text-primary shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  className="noviq-search-modal-input"
                  placeholder={labels.searchPlaceholder}
                  value={query}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      mobileSearchInputRef.current?.focus();
                    }}
                    className="noviq-search-modal-clear"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(false)}
                  className="noviq-search-modal-close"
                  aria-label={isArabic ? 'إغلاق' : 'Close'}
                >
                  <XIcon />
                </button>
              </div>

              <div className="noviq-search-modal-body">
                {query.trim().length >= 2 ? (
                  hits.length === 0 ? (
                    <div className="py-8 text-center text-ink-muted dark:text-slate-400 text-sm">
                      {searchText.noResults}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {hits.map((hit, i) => (
                        <div
                          key={`${hit.category}-${hit.href}-${hit.title}`}
                          className={`noviq-search-hit p-3 rounded-xl cursor-pointer ${i === activeHit ? 'is-active' : ''}`}
                          onClick={() => goToHit(hit)}
                          onMouseEnter={() => setActiveHit(i)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">{hit.title}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{hit.category}</span>
                          </div>
                          {hit.desc && (
                            <p className="text-xs text-ink-muted dark:text-slate-400 mt-1 line-clamp-2">{hit.desc}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="py-4">
                    <p className="text-xs font-semibold text-ink-muted dark:text-slate-400 uppercase tracking-wider mb-3">
                      {searchText.categories}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {primary.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-200 hover:border-primary transition-colors"
                          onClick={() => {
                            setMobileSearchOpen(false);
                            router.push(`/${locale}${item.href}`);
                          }}
                        >
                          {labelFor(item)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <>
            {/* Scrim — tap anywhere outside the panel to dismiss */}
            <div
              className="noviq-drawer-scrim"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="noviq-mobile-menu"
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label={isArabic ? 'قائمة التنقل' : 'Site menu'}
            >
              <div className="noviq-drawer-head">
                <span className="noviq-drawer-title">
                  {isArabic ? 'التنقل' : 'Menu'}
                </span>
                <button
                  type="button"
                  className="noviq-drawer-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={isArabic ? 'إغلاق القائمة' : 'Close menu'}
                >
                  <XIcon />
                </button>
              </div>

              {/* Quick Search inside Drawer */}
              <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/80">
                <div 
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileSearchOpen(true);
                  }}
                >
                  <SearchIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{labels.searchPlaceholder}</span>
                </div>
              </div>

              <nav className="noviq-drawer-nav">
                {primaryWithHub.map((item) => {
                  if (showHub && item.key === 'resources') {
                    return (
                      <ResourcesShortcut
                        key={item.key}
                        locale={locale}
                        label={labelFor(item)}
                        onNavigate={closeAll}
                        variant="drawer"
                      />
                    );
                  }
                  return (
                    <Link
                      key={item.key}
                      href={`/${locale}${item.href}`}
                      onClick={closeAll}
                      className="noviq-drawer-link"
                      data-nav-key={item.key}
                    >
                      {labelFor(item)}
                    </Link>
                  );
                })}

                {more.length > 0 && (
                  <>
                    <div className="noviq-mobile-divider" aria-hidden="true" />
                    {/* A real disclosure, not a styled heading: aria-expanded
                        + aria-controls so a screen reader announces the state
                        and the group can be reached by keyboard. The chevron
                        reuses the desktop one so the two never drift apart. */}
                    <button
                      type="button"
                      className="noviq-drawer-group noviq-drawer-more-trigger"
                      aria-expanded={mobileMoreOpen}
                      aria-controls="mobile-more-items"
                      onClick={() => setMobileMoreOpen((v) => !v)}
                    >
                      <span>{isArabic ? 'المزيد' : 'More'}</span>
                      <ChevronIcon open={mobileMoreOpen} />
                    </button>
                    {/* `hidden` (not a height animation) keeps the collapsed
                        group out of the tab order and out of the a11y tree
                        for free. The drawer is a short, scrolling panel, so
                        there is nothing to animate against. */}
                    <div id="mobile-more-items" hidden={!mobileMoreOpen}>
                      {more.map((item) => (
                        <Link
                          key={item.key}
                          href={`/${locale}${item.href}`}
                          onClick={closeAll}
                          className="noviq-drawer-link"
                          data-nav-key={item.key}
                        >
                          {labelFor(item)}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </nav>

              <div className="noviq-drawer-foot">
                <DrawerAuthArea
                  locale={locale}
                  isArabic={isArabic}
                  onNavigate={closeAll}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="noviq-scroll-progress" id="scroll-progress" aria-hidden="true" />
    </nav>
      {/* Sibling of <nav>, never inside it: the navbar's backdrop-filter
          makes it a containing block, which would pin this fixed button
          to the header instead of the viewport. */}
      <DashboardFab locale={locale} isArabic={isArabic} />
    </>
  );
}

/* Mobile dashboard shortcut (DashboardFab): a fixed circular button —
   layout-space zero by construction — that tells a signed-in visitor on a
   phone "you have a dashboard" and carries the unread count into it. Renders
   nothing on desktop (media query) and nothing when logged out or while the
   session is still resolving (no badge flash for visitors). */
function DashboardFab({ locale, isArabic }: { locale: 'en' | 'ar'; isArabic: boolean }) {
  const { user, loading, unread } = useAuth();
  if (loading || !user) return null;
  const unreadCount = Number(unread) || 0;
  const initial =
    ((user.firstName && user.firstName.trim()) ||
      (user.email ? user.email.split('@')[0] : '') ||
      (isArabic ? 'ح' : 'A')).trim().charAt(0).toUpperCase() || (isArabic ? 'ح' : 'A');
  return (
    <Link
      href={`/${locale}/account`}
      className="noviq-dash-fab"
      aria-label={
        unreadCount > 0
          ? isArabic
            ? `لوحتي، ${unreadCount} تحديثات غير مقروءة`
            : `My dashboard, ${unreadCount} unread updates`
          : isArabic
            ? 'لوحتي'
            : 'My dashboard'
      }
      title={isArabic ? 'لوحتي' : 'My dashboard'}
    >
      <span className="noviq-login-avatar" aria-hidden="true">{initial}</span>
      {unreadCount > 0 && (
        <span className="noviq-unread-badge" aria-hidden="true">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

/* ---- session-aware auth slot -------------------------------------------
   The header used to hard-link to /login unconditionally: a signed-in
   visitor kept seeing a Login button that led to a form they had already
   completed, and the account page kept asking them to sign in. Both read
   from useAuth() now — the single session source in lib/auth.tsx.

   Loading (and logged-out) renders the byte-identical Login pill, so the
   first paint matches the server render: no hydration mismatch, no layout
   shift, and the navbar-cta-removed Playwright checks keep passing. */
function AuthArea({ locale, isArabic }: { locale: 'en' | 'ar'; isArabic: boolean }) {
  /* No standalone sign-out here: the account page and the mobile drawer
     both sign out, so the header stays one quiet chip — the account link
     with an unread badge when project updates are waiting. */
  const { user, loading, unread } = useAuth();

  if (loading || !user) {
    return (
      <Link href={`/${locale}/login`} className="noviq-login-icon" aria-label="Login">
        <UserIcon />
        <span className="login-text">{isArabic ? 'دخول' : 'Login'}</span>
      </Link>
    );
  }

  const display =
    (user.firstName && user.firstName.trim()) ||
    (user.email ? user.email.split('@')[0] : '') ||
    (isArabic ? 'حسابي' : 'Account');
  const initial = (display.trim().charAt(0) || (isArabic ? 'ح' : 'A')).toUpperCase();
  const unreadCount = Number(unread) || 0;

  return (
    <span className="noviq-auth-slot">
      <Link
        href={`/${locale}/account`}
        className="noviq-login-icon is-logged"
        aria-label={
          unreadCount > 0
            ? isArabic
              ? `حسابي، ${unreadCount} تحديثات غير مقروءة`
              : `My account, ${unreadCount} unread updates`
            : isArabic
              ? 'حسابي'
              : 'My account'
        }
        title={user.email || display}
      >
        <span className="noviq-login-avatar" aria-hidden="true">{initial}</span>
        <span className="login-text">{display}</span>
        {unreadCount > 0 && (
          <span className="noviq-unread-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </span>
  );
}

/* Mobile drawer equivalent: account + sign-out when signed in, the plain
   Sign In CTA otherwise. Same classes as before in the logged-out branch. */
function DrawerAuthArea({
  locale,
  isArabic,
  onNavigate,
}: {
  locale: 'en' | 'ar';
  isArabic: boolean;
  onNavigate: () => void;
}) {
  const { user, loading, unread, logout } = useAuth();
  const router = useRouter();

  if (loading || !user) {
    return (
      <Link
        href={`/${locale}/login`}
        onClick={onNavigate}
        className="noviq-drawer-cta"
      >
        {isArabic ? 'تسجيل الدخول' : 'Sign In'}
      </Link>
    );
  }

  const display =
    (user.firstName && user.firstName.trim()) ||
    (user.email ? user.email.split('@')[0] : '') ||
    (isArabic ? 'حسابي' : 'My account');
  const unreadCount = Number(unread) || 0;

  const signOut = () => {
    logout();
    onNavigate();
    router.push(`/${locale}`);
    router.refresh();
  };

  return (
    <>
      <Link
        href={`/${locale}/account`}
        onClick={onNavigate}
        className="noviq-drawer-cta"
      >
        {isArabic ? `أهلاً، ${display}` : `Hi, ${display}`}
        {unreadCount > 0 && (
          <span className="noviq-unread-badge is-inline" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="noviq-drawer-cta is-ghost"
      >
        {isArabic ? 'تسجيل الخروج' : 'Sign Out'}
      </button>
    </>
  );
}

/* ---- icons (inline SVG: no runtime icon library on this surface) ---- */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`noviq-chevron ${open ? 'open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LogoIcon({ isArabic }: { isArabic: boolean }) {
  /* Admin-controlled (Site Content → Logo). It used to be a hardcoded
     setTimeout(2800): the wordmark always collapsed to the mark after two
     and a half seconds and nothing could change that — not the mode, not
     the timing, not whether it happened at all. */
  const [cfg, setCfg] = useState<LogoSettings>(LOGO_DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetchVisualSettings('logo', resolveLogo).then((next) => {
      if (!cancelled && next) setCfg(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Which slot renders where. Desktop and mobile are separate profiles and Arabic
     has its own of each — four independent contexts. CSS decides which element
     is visible (media query); language picks which profile fills it. */
  const prof = isArabic ? cfg.desktopAr : cfg.desktopEn;
  const mprof = isArabic ? cfg.mobileAr : cfg.mobileEn;

  /* Only `morph` collapses; `wordmark` and `icon` are fixed by definition. */
  const [isIcon, setIsIcon] = useState(prof.mode === 'icon');
  /* Which artwork is VISIBLE right now — not just which mode is selected.
     In `morph` the slot starts as the wordmark and becomes the mark when the
     timer fires. Sizing the slot from the mode alone froze it at the
     wordmark's size, so after the collapse the mark sat in the wordmark's box
     (and the old hardcoded 56px rule finished the job). The slot follows the
     visible artwork instead. */
  const shownH =
    prof.mode === 'wordmark'
      ? prof.wordmarkHeight
      : prof.mode === 'icon'
        ? prof.markHeight
        : isIcon
          ? prof.markHeight
          : prof.wordmarkHeight;
  useEffect(() => {
    if (prof.mode !== 'morph') {
      setIsIcon(prof.mode === 'icon');
      return;
    }
    const timer = setTimeout(() => setIsIcon(true), prof.morphAfterMs);
    return () => clearTimeout(timer);
  }, [prof.mode, prof.morphAfterMs]);

  return (
    <>
      {/* Desktop: the wordmark and the mark are stacked and cross-faded, so
          the morph is one continuous movement rather than a swap.

          The admin's numbers arrive as CSS CUSTOM PROPERTIES, not inline
          width/height. That is the whole trick: `object-position` can only
          place artwork inside a box LARGER than the artwork, so an inline
          `width: 'auto'` — which shrinks the element to exactly the image —
          silently disables alignment entirely. The slot therefore keeps the
          stylesheet's `inset: 0; object-fit: contain` and the two variables
          size the box; the `.is-icon` width the morph animates is untouched,
          because a custom property does not outrank it the way an inline
          width would. */}
      <span
        className={`noviq-logo-desktop noviq-logo-align-${prof.align} ${isIcon ? 'is-icon' : ''}`}
        style={
          {
            '--logo-slot-h': `${shownH}px`,
            '--logo-max-w': `${prof.maxWidth}px`,
            /* The collapsed box is the mark's own size. The mark art is
               square, so its width is its height — the admin's mark height,
               not 56. */
            '--logo-icon-w': `${prof.markHeight}px`,
            /* Physical nudge on the SLOT, not the images: translating an image
               inside its own letterbox clips it against the slot edge, while
               translating the slot moves the whole artwork. Positive is RIGHT
               in English and in Arabic. */
            '--logo-nudge': `${prof.offsetX}px`,
          } as React.CSSProperties
        }
      >
        {cfg.showWordmarkDesktop ? (
          <Image
            src={cfg.wordmarkSrc}
            alt={cfg.wordmarkAlt}
            width={180}
            height={40}
            className="noviq-logo-full"
            priority
            unoptimized
          />
        ) : null}
        <Image
          src={cfg.markSrc}
          alt={cfg.markAlt}
          width={56}
          height={40}
          className="noviq-logo-icon"
          priority
          unoptimized
        />
      </span>
      {/* Mobile: its own profile — variant, size and shift are the phone's
          own, independent of the laptop slot. Phones have no morph: the
          variant is final the moment it renders. */}
      {cfg.showMarkMobile ? (
        <Image
          src={mprof.mode === 'wordmark' ? cfg.wordmarkSrc : cfg.markSrc}
          alt={mprof.mode === 'wordmark' ? cfg.wordmarkAlt : cfg.markAlt}
          width={52}
          height={mprof.mode === 'wordmark' ? mprof.wordmarkHeight : mprof.markHeight}
          style={{
            height: mprof.mode === 'wordmark' ? mprof.wordmarkHeight : mprof.markHeight,
            width: 'auto',
            maxWidth: mprof.maxWidth,
            translate: `${mprof.offsetX}px 0`,
          }}
          className="noviq-logo-mobile-icon"
          priority
          unoptimized
        />
      ) : null}
    </>
  );
}

function ThemeToggleIcon({ dark }: { dark: boolean }) {
  /* Sun shown in dark mode (tap → light), moon in light mode.
     The crossfade + rotation is driven by CSS on the parent
     `.is-dark` / `.is-light` state — both glyphs stay mounted. */
  return (
    <span className="noviq-theme-glyphs" aria-hidden="true">
      <svg className="noviq-theme-glyph is-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <svg className="noviq-theme-glyph is-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

function UserIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}

function MenuIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
}

function XIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
