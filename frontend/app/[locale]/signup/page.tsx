/* ============================================================
   NOVIQ Frontend — Signup Page (modern, wired to the API)
   ------------------------------------------------------------
   Posts to the real backend route (backend/routes/auth.js →
   POST /api/auth/register) via lib/api-client.ts, stores the
   returned JWT, then routes to the client account. Signup is
   client-only by design — an admin account is provisioned,
   never self-registered.
   ============================================================ */
'use client';

import React, { type FormEvent, use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, ArrowRight, Check } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Lookout } from '@/components/ui/Lookout';

const COPY = {
  en: {
    title: 'Create your account',
    subtitle: 'Get started with Noviq in under a minute.',
    first: 'First name',
    last: 'Last name',
    email: 'Work email',
    pass: 'Password',
    passPh: 'At least 8 characters',
    confirm: 'Confirm password',
    submit: 'Create account',
    submitting: 'Creating…',
    have: 'Already have an account?',
    signIn: 'Sign in',
    errRequired: 'Fill in every field to continue.',
    errPassShort: 'Password must be at least 8 characters.',
    errMismatch: 'The two passwords do not match.',
    errEmail: 'Enter a valid email address.',
    errExists: 'An account with this email already exists.',
    errNetwork: 'Cannot reach the Noviq API. Is the backend running on :4322?',
    note: 'Admin accounts are provisioned by Noviq — client accounts self-register here.',
  },
  ar: {
    title: 'أنشئ حسابك',
    subtitle: 'ابدأ العمل مع نوفيك في أقل من دقيقة.',
    first: 'الاسم الأول',
    last: 'الاسم الأخير',
    email: 'البريد الإلكتروني',
    pass: 'كلمة المرور',
    passPh: '8 أحرف على الأقل',
    confirm: 'تأكيد كلمة المرور',
    submit: 'إنشاء حساب',
    submitting: 'جارٍ الإنشاء…',
    have: 'لديك حساب بالفعل؟',
    signIn: 'تسجيل الدخول',
    errRequired: 'املأ جميع الحقول للمتابعة.',
    errPassShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
    errMismatch: 'كلمتا المرور غير متطابقتين.',
    errEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
    errExists: 'يوجد حساب مسجّل بهذا البريد بالفعل.',
    errNetwork: 'تعذّر الوصول إلى واجهة نوفيك. هل الـ backend يعمل على المنفذ 4322؟',
    note: 'حسابات الإدارة يُنشئها فريق نوفيك — حسابات العملاء تُسجَّل من هنا.',
  },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================
   ADMIN-OWNED COPY
   ------------------------------------------------------------
   The `copy` object above is the offline fallback. The admin owns
   the real text: CMS `auth` holds flat `field` / `fieldAr` pairs and
   this merges them on top, per locale, so first paint is instant and
   an API outage degrades to the fallback rather than a blank page.
   ============================================================ */
function useAdminCopy<T extends Record<string, string>>(
  prefix: string,
  locale: string,
  fallback: T,
): T {
  const [copy, setCopy] = React.useState<T>(fallback);
  React.useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/content/auth`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Record<string, unknown> | null) => {
        if (cancelled || !data || typeof data !== 'object') return;
        const ar = locale === 'ar';
        const next: Record<string, string> = { ...fallback };
        let n = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key.endsWith('Ar')) continue;
          if (!key.startsWith(prefix)) continue;
          /* loginTitle -> title (the copy object uses camelCase keys) */
          const rest = key.slice(prefix.length);
          const field = rest.charAt(0).toLowerCase() + rest.slice(1);
          if (!field) continue;
          const v = ar ? (key + 'Ar' in data ? data[key + 'Ar'] : value) : value;
          if (typeof v === 'string' && v.trim()) { next[field] = v; n++; }
        }
        if (n) setCopy(next as T);
      })
      .catch(() => { /* keep the fallback */ });
    return () => { cancelled = true; };
  }, [prefix, locale, fallback]);
  return copy;
}

export default function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const router = useRouter();
  // Client Components cannot `await` — unwrap the params promise with `use()`.
  const { locale } = use(params);
  const t = useAdminCopy('signup', locale, locale === 'ar' ? COPY.ar : COPY.en);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The eyes watch this form: caret-following, password look-away, sad on error. */
  const formRef = useRef<HTMLFormElement | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = (() => {
    const p = form.password;
    if (p.length < 8) return 0;
    let score = 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score; /* 1..4 */
  })();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const { firstName, lastName, email, password, confirmPassword } = form;
    if (!firstName.trim() || !email.trim() || !password) {
      setError(t.errRequired);
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t.errEmail);
      return;
    }
    if (password.length < 8) {
      setError(t.errPassShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.errMismatch);
      return;
    }

    setBusy(true);
    try {
      const data = await api.auth.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      localStorage.setItem('noviq_token', data.token || '');
      localStorage.setItem('noviq_user', JSON.stringify(data.user || {}));
      router.push(`/${locale}/account`);
      router.refresh();
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? (err as { code?: string }).code : undefined;
      const msg = err instanceof Error ? err.message : '';
      setError((code === 'CONFLICT' && t.errExists) || msg || t.errRequired);
      setBusy(false);
    }
  }

  return (
    <div className="noviq-auth">
      <div className="noviq-auth-card">
        <div className="noviq-auth-head">
          <span className="noviq-auth-eyebrow">Noviq</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>

        <div className="flex justify-center" style={{ marginBottom: 18 }} aria-hidden="true">
          <Lookout size={104} shape="square" scope={formRef} mood={error ? 'sad' : 'auto'} />
        </div>

        <form ref={formRef} onSubmit={onSubmit} className="noviq-auth-form" noValidate>
          <div className="noviq-auth-row">
            <label className="noviq-auth-field">
              <span>{t.first}</span>
              <input type="text" name="firstName" autoComplete="given-name"
                value={form.firstName} onChange={set('firstName')} required />
            </label>
            <label className="noviq-auth-field">
              <span>{t.last}</span>
              <input type="text" name="lastName" autoComplete="family-name"
                value={form.lastName} onChange={set('lastName')} />
            </label>
          </div>

          <label className="noviq-auth-field">
            <span>{t.email}</span>
            <input type="email" name="email" autoComplete="email"
              placeholder="you@company.com"
              value={form.email} onChange={set('email')} required />
          </label>

          <label className="noviq-auth-field">
            <span>{t.pass}</span>
            <div className="noviq-auth-pass">
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder={t.passPh}
                value={form.password}
                onChange={set('password')}
                required
              />
              <button type="button" className="noviq-auth-eye"
                data-lookout="reveal"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}>
                <span className="noviq-auth-eye-text">{showPass ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {/* Strength meter — 4 segments */}
            <div className="noviq-auth-meter" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={strength >= n ? `on s${strength}` : ''} />
              ))}
            </div>
          </label>

          <label className="noviq-auth-field">
            <span>{t.confirm}</span>
            <input type={showPass ? 'text' : 'password'} name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </label>

          {error && (
            <p className="noviq-auth-error" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {error}
            </p>
          )}

          <button type="submit" className="noviq-btn-primary noviq-auth-submit" disabled={busy}>
            {busy ? (
              <><Loader2 size={16} className="noviq-auth-spin" aria-hidden="true" />{t.submitting}</>
            ) : (
              <>{t.submit}<ArrowRight size={16} aria-hidden="true" /></>
            )}
          </button>

          <p className="noviq-auth-alt" style={{ justifyContent: 'center' }}>
            {t.have} <Link href={`/${locale}/login`}>{t.signIn}</Link>
          </p>

          <p className="noviq-auth-note">
            <Check size={14} aria-hidden="true" />
            {t.note}
          </p>
        </form>
      </div>
    </div>
  );
}
