/* ============================================================
   NOVIQ — the one contact chooser, used by EVERY call-to-action
   ------------------------------------------------------------
   Any button that used to jump straight to /contact now opens this
   small dialog and lets the visitor choose:

     · Get in touch → the contact page (a quick message)
     · Request a project → the dashboard request form when signed in,
       the signup page when not (a project request needs an account,
       because it is tracked and triaged by the team)

   Why a chooser instead of a plain link: a "View Case Study" or
   "Get This Solution" button is a project-sized intent, not a
   question. Sending those visitors to a generic contact form loses
   them; giving them the project request path lets the admin triage
   real work.

   ONE implementation for the whole site: hero, pricing, solutions,
   portfolio, industries, services, about, careers, why, faq,
   clients, Liftoff, service detail. Every one of them passes its own
   classes and children, so the visual stays byte-identical to the
   plain Link it replaced — only the click behaviour changed.

   Radix Dialog for the focus trap, Escape and overlay close.
   ============================================================ */
'use client';

import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/* The chooser body on its own — reuse it wherever the trigger has to
   be custom markup (cards, icons, full-width blocks). */
export function ContactChoiceDialog({
  open,
  onOpenChange,
  locale,
  isArabic,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  isArabic?: boolean;
  /** What the visitor was looking at, e.g. a solution or project name. */
  subject?: string;
}) {
  const ar = isArabic ?? locale === 'ar';
  const { isLoggedIn, loading } = useAuth();
  /* CMS titles arrive with whatever whitespace the admin typed ("Pioneers "),
     which shows up as a stray gap before the wrap in the dialog title. */
  const clean = subject ? subject.replace(/\s+/g, ' ').trim() : '';

  const t = {
    title: clean
      ? ar
        ? `تواصل بشأن ${clean}`
        : `Get in touch about ${clean}`
      : ar
        ? 'كيف تريد المتابعة؟'
        : 'How would you like to continue?',
    hint: ar
      ? 'اختر الطريقة المناسبة لك.'
      : 'Choose how you want to proceed.',
    contact: ar ? 'تواصل معنا' : 'Get in touch',
    contactHint: ar
      ? 'رسالة سريعة عبر نموذج التواصل.'
      : 'A quick message through the contact form.',
    request: ar ? 'طلب مشروع' : 'Request a project',
    requestHint: ar
      ? 'يصل الفريق مباشرة ويُتابع من لوحتك.'
      : 'Reaches the team directly, tracked on your dashboard.',
    needAccount: ar ? 'يتطلب حساباً' : 'Requires an account',
    signIn: ar ? 'تسجيل الدخول' : 'Sign in',
    signUp: ar ? 'إنشاء حساب' : 'Create account',
    close: ar ? 'إغلاق' : 'Close',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          dir={ar ? 'rtl' : 'ltr'}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl focus:outline-none"
        >
          <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
            {t.title}
          </Dialog.Title>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.hint}</p>

          <div className="mt-5 grid gap-3">
            <Link
              href={`/${locale}/contact`}
              onClick={() => onOpenChange(false)}
              className="block rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-primary/60 hover:shadow-md transition-all"
            >
              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                {t.contact}
              </span>
              <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.contactHint}
              </span>
            </Link>

            {loading ? null : isLoggedIn ? (
              <Link
                href={`/${locale}/account#project-requests`}
                onClick={() => onOpenChange(false)}
                className="block rounded-2xl border border-primary/50 bg-primary/5 dark:bg-primary/10 p-4 hover:shadow-md transition-all"
              >
                <span className="font-semibold text-primary text-sm">{t.request}</span>
                <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t.requestHint}
                </span>
              </Link>
            ) : (
              <div className="rounded-2xl border border-primary/50 bg-primary/5 dark:bg-primary/10 p-4">
                <span className="font-semibold text-primary text-sm">{t.request}</span>
                <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t.needAccount}{' '}
                  <Link
                    href={`/${locale}/signup`}
                    onClick={() => onOpenChange(false)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t.signUp}
                  </Link>
                  {' · '}
                  <Link
                    href={`/${locale}/login`}
                    onClick={() => onOpenChange(false)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t.signIn}
                  </Link>
                </span>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={cn(
                'mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-medium',
                'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'
              )}
            >
              {t.close}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Drop-in replacement for a contact `<Link>`: same classes, same
 * children, same look — clicking now opens the chooser.
 *
 *   - before: <Link href={`/${locale}/contact`} className="…">{label}</Link>
 *   - after:  <ContactCta locale={locale} className="…">{label}</ContactCta>
 */
export default function ContactCta({
  locale,
  isArabic,
  className,
  children,
  subject,
}: {
  locale: string;
  isArabic?: boolean;
  className?: string;
  children: ReactNode;
  subject?: string;
}) {
  const [open, setOpen] = useState(false);
  const ar = isArabic ?? locale === 'ar';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ContactChoiceDialog
        open={open}
        onOpenChange={setOpen}
        locale={locale}
        isArabic={ar}
        subject={subject}
      />
    </>
  );
}