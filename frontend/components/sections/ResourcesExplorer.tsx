/* ============================================================
   NOVIQ — Knowledge Hub explorer (client-side filter + pins)
   ------------------------------------------------------------
   The server page fetches the CMS content once (ISR, 60s) and hands the
   whole published set to this component as props. Everything interactive
   then happens here, in the browser, with zero additional requests:

     · text search across title / excerpt / body / author / category
     · section chips (All + every published section)
     · category dropdown (union of every item's category)
     · sort: admin order (featured first) or A–Z by title
     · pin (تثبيت): pinned items collect in a strip above everything,
       persisted per visitor in localStorage (lib/resources-store.ts)
     · read receipts: opening a card marks its id seen, which drives the
       header unread badge for logged-in visitors

   HYDRATION CONTRACT
   First render — server AND client — is always the unfiltered view with
   no pins and nothing marked seen: localStorage is read only inside
   effects/subscriptions, never during render. Filtering is user-initiated,
   so it can never mismatch the prerender.

   WHEN FILTERS ARE IDLE the layout is byte-identical to the old static
   page (featured strip + per-section blocks), so the editorial design
   survives. Filtering switches to one flat grid with a real result count.
   ============================================================ */
'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BookOpen, FileText, Newspaper, Download, ExternalLink, ArrowRight,
  Archive, Tag, Award, Video, Podcast, GraduationCap, Microscope, Lightbulb,
  Rocket, TrendingUp, Calendar, Megaphone, Layers, Sparkles, Globe, Shield,
  BarChart, PieChart, Users, Mail, Wrench, Terminal, Code, Database,
  ShoppingCart, Briefcase, CreditCard, HeartPulse, Landmark, Factory,
  Search, Pin, PinOff, X,
} from 'lucide-react';
import type { ResourcesContent, ResourceItem, ResourceSection } from '@/lib/resources-content';
import { RichText } from '@/lib/rich-text';
import {
  RESOURCES_EVENT,
  getPinnedIds,
  togglePin as storeTogglePin,
  markSeen,
} from '@/lib/resources-store';

/* Tab ids are CMS-defined, so the icon is looked up by convention with a
   sensible default rather than assumed. */
const TAB_ICONS: Record<string, typeof BookOpen> = {
  news: Newspaper,
  blog: BookOpen,
  articles: BookOpen,
  whitepapers: FileText,
  guides: BookOpen,
  downloads: Download,
};

/* Every lucide icon the Knowledge Hub may be given from the admin, so a
   section icon chosen there actually renders here. */
const SECTION_ICONS: Record<string, typeof BookOpen> = {
  newspaper: Newspaper, book: BookOpen, 'book-open': BookOpen, file: FileText,
  'file-text': FileText, download: Download, archive: Archive, tag: Tag,
  award: Award, video: Video, podcast: Podcast, 'graduation-cap': GraduationCap,
  'microscope': Microscope, 'lightbulb': Lightbulb, 'rocket': Rocket,
  'trending-up': TrendingUp, calendar: Calendar, megaphone: Megaphone,
  'layers': Layers, sparkles: Sparkles, globe: Globe, shield: Shield,
  'bar-chart': BarChart, 'pie-chart': PieChart, users: Users, mail: Mail,
  wrench: Wrench, terminal: Terminal, code: Code, database: Database,
  'shopping-cart': ShoppingCart, 'briefcase': Briefcase, 'credit-card': CreditCard,
  'heart-pulse': HeartPulse, landmark: Landmark, factory: Factory,
};

/** Admin icon first, then the id convention, then a neutral default. */
function sectionIcon(section: { id: string; icon: string }) {
  return (section.icon && SECTION_ICONS[section.icon]) || TAB_ICONS[section.id] || BookOpen;
}

type SortMode = 'default' | 'az';

const STR = {
  en: {
    searchPh: 'Search articles, guides, news…',
    searchLabel: 'Search resources',
    allSections: 'All',
    allCategories: 'All categories',
    categoryLabel: 'Category',
    sortLabel: 'Sort',
    sortDefault: 'Featured first',
    sortAz: 'A–Z',
    results: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    noMatchTitle: 'No matches',
    noMatchBody: 'Try different keywords or clear the filters.',
    clearFilters: 'Clear filters',
    pinnedTitle: 'Pinned',
    featuredTitle: 'Featured',
    pin: 'Pin this item',
    unpin: 'Remove pin',
    readArticle: 'Read the article',
    viewArticle: 'View article',
    closeArticle: 'Close',
    download: 'Download',
    readMore: 'Read more',
  },
  ar: {
    searchPh: 'ابحث في المقالات والأدلة والأخبار…',
    searchLabel: 'البحث في الموارد',
    allSections: 'الكل',
    allCategories: 'كل التصنيفات',
    categoryLabel: 'التصنيف',
    sortLabel: 'الترتيب',
    sortDefault: 'المميز أولاً',
    sortAz: 'أبجدي',
    results: (n: number) => (n === 1 ? 'نتيجة واحدة' : `${n} من النتائج`),
    noMatchTitle: 'لا توجد نتائج',
    noMatchBody: 'جرّب كلمات مختلفة أو امسح الفلاتر.',
    clearFilters: 'مسح الفلاتر',
    pinnedTitle: 'مثبت',
    featuredTitle: 'موارد مميزة',
    pin: 'تثبيت العنصر',
    unpin: 'إلغاء التثبيت',
    readArticle: 'اقرأ المقال',
    viewArticle: 'عرض المقال',
    closeArticle: 'إغلاق',
    download: 'تحميل',
    readMore: 'اقرأ المزيد',
  },
} as const;

