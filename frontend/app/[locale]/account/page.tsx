/* ============================================================
   NOVIQ Frontend — Client Account Page
   ------------------------------------------------------------
   This used to be a static server component that ALWAYS rendered
   "Sign in to access…" — even right after a successful login, because a
   server component cannot read the localStorage session and nothing ever
   checked it. The session existed; the page never knew.

   It is now a client component on useAuth() (lib/auth.tsx, the single
   session source): signed-in visitors get their dashboard (identity,
   session status, live project list with progress), everyone else gets
   the exact same marketing content as before.
   ============================================================ */
'use client';

import Link from 'next/link';
import ContactCta from '@/components/contact/ContactCta';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Headset,
  LogOut,
  Loader2,
  Camera,
  Pencil,
  Trash2,
  Bell,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api-client';

interface DashboardMilestone {
  id: number | string;
  title: string;
  description?: string;
  progress: number;
  status: string;
  dueDate?: string;
}

interface DashboardProject {
  id: number | string;
  name: string;
  summary?: string;
  status: string;
  progress: number;
  targetDate?: string;
  milestones?: DashboardMilestone[];
}

interface DashboardContract {
  id: number | string;
  projectId?: number | string | null;
  projectName?: string;
  title: string;
  reference?: string;
  value?: string;
  currency?: string;
  status: string;
  signedAt?: string;
  startsOn?: string;
  endsOn?: string;
  notes?: string;
  file?: string;
}

interface DashboardNotification {
  id: number | string;
  type: string;
  title: string;
  body?: string;
  createdAt?: string;
  read: boolean;
  scope: string;
}

interface DashboardMessage {
  id: number | string;
  sender: string;
  body: string;
  read: boolean;
  createdAt?: string;
}

interface DashboardRequest {
  id: number | string;
  title: string;
  category: string;
  budget?: string;
  timeline?: string;
  description?: string;
  status: string;
  adminNote?: string;
  createdAt?: string;
}