interface ExplorerProps {
  content: ResourcesContent;
  locale: string;
}

type CardItem = ResourceItem & { sectionLabel?: string };

export default function ResourcesExplorer({ content, locale }: ExplorerProps) {
  const isRTL = locale === 'ar';
  const t = isRTL ? STR.ar : STR.en;

  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortMode>('default');
  /* Pins + a generation counter. localStorage is read in the effect below,
     never during render — see the hydration contract above. */
  const [pins, setPins] = useState<string[]>([]);
  const [, setStoreGen] = useState(0);

  useEffect(() => {
    setPins(getPinnedIds());
    const refresh = () => {
      setPins(getPinnedIds());
      setStoreGen((g) => g + 1);
    };
    window.addEventListener(RESOURCES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(RESOURCES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const onTogglePin = (id: string) => setPins(storeTogglePin(id));

  /* Article popup: the card button below opens the full body in a modal
     instead of expanding inline — easier to read, and the read receipt
     fires on open exactly like the old expander did. Null = closed. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  /* Every published item, flat, with its section label attached. Featured
     items live outside the sections (the server already excluded them
     there), so the union below is de-duplicated by construction. */
  const allItems: CardItem[] = useMemo(() => {
    const seen = new Set<string>();
    const out: CardItem[] = [];
    const push = (item: ResourceItem, sectionLabel?: string) => {
      const key = `${item.section}:${item.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...item, sectionLabel });
    };
    for (const item of content.featured) push(item);
    for (const s of content.sections) {
      for (const item of s.items) push(item, s.label);
    }
    return out;
  }, [content]);

  const categories: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      if (item.category) set.add(item.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b, locale));
  }, [allItems, locale]);

  const filtersActive =
    query.trim() !== '' || section !== 'all' || category !== 'all' || sort !== 'default';

  const filtered: CardItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allItems.filter((item) => {
      if (section !== 'all' && item.section !== section) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (q) {
        const hay = `${item.title} ${item.excerpt} ${item.body} ${item.author} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'az') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, locale));
    }
    return list;
  }, [allItems, query, section, category, sort, locale]);

  const pinnedItems = useMemo(() => {
    if (!pins.length) return [];
    const byId = new Map(allItems.map((i) => [`${i.section}:${i.id}`, i]));
    /* A pin whose item was unpublished simply vanishes — never an error. */
    return pins
      .map((id) => byId.get(id) ?? allItems.find((i) => i.id === id))
      .filter((i): i is CardItem => !!i);
  }, [pins, allItems]);

  const clearAll = () => {
    setQuery('');
    setSection('all');
    setCategory('all');
    setSort('default');
  };

  const openArticle = (item: CardItem) => {
    markSeen(item.id);
    setOpenKey(`${item.section}:${item.id}`);
  };
  const opened: CardItem | null =
    openKey === null
      ? null
      : (allItems.find((i) => `${i.section}:${i.id}` === openKey) ?? null);

  const card = (item: CardItem, showSection = false) => {
    const href = item.link || item.file;
    const Tag = href ? 'a' : 'div';
    const pinned = pins.includes(item.id) || pins.includes(`${item.section}:${item.id}`);
    return (
      /* Relative wrapper: the pin toggle is a sibling of the card link, never
         a <button> inside an <a> — nested interactives are invalid HTML and
         confuse screen readers. */
      <div key={`${item.section}:${item.id}`} className="relative">
        <Tag
          {...(href
            ? { href, ...(item.link ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
            : {})}
          onClick={() => markSeen(item.id)}
          className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {item.image ? (
            /* Plain <img>, not next/image: these paths come from the CMS at
               build time and are not in the static import manifest. */
            // eslint-disable-next-line @next/next/no-img-element
            <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img
                src={item.image}
                alt=""
                width={400}
                height={225}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}

          <div className="flex grow flex-col p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {item.category ? (
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {item.category}
                </span>
              ) : null}
              {showSection && item.sectionLabel ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.sectionLabel}</span>
              ) : null}
            </div>

            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              {item.title}
            </h3>
            {item.excerpt ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.excerpt}</p>
            ) : null}

            {/* The admin writes a full article body. When the item has no
                external link or file to send the visitor to, that body is the
                ONLY place it can be read — so a View button with an arrow
                opens it in a popup window (see the Dialog below) instead of
                an inline expander. */}
            {!href && item.body ? (
              <button
                type="button"
                onClick={() => openArticle(item)}
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {t.viewArticle}
                <ArrowRight
                  className="h-4 w-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </button>
            ) : null}

            {/* date / author are editable in the admin, so they are shown here. */}
            {item.date || item.author ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {item.date ? (
                  <time dateTime={item.date}>{item.date}</time>
                ) : null}
                {item.date && item.author ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                {item.author ? <span>{item.author}</span> : null}
              </p>
            ) : null}

            {href ? (
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {item.file ? t.download : t.readMore}
                {item.file ? (
                  <Download className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
            ) : null}
          </div>
        </Tag>

        <button
          type="button"
          onClick={() => onTogglePin(item.id)}
          aria-pressed={pinned}
          aria-label={pinned ? t.unpin : t.pin}
          title={pinned ? t.unpin : t.pin}
          className={`absolute end-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            pinned
              ? 'border-primary bg-primary text-white'
              : 'border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 hover:text-primary hover:border-primary'
          }`}
        >
          {pinned ? (
            <PinOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Pin className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      {/* ------------ filter bar ------------ */}
      <div className="mb-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{t.searchLabel}</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPh}
              aria-label={t.searchLabel}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pe-4 ps-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 items-center gap-2 md:flex-none">
              <span className="sr-only">{t.categoryLabel}</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t.categoryLabel}
                className="min-h-[44px] flex-1 md:flex-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none"
              >
                <option value="all">{t.allCategories}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-1 items-center gap-2 md:flex-none">
              <span className="sr-only">{t.sortLabel}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                aria-label={t.sortLabel}
                className="min-h-[44px] flex-1 md:flex-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:outline-none"
              >
                <option value="default">{t.sortDefault}</option>
                <option value="az">{t.sortAz}</option>
              </select>
            </label>
          </div>
        </div>

        {content.sections.length > 1 ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label={isRTL ? 'أقسام الموارد' : 'Resource sections'}
          >
            {[{ id: 'all', label: t.allSections }, ...content.sections.map((s) => ({ id: s.id, label: s.label }))].map(
              (s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  aria-pressed={section === s.id}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    section === s.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary'
                  }`}
                >
                  {s.label}
                </button>
              )
            )}
          </div>
        ) : null}
      </div>

      {/* ------------ pinned strip ------------ */}
      {pinnedItems.length > 0 ? (
        <div className="mb-16">
          <h2 className="mb-6 flex items-center gap-2 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
            <Pin className="h-5 w-5 text-primary" aria-hidden="true" />
            {t.pinnedTitle}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              {pinnedItems.length}
            </span>
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {pinnedItems.map((item) => card(item, true))}
          </div>
        </div>
      ) : null}

      {/* ------------ filtered results ------------ */}
      {filtersActive ? (
        <div>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400" role="status">
            {t.results(filtered.length)}
            {(query.trim() || category !== 'all') && (
              <button
                type="button"
                onClick={clearAll}
                className="ms-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t.clearFilters}
              </button>
            )}
          </p>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {t.noMatchTitle}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">
                {t.noMatchBody}
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-6 py-3 font-medium text-white"
              >
                {t.clearFilters}
              </button>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => card(item, true))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ------------ featured (idle layout, unchanged) ------------ */}
          {content.featured.length > 0 ? (
            <div className="mb-20">
              <h2 className="mb-8 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                {t.featuredTitle}
              </h2>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {content.featured.map((item) => card(item))}
              </div>
            </div>
          ) : null}

          {/* ------------ every section, admin order ------------ */}
          {content.sections.map((section: ResourceSection) => {
            const Icon = sectionIcon(section);
            return (
              <div key={section.id} id={section.id} className="mb-20 scroll-mt-28 last:mb-0">
                <div className="mb-8 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {section.label}
                  </h2>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {section.items.length}
                  </span>
                </div>

                {section.items.length === 0 ? null : (
                  <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((item) => card(item))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ------------ article popup window ------------
          Radix Dialog: overlay click + Escape close, focus trapped inside,
          background scroll locked — the easy reading window. dir follows
          the page so Arabic bodies align right. */}
      <Dialog.Root
        open={opened !== null}
        onOpenChange={(v) => {
          if (!v) setOpenKey(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            dir={isRTL ? 'rtl' : 'ltr'}
            className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl focus:outline-none sm:p-8"
          >
            {opened ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    {opened.category ? (
                      <span className="mb-2 inline-block rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {opened.category}
                      </span>
                    ) : null}
                    <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                      {opened.title}
                    </Dialog.Title>
                    {opened.date || opened.author ? (
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {[opened.date, opened.author].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label={t.closeArticle}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                {opened.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opened.image}
                    alt=""
                    className="mb-5 max-h-72 w-full rounded-2xl object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <RichText
                  text={opened.body}
                  className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]"
                />
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