const COPY = {
  en: {
    dashTitle: 'My dashboard',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    projects: 'Projects',
    contracts: 'Contracts',
    unread: 'Unread updates',
    noProjects: 'No projects yet.',
    noProjectsHint: 'When the team attaches work to your account it appears here automatically.',
    contactCta: 'Message the team',
    viewAll: 'Full site',
    loading: 'Checking your session…',
    steps: 'Delivery steps',
    showSteps: 'Show steps',
    hideSteps: 'Hide steps',
    dueBy: 'Due',
    contractsTitle: 'Contracts',
    noContracts: 'No contracts yet.',
    noContractsHint: 'When the team attaches a contract it appears here with its value and dates.',
    updatesTitle: 'Latest updates',
    noUpdates: 'No updates yet.',
    markRead: 'Mark read',
    markAllRead: 'Mark all read',
    showAll: 'All',
    showUnread: 'Unread',
    noUnread: 'All caught up — nothing unread.',
    justNow: 'just now',
    showMore: 'Show more',
    showLess: 'Show less',
    messageTitle: 'Message the team',
    messageHint: 'Replies from the team appear under Latest updates.',
    messagePlaceholder: 'Write your message…',
    messageSend: 'Send message',
    messageSending: 'Sending…',
    messageSent: 'Message sent — the team will reply here.',
    messageError: 'Could not send. Please try again.',
    conversationTitle: 'Conversation with the team',
    conversationHint: 'Everything you write here is read and answered in the admin dashboard.',
    noMessages: 'No messages yet — say hello below.',
    typeReply: 'Write a reply…',
    editProfile: 'Edit profile',
    saveProfile: 'Save changes',
    cancelEdit: 'Cancel',
    firstNameLabel: 'First name',
    lastNameLabel: 'Last name',
    phoneLabel: 'Phone',
    phonePlaceholder: '+20…',
    profileSaved: 'Profile updated.',
    profileError: 'Could not save. Please try again.',
    notProvided: 'Not provided',
    changePhoto: 'Change photo',
    uploadingPhoto: 'Uploading…',
    removePhoto: 'Remove',
    photoTooBig: 'Photo too large (max 2MB).',
    photoError: 'Could not upload. Use PNG, JPG, WebP or GIF.',
    requestsTitle: 'Request a project',
    requestsHint: 'Tell us what you need with the presets below — the team reviews and activates it here.',
    requestTitleLabel: 'Project title',
    requestTitlePlaceholder: 'e.g. Mobile app for field sales',
    requestCategoryLabel: 'Category',
    requestBudgetLabel: 'Budget',
    requestBudgetAny: 'To be discussed',
    requestTimelineLabel: 'Timeline',
    requestTimelineAny: 'Flexible',
    requestDescLabel: 'Details',
    requestDescPlaceholder: 'What should it do? Who is it for?',
    requestSend: 'Send request',
    requestSending: 'Sending…',
    requestSent: 'Request sent — track its status below.',
    requestError: 'Could not send. Please try again.',
    myRequests: 'My requests',
    noRequests: 'No requests yet.',
    reqPrev: 'Older requests',
    reqNext: 'Newer requests',
    reqLoading: 'Loading requests…',
    reqEmpty: 'No requests yet.',
    reqEmptySub: 'Ready to start? Jump in — we’ll reach back within 24h.',
    reqShowAll: 'Show all',
    reqShowLess: 'Show fewer',
  },
  ar: {
    dashTitle: 'لوحتي',
    signedInAs: 'مسجّل الدخول باسم',
    signOut: 'تسجيل الخروج',
    projects: 'المشاريع',
    contracts: 'العقود',
    unread: 'تحديثات غير مقروءة',
    noProjects: 'لا توجد مشاريع بعد.',
    noProjectsHint: 'عندما يربط الفريق عملاً بحسابك سيظهر هنا تلقائياً.',
    contactCta: 'راسل الفريق',
    viewAll: 'الموقع الكامل',
    loading: 'جارٍ التحقق من الجلسة…',
    steps: 'خطوات التسليم',
    showSteps: 'عرض الخطوات',
    hideSteps: 'إخفاء الخطوات',
    dueBy: 'الموعد',
    contractsTitle: 'العقود',
    noContracts: 'لا توجد عقود بعد.',
    noContractsHint: 'عندما يرفق الفريق عقداً سيظهر هنا بقيمته وتواريخه.',
    updatesTitle: 'آخر التحديثات',
    noUpdates: 'لا توجد تحديثات بعد.',
    markRead: 'تعيين كمقروء',
    markAllRead: 'تعيين الكل كمقروء',
    showAll: 'الكل',
    showUnread: 'غير المقروء',
    noUnread: 'كل شيء مقروء — لا جديد.',
    justNow: 'الآن',
    showMore: 'عرض المزيد',
    showLess: 'عرض أقل',
    messageTitle: 'راسل الفريق',
    messageHint: 'ردود الفريق تظهر تحت آخر التحديثات.',
    messagePlaceholder: 'اكتب رسالتك…',
    messageSend: 'إرسال الرسالة',
    messageSending: 'جارٍ الإرسال…',
    messageSent: 'تم إرسال الرسالة — سيرد الفريق هنا.',
    messageError: 'تعذر الإرسال. حاول مجدداً.',
    conversationTitle: 'المحادثة مع الفريق',
    conversationHint: 'كل ما تكتبه هنا يُقرأ ويُجاب عليه من لوحة التحكم.',
    noMessages: 'لا رسائل بعد — ابدأ بالتحية بالأسفل.',
    typeReply: 'اكتب رداً…',
    editProfile: 'تعديل البيانات',
    saveProfile: 'حفظ التعديلات',
    cancelEdit: 'إلغاء',
    firstNameLabel: 'الاسم الأول',
    lastNameLabel: 'اسم العائلة',
    phoneLabel: 'الهاتف',
    phonePlaceholder: '+20…',
    profileSaved: 'تم تحديث البيانات.',
    profileError: 'تعذر الحفظ. حاول مجدداً.',
    notProvided: 'غير مسجل',
    changePhoto: 'تغيير الصورة',
    uploadingPhoto: 'جارٍ الرفع…',
    removePhoto: 'إزالة',
    photoTooBig: 'الصورة كبيرة (الحد 2MB).',
    photoError: 'تعذر الرفع. استخدم PNG أو JPG أو WebP أو GIF.',
    requestsTitle: 'طلب مشروع',
    requestsHint: 'أخبرنا بما تحتاجه من الخيارات الجاهزة — يراجعها الفريق ويفعّلها هنا.',
    requestTitleLabel: 'عنوان المشروع',
    requestTitlePlaceholder: 'مثال: تطبيق موبايل لمناديب المبيعات',
    requestCategoryLabel: 'الفئة',
    requestBudgetLabel: 'الميزانية',
    requestBudgetAny: 'للنقاش',
    requestTimelineLabel: 'المدة',
    requestTimelineAny: 'مرنة',
    requestDescLabel: 'التفاصيل',
    requestDescPlaceholder: 'ماذا يجب أن يفعل؟ ولمن؟',
    requestSend: 'إرسال الطلب',
    requestSending: 'جارٍ الإرسال…',
    requestSent: 'تم إرسال الطلب — تابع حالته بالأسفل.',
    requestError: 'تعذر الإرسال. حاول مجدداً.',
    myRequests: 'طلباتي',
    noRequests: 'لا توجد طلبات بعد.',
    reqPrev: 'طلبات أحدث',
    reqNext: 'طلبات أقدم',
    reqLoading: 'جارٍ تحميل الطلبات…',
    reqEmpty: 'لا توجد طلبات بعد.',
    reqEmptySub: 'مستعد للبدء؟ أرسل طلبك وسنرد خلال 24 ساعة.',
    reqShowAll: 'إظهار الكل',
    reqShowLess: 'إظهار أقل',
  },
} as const;

const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  planning: { en: 'Planning', ar: 'تخطيط' },
  active: { en: 'Active', ar: 'نشط' },
  'on-hold': { en: 'On hold', ar: 'متوقف مؤقتاً' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
};

/* Preset request data: fixed option lists so a client files a structured
   activation request in seconds instead of composing a blank message. */
const REQUEST_CATEGORIES = [
  { id: 'website', en: 'Website', ar: 'موقع' },
  { id: 'mobile-app', en: 'Mobile App', ar: 'تطبيق موبايل' },
  { id: 'ecommerce', en: 'E-commerce', ar: 'متجر إلكتروني' },
  { id: 'erp-crm', en: 'ERP / CRM', ar: 'ERP / CRM' },
  { id: 'ai-solution', en: 'AI Solution', ar: 'حل ذكاء اصطناعي' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
];
const REQUEST_BUDGETS = ['$1k–$5k', '$5k–$10k', '$10k–$25k', '$25k+'];
const REQUEST_TIMELINES = [
  { en: 'ASAP', ar: 'فوري' },
  { en: '1–3 months', ar: '1–3 أشهر' },
  { en: '3–6 months', ar: '3–6 أشهر' },
  { en: '6–12 months', ar: '6–12 أشهر' },
];
const REQUEST_STATUS_STYLE: Record<string, string> = {
  new: 'bg-primary/10 text-primary',
  reviewed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

/* Update-feed type pills: one glance tells project news from contract
   moves from direct messages. Colors reuse the dashboard palette. */
const NOTIF_TYPE_META: Record<string, { en: string; ar: string; classes: string }> = {
  project: { en: 'Project', ar: 'مشروع', classes: 'bg-primary/10 text-primary' },
  contract: { en: 'Contract', ar: 'عقد', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  message: { en: 'Message', ar: 'رسالة', classes: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  news: { en: 'News', ar: 'خبر', classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
};

/* Relative timestamps ("3h ago" / "منذ 3 ساعات"): absolute dates force
   mental math, relative ones answer "how fresh" instantly. Falls back to
   the calendar date past 30 days or when unparsable. */
function timeAgo(iso: string | undefined, isArabic: boolean, justNow: string): string {
  if (!iso) return '';
  const then = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return justNow;
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return isArabic ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(then).toLocaleDateString(isArabic ? 'ar' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isArabic = locale === 'ar';
  const t = isArabic ? COPY.ar : COPY.en;
  const router = useRouter();
  const { user, unread, counts, loading, isLoggedIn, logout, refresh } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<DashboardProject[] | null>(null);
  const [contracts, setContracts] = useState<DashboardContract[] | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotification[] | null>(null);
  const [openId, setOpenId] = useState<string | number | null>(null);
  const [message, setMessage] = useState('');
  const [msgState, setMsgState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  /* Two-way thread with the team (admin Client Projects ⇄ this card). */
  const [thread, setThread] = useState<DashboardMessage[] | null>(null);
  const [chatSending, setChatSending] = useState(false);
  /* Editable profile (name + phone; email is the immutable identity). */
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<'idle' | 'saved' | 'error'>('idle');
  /* Update-feed controls: All/Unread filter + one-click clear + paging.
     The feed can hold dozens of rows; showing 5 with "more" keeps the
     dashboard scannable without hiding anything. */
  const [updatesFilter, setUpdatesFilter] = useState<'all' | 'unread'>('all');
  const [updatesShown, setUpdatesShown] = useState(5);
  /* Activation requests: structured form + own list with live status. */
  const [requests, setRequests] = useState<DashboardRequest[] | null>(null);
  /* Request pager: six cards per page with ‹ › arrows. Newest first (the API
     returns newest first), so "previous" walks toward newer pages. A fresh
     fetch resets to page one — landing on an empty last page after sending a
     request would look like the request vanished. */
  const REQ_PAGE_SIZE = 6;
  const REQ_EXPANDED_SIZE = 100;
  const [reqExpanded, setReqExpanded] = useState(false);
  const [reqPage, setReqPage] = useState(0);
  const [reqForm, setReqForm] = useState({ title: '', category: 'website', budget: '', timeline: '', description: '' });
  const [reqState, setReqState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  /* Avatar upload state. */
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<'idle' | 'error' | 'toobig'>('idle');

  /* The redirect from login/signup lands here; re-validate so the header
     and the page agree even though App Router kept the layout mounted. */
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isLoggedIn) {
      setProjects(null);
      setContracts(null);
      setNotifications(null);
      setThread(null);
      setRequests(null);
      return;
    }
    let cancelled = false;
    /* Projects carry their milestone steps inline; contracts and the update
       feed are separate reads. Each fails soft independently — one slow
       endpoint must never blank the whole dashboard. */
    api.portal
      .projects()
      .then((d) => {
        if (!cancelled) setProjects(Array.isArray(d.projects) ? d.projects : []);
      })
      .catch(() => {
        /* A failed list must not blank the dashboard: counts from /portal/me
           (already validated) still render. */
        if (!cancelled) setProjects([]);
      });
    api.portal
      .contracts()
      .then((d) => {
        if (!cancelled) setContracts(Array.isArray(d.contracts) ? d.contracts : []);
      })
      .catch(() => {
        if (!cancelled) setContracts([]);
      });
    api.portal
      .notifications()
      .then((d) => {
        if (!cancelled) setNotifications(Array.isArray(d.notifications) ? d.notifications : []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });
    /* The conversation thread. Opening it marks the team's rows read
       server-side, which is what clears the unread badge. */
    api.portal
      .messages()
      .then((d) => {
        if (!cancelled) setThread(Array.isArray(d.messages) ? d.messages : []);
      })
      .catch(() => {
        if (!cancelled) setThread([]);
      });
    api.portal
      .requests()
      .then((d) => {
        if (!cancelled) setRequests(Array.isArray(d.requests) ? d.requests : []);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const markRead = (id: number | string) => {
    api.portal
      .markNotificationRead(id)
      .then(() => {
        setNotifications((prev) =>
          prev ? prev.map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n)) : prev
        );
        refresh();
      })
      .catch(() => {});
  };

  const markAllRead = () => {
    api.portal
      .markAllNotificationsRead()
      .then(() => {
        setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev));
        refresh();
      })
      .catch(() => {});
  };

  const sendMessage = () => {
    const text = message.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    setMsgState('sending');
    /* The thread is the composer now: one write path, read by the team in
       admin Client Projects → Conversations. */
    api.portal
      .sendChatMessage(text)
      .then(() => {
        setMsgState('sent');
        setMessage('');
        return api.portal.messages();
      })
      .then((d) => {
        setThread(Array.isArray(d.messages) ? d.messages : []);
        refresh();
      })
      .catch(() => setMsgState('error'))
      .finally(() => setChatSending(false));
  };

  const sendRequest = () => {
    if (!reqForm.title.trim() || reqState === 'sending') return;
    setReqState('sending');
    api.portal
      .createRequest({
        title: reqForm.title.trim(),
        category: reqForm.category,
        budget: reqForm.budget,
        timeline: reqForm.timeline,
        description: reqForm.description.trim(),
      })
      .then(() => {
        setReqState('sent');
        setReqForm({ title: '', category: 'website', budget: '', timeline: '', description: '' });
        return api.portal.requests();
      })
      .then((d) => {
        setRequests(Array.isArray(d.requests) ? d.requests : []);
        /* The new request lands on page one (newest first) — jump there so
           the sender sees it instead of the old page. */
        setReqPage(0);
      })
      .catch(() => setReqState('error'));
  };

  const onAvatarFile = (file: File | undefined) => {
    if (!file || avatarBusy) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg('toobig');
      return;
    }
    setAvatarBusy(true);
    setAvatarMsg('idle');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      api.portal
        .uploadAvatar(dataUrl, file.name)
        .then(() => refresh())
        .catch(() => setAvatarMsg('error'))
        .finally(() => setAvatarBusy(false));
    };
    reader.onerror = () => {
      setAvatarMsg('error');
      setAvatarBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    api.portal
      .deleteAvatar()
      .then(() => refresh())
      .catch(() => setAvatarMsg('error'))
      .finally(() => setAvatarBusy(false));
  };

  const startProfileEdit = () => {
    setProfileForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    });
    setProfileMsg('idle');
    setEditingProfile(true);
  };

  const saveProfile = () => {
    if (!profileForm.firstName.trim() || profileSaving) return;
    setProfileSaving(true);
    setProfileMsg('idle');
    api.portal
      .updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phone: profileForm.phone.trim(),
      })
      .then(() => {
        setProfileMsg('saved');
        setEditingProfile(false);
        refresh();
      })
      .catch(() => setProfileMsg('error'))
      .finally(() => setProfileSaving(false));
  };

  const signOut = () => {
    logout();
    router.push(`/${locale}`);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <p className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {t.loading}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return <LoggedOutMarketing locale={locale} isArabic={isArabic} />;
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email ||
    (isArabic ? 'حسابي' : 'My account');
  const initial = (displayName.trim().charAt(0) || (isArabic ? 'ح' : 'A')).toUpperCase();
  /* Pager window, clamped: a shrinking list (or a refetch) can never strand
     the view on an empty page past the end. */
  const reqTotalPages = Math.max(1, Math.ceil((requests?.length || 0) / REQ_PAGE_SIZE));
  const reqPageSafe = Math.min(reqPage, reqTotalPages - 1);
  const reqSlice = reqExpanded ? (requests || []) : (requests || []).slice(reqPageSafe * REQ_PAGE_SIZE, reqPageSafe * REQ_PAGE_SIZE + REQ_PAGE_SIZE);

  return (
    <div className="min-h-screen">
      {/* Dashboard hero header: elegant, modern SaaS header that harmonizes with both light & dark themes */}
      <div className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-white dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950 py-10 md:py-12">
        {/* Soft atmospheric gradient lighting */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -end-24 h-72 w-72 rounded-full bg-primary/10 dark:bg-primary/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 start-1/4 h-72 w-72 rounded-full bg-accent/10 dark:bg-accent/15 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* User Identity Info */}
            <div className="flex items-center gap-4 sm:gap-5">
              <span className="relative shrink-0" aria-hidden="true">
                {user.avatar ? (
                  <img
                    src={`/${user.avatar}`}
                    alt=""
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover ring-2 ring-primary/20 dark:ring-primary/40 shadow-sm"
                  />
                ) : (
                  <span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-accent text-xl sm:text-2xl font-bold text-white shadow-md ring-2 ring-primary/20">
                    {initial}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {displayName}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                    <span className="truncate">{user.email}</span>
                  </span>
                  {user.phone ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300" dir="ltr">
                      <Phone size={11} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                      {user.phone}
                    </span>
                  ) : null}
                </div>
                {profileMsg === 'saved' && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t.profileSaved}</p>
                )}
                {profileMsg === 'error' && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{t.profileError}</p>
                )}
                {avatarMsg === 'toobig' && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{t.photoTooBig}</p>
                )}
                {avatarMsg === 'error' && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{t.photoError}</p>
                )}
              </div>
            </div>

            {/* Profile Action Buttons: polished, responsive, and clearly styled */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  onAvatarFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                title={t.changePhoto}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-all duration-200 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-60"
              >
                {avatarBusy ? (
                  <Loader2 size={13} aria-hidden="true" className="animate-spin" />
                ) : (
                  <Camera size={13} aria-hidden="true" />
                )}
                <span>{avatarBusy ? t.uploadingPhoto : t.changePhoto}</span>
              </button>
              {user.avatar ? (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={avatarBusy}
                  title={t.removePhoto}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/30 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-300 dark:hover:border-red-800 active:scale-[0.98] disabled:opacity-60"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>{t.removePhoto}</span>
                </button>
              ) : null}
              {!editingProfile ? (
                <button
                  type="button"
                  onClick={startProfileEdit}
                  title={t.editProfile}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]"
                >
                  <Pencil size={13} aria-hidden="true" />
                  <span>{t.editProfile}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={signOut}
                title={t.signOut}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition-all duration-200 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50/60 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 active:scale-[0.98]"
              >
                <span aria-hidden="true" style={isArabic ? { transform: 'scaleX(-1)' } : undefined} className="inline-flex">
                  <LogOut size={13} aria-hidden="true" />
                </span>
                <span>{t.signOut}</span>
              </button>
            </div>
          </div>

          {editingProfile && (
            <div className="mt-6 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/95 p-5 sm:p-6 shadow-sm">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="profile-first" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t.firstNameLabel}
                  </label>
                  <input
                    id="profile-first"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                    maxLength={80}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-900/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="profile-last" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t.lastNameLabel}
                  </label>
                  <input
                    id="profile-last"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                    maxLength={80}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-900/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="profile-phone" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t.phoneLabel}
                  </label>
                  <input
                    id="profile-phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    maxLength={40}
                    dir="ltr"
                    placeholder={t.phonePlaceholder}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-900/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={!profileForm.firstName.trim() || profileSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-sm shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {profileSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {t.saveProfile}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                >
                  {t.cancelEdit}
                </button>
              </div>
            </div>
          )}

          {/* At-a-glance stats: modern luxury metric cards */}
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl">
            {[
              {
                label: t.projects,
                value: counts.projects,
                icon: <LayoutDashboard size={18} aria-hidden="true" />,
                chip: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light',
                border: 'hover:border-primary/40',
              },
              {
                label: t.contracts,
                value: counts.contracts,
                icon: <CreditCard size={18} aria-hidden="true" />,
                chip: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
                border: 'hover:border-emerald-500/40',
              },
              {
                label: t.unread,
                value: unread,
                icon: <Bell size={18} aria-hidden="true" />,
                chip: unread > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                border: 'hover:border-amber-500/40',
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-800/80 p-4 sm:p-5 text-center shadow-xs backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:shadow-none ${s.border}`}
              >
                <span className={`mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl ${s.chip}`}>
                  {s.icon}
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-medium leading-tight text-slate-500 dark:text-slate-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.projects}</h2>
            {projects !== null && projects.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                {projects.length}
              </span>
            )}
          </div>
          {projects === null ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              {t.loading}
            </p>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
              <p className="font-medium text-slate-900 dark:text-white">{t.noProjects}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.noProjectsHint}</p>
              <ContactCta locale={locale} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                {t.contactCta}
              </ContactCta>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {projects.map((p) => {
                const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
                const status = STATUS_LABEL[p.status] || { en: p.status, ar: p.status };
                const steps = Array.isArray(p.milestones) ? p.milestones : [];
                const doneSteps = steps.filter((m) => m.status === 'done').length;
                const isOpen = openId !== null && String(openId) === String(p.id);
                const projectContracts = (contracts || []).filter(
                  (c) => c.projectId !== null && c.projectId !== undefined && String(c.projectId) === String(p.id)
                );
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 transition-colors duration-300 hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-900 dark:text-white break-words">
                        {p.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {isArabic ? status.ar : status.en}
                      </span>
                    </div>
                    {p.summary ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {p.summary}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        <span>{pct}%</span>
                        {p.targetDate ? <span>{p.targetDate}</span> : null}
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={p.name}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {/* Delivery steps + linked contracts live inside the card:
                       the admin moves them at Client Projects and the client
                       reads the same steps here — the visible link. */}
                    {(steps.length > 0 || projectContracts.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : p.id)}
                        aria-expanded={isOpen}
                        className="mt-4 text-sm font-medium text-primary hover:underline"
                      >
                        {isOpen ? t.hideSteps : t.showSteps} ({steps.length})
                      </button>
                    )}
                    {isOpen && (
                      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                          {t.steps} · {doneSteps}/{steps.length}
                        </p>
                        <ol className="relative space-y-4 border-s-2 border-slate-100 dark:border-slate-800 ps-4">
                          {steps.map((m) => {
                            const mpct = Math.max(0, Math.min(100, Number(m.progress) || 0));
                            const dot =
                              m.status === 'done'
                                ? 'bg-emerald-500'
                                : m.status === 'blocked'
                                  ? 'bg-red-500'
                                  : mpct > 0
                                    ? 'bg-primary'
                                    : 'bg-slate-300 dark:bg-slate-600';
                            return (
                              <li key={m.id}>
                                <span className={`absolute -start-[7px] mt-1 h-3 w-3 rounded-full ${dot}`} aria-hidden="true" />
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{m.title}</p>
                                {m.description ? (
                                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
                                ) : null}
                                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>{mpct}%</span>
                                  {m.dueDate ? (
                                    <span>
                                      {t.dueBy} {m.dueDate}
                                    </span>
                                  ) : null}
                                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">{m.status}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                        {projectContracts.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {projectContracts.map((c) => (
                              <div
                                key={c.id}
                                className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                              >
                                <span className="font-semibold text-slate-900 dark:text-white">{c.title}</span>
                                {c.reference ? <span className="ms-2 font-mono">{c.reference}</span> : null}
                                <span className="ms-2">
                                  {c.currency} {c.value}
                                </span>
                                <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                  {c.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Structured contracts: value, reference, dates and terms. */}
      <section className="pb-10 md:pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.contractsTitle}</h2>
            {contracts !== null && contracts.length > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {contracts.length}
              </span>
            )}
          </div>
          {contracts === null ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              {t.loading}
            </p>
          ) : contracts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
              <p className="font-medium text-slate-900 dark:text-white">{t.noContracts}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.noContractsHint}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {contracts.map((c) => (
                <article
                  key={c.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 transition-colors duration-300 hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white break-words">{c.title}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {c.status}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    {c.reference ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400 font-mono text-xs pt-0.5">REF</dt>
                        <dd className="text-slate-900 dark:text-white font-mono text-xs pt-0.5">{c.reference}</dd>
                      </div>
                    ) : null}
                    {c.value ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400 text-xs pt-0.5">
                          {isArabic ? 'القيمة' : 'Value'}
                        </dt>
                        <dd className="font-bold text-slate-900 dark:text-white">
                          {c.currency} {c.value}
                        </dd>
                      </div>
                    ) : null}
                    {c.projectName ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400 text-xs pt-0.5">
                          {isArabic ? 'المشروع' : 'Project'}
                        </dt>
                        <dd className="text-slate-700 dark:text-slate-300">{c.projectName}</dd>
                      </div>
                    ) : null}
                    {c.signedAt || c.startsOn || c.endsOn ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400 text-xs pt-0.5">
                          {isArabic ? 'المدة' : 'Term'}
                        </dt>
                        <dd className="text-slate-700 dark:text-slate-300 text-xs pt-0.5">
                          {[c.signedAt && `${isArabic ? 'وقّع' : 'Signed'} ${c.signedAt}`, c.startsOn, c.endsOn]
                            .filter(Boolean)
                            .join(' · ')}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {c.notes ? (
                    <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                      {c.notes}
                    </p>
                  ) : null}
                  {c.file ? (
                    <a
                      href={`/${c.file}`}
                      target="_blank"
                      rel="noopener"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {isArabic ? 'عرض المرفق' : 'View attached document'}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Project activation requests: structured preset form + live status.
          The admin triages in Client Projects; approval/rejection notifies. */}
      <section id="project-requests" className="pb-10 md:pb-14 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.requestsTitle}</h2>
            {requests !== null && requests.length > 0 && (
              <span className="rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {requests.length}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.requestsHint}</p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="req-title" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.requestTitleLabel}
                  </label>
                  <input
                    id="req-title"
                    value={reqForm.title}
                    onChange={(e) => {
                      setReqForm((f) => ({ ...f, title: e.target.value }));
                      if (reqState !== 'idle' && reqState !== 'sending') setReqState('idle');
                    }}
                    maxLength={160}
                    placeholder={t.requestTitlePlaceholder}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="req-cat" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.requestCategoryLabel}
                  </label>
                  <select
                    id="req-cat"
                    value={reqForm.category}
                    onChange={(e) => setReqForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {REQUEST_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isArabic ? c.ar : c.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="req-budget" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.requestBudgetLabel}
                  </label>
                  <select
                    id="req-budget"
                    value={reqForm.budget}
                    onChange={(e) => setReqForm((f) => ({ ...f, budget: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">{t.requestBudgetAny}</option>
                    {REQUEST_BUDGETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="req-timeline" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.requestTimelineLabel}
                  </label>
                  <select
                    id="req-timeline"
                    value={reqForm.timeline}
                    onChange={(e) => setReqForm((f) => ({ ...f, timeline: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">{t.requestTimelineAny}</option>
                    {REQUEST_TIMELINES.map((x) => (
                      <option key={x.en} value={x.en}>
                        {isArabic ? x.ar : x.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="req-desc" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.requestDescLabel}
                  </label>
                  <textarea
                    id="req-desc"
                    value={reqForm.description}
                    onChange={(e) => setReqForm((f) => ({ ...f, description: e.target.value }))}
                    maxLength={2000}
                    rows={3}
                    placeholder={t.requestDescPlaceholder}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={!reqForm.title.trim() || reqState === 'sending'}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {reqState === 'sending' ? t.requestSending : t.requestSend}
                </button>
                {reqState === 'sent' && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.requestSent}</p>
                )}
                {reqState === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400">{t.requestError}</p>
                )}
              </div>
            </div>
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white me-auto">{t.myRequests}</h3>
                {/* Pager, only when there is more than one page: ‹ › arrows
                    with a Page X of Y readout. Previous/Next swap sides in
                    RTL so "back" always points toward newer requests. */}
                {reqTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReqPage((p) => Math.max(0, p - 1))}
                      disabled={reqPageSafe === 0}
                      aria-label={t.reqPrev}
                      title={t.reqPrev}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 transition-all duration-200 hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {isArabic ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronLeft size={15} aria-hidden="true" />}
                    </button>
                    <span className="min-w-12 text-center text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {isArabic ? `صفحة ${reqPageSafe + 1} من ${reqTotalPages}` : `Page ${reqPageSafe + 1} of ${reqTotalPages}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReqPage((p) => Math.min(reqTotalPages - 1, p + 1))}
                      disabled={reqPageSafe >= reqTotalPages - 1}
                      aria-label={t.reqNext}
                      title={t.reqNext}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 transition-all duration-200 hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {isArabic ? <ChevronLeft size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </div>
              {requests === null ? (
                <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  {t.reqLoading}
                </p>
              ) : requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                  <p className="font-medium text-slate-900 dark:text-white">{t.reqEmpty}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.reqEmptySub}</p>
                </div>
              ) : reqSlice.length === 0 ? (
                <div className="rounded-2xl border border-slate-300 dark:border-slate-700 p-6 text-center">
                  <p className="font-medium text-slate-900 dark:text-white">{t.reqEmpty}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{(requests || []).length > REQ_PAGE_SIZE ? t.reqEmptySub : 'Use the form above.'}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {reqSlice.map((r) => {
                    const cat = REQUEST_CATEGORIES.find((c) => c.id === r.category);
                    const st = STATUS_LABEL[r.status];
                    return (
                      <li
                        key={r.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{r.title}</p>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${REQUEST_STATUS_STYLE[r.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                          >
                            {st ? (isArabic ? st.ar : st.en) : r.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {cat ? (isArabic ? cat.ar : cat.en) : r.category}
                          {r.budget ? ` · ${r.budget}` : ''}
                          {r.timeline ? ` · ${r.timeline}` : ''}
                          {r.createdAt ? ` · ${timeAgo(r.createdAt, isArabic, t.justNow)}` : ''}
                        </p>
                        {r.description ? (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{r.description}</p>
                        ) : null}
                        {r.adminNote ? (
                          <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                            {r.adminNote}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Update feed (admin-written) + message composer: the two-way link. */}
      <section className="pb-10 md:pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-5">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white me-auto">
                {t.updatesTitle}
                {notifications && notifications.some((n) => !n.read) && (
                  <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </h2>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-medium">
                {(['all', 'unread'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setUpdatesFilter(f);
                      setUpdatesShown(5);
                    }}
                    aria-pressed={updatesFilter === f}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      updatesFilter === f
                        ? 'bg-primary text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f === 'all' ? t.showAll : t.showUnread}
                  </button>
                ))}
              </div>
              {notifications && notifications.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t.markAllRead}
                </button>
              )}
            </div>
            {notifications === null ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                {t.loading}
              </p>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                <p className="font-medium text-slate-900 dark:text-white">{t.noUpdates}</p>
              </div>
            ) : (updatesFilter === 'unread' && !notifications.some((n) => !n.read)) ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                <p className="font-medium text-slate-900 dark:text-white">{t.noUnread}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications
                  .filter((n) => updatesFilter === 'all' || !n.read)
                  .slice(0, updatesShown)
                  .map((n) => {
                    const meta = NOTIF_TYPE_META[n.type] || NOTIF_TYPE_META.news;
                    return (
                      <li
                        key={n.id}
                        className={`rounded-2xl border p-4 ${
                          n.read
                            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            : 'border-primary/40 bg-primary/[0.04] dark:bg-primary/[0.07]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {!n.read && (
                              <span className="me-2 inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                            )}
                            {n.title}
                          </p>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => markRead(n.id)}
                              className="shrink-0 text-xs font-medium text-primary hover:underline"
                            >
                              {t.markRead}
                            </button>
                          )}
                        </div>
                        {n.body ? (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.body}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.classes}`}>
                            {isArabic ? meta.ar : meta.en}
                          </span>
                          {n.createdAt ? (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {timeAgo(n.createdAt, isArabic, t.justNow)}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
            {notifications !== null &&
              (notifications.filter((n) => updatesFilter === 'all' || !n.read).length > updatesShown ||
                (updatesShown > 5 && notifications.filter((n) => updatesFilter === 'all' || !n.read).length > 5)) && (
                <div className="mt-4 text-center">
                  {notifications.filter((n) => updatesFilter === 'all' || !n.read).length > updatesShown ? (
                    <button
                      type="button"
                      onClick={() => setUpdatesShown((c) => c + 5)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t.showMore} (
                      {notifications.filter((n) => updatesFilter === 'all' || !n.read).length - updatesShown})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpdatesShown(5)}
                      className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      {t.showLess}
                    </button>
                  )}
                </div>
              )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5">{t.conversationTitle}</h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.conversationHint}</p>
              <div className="mb-4 max-h-80 overflow-y-auto space-y-3" aria-live="polite">
                {thread === null ? (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    {t.loading}
                  </p>
                ) : thread.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.noMessages}</p>
                ) : (
                  thread.map((m) => {
                    const mine = m.sender === 'client';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            mine
                              ? 'bg-primary text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md'
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <label htmlFor="account-message" className="sr-only">
                {t.messageTitle}
              </label>
              <textarea
                id="account-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (msgState !== 'idle' && msgState !== 'sending') setMsgState('idle');
                }}
                placeholder={t.typeReply}
                rows={3}
                maxLength={4000}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!message.trim() || chatSending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {chatSending ? t.messageSending : t.messageSend}
                </button>
                {msgState === 'sent' && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.messageSent}</p>
                )}
                {msgState === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400">{t.messageError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* Pre-existing logged-out content, byte-identical in structure: the fixes
   only change WHEN it renders (logged out), never WHAT it renders. */
function LoggedOutMarketing({ locale, isArabic }: { locale: string; isArabic: boolean }) {
  const features = [
    { icon: LayoutDashboard, title: isArabic ? 'لوحة المشاريع' : 'Project Dashboard', desc: isArabic ? 'تابع تقدم مشاريعك لحظة بلحظة.' : 'Track your projects in real time.' },
    { icon: FileText, title: isArabic ? 'المستندات والفواتير' : 'Docs & Invoices', desc: isArabic ? 'كل العقود والفواتير في مكان واحد.' : 'All contracts and invoices in one place.' },
    { icon: CreditCard, title: isArabic ? 'المدفوعات' : 'Payments', desc: isArabic ? 'ادفع الدفعات وتابع الاشتراكات.' : 'Pay milestones and manage subscriptions.' },
    { icon: Headset, title: isArabic ? 'تذاكر الدعم' : 'Support Tickets', desc: isArabic ? 'تواصل مباشر مع فريق الدعم.' : 'Direct line to the support team.' },
  ];

  return (
    <div className="min-h-screen">
      <div className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {isArabic ? 'حساب العميل' : 'Client Account'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {isArabic
              ? 'سجل الدخول للوصول إلى مشاريعك وفواتيرك وتذاكر الدعم.'
              : 'Sign in to access your projects, invoices, and support tickets.'}
          </p>
          <div className="mt-8 flex gap-4 justify-center flex-wrap">
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors"
            >
              {isArabic ? 'تسجيل الدخول' : 'Sign In'}
            </Link>
            <Link
              href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-6 py-3 text-base font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isArabic ? 'إنشاء حساب' : 'Create Account'}
            </Link>
          </div>
        </div>
      </div>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                  <f.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-2">{f.title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
