/* ============================================================
   NOVIQ Frontend — Login Page (modern, role-aware)
   ------------------------------------------------------------
   One form, two audiences. The segmented control switches the
   auth endpoint and the redirect target:

     Client → POST /api/auth/login   (email + password)   → /{locale}/account
     Admin  → POST /api/admin/login  (username + password)→ {API}/admin

   Client auth goes through lib/api-client.ts (single transport).
   Admin uses a raw fetch (separate dashboard origin).
   The token lands in localStorage under the key the consuming
   code already reads: `noviq_token` for clients, `admin_token`
   for admins.
   ============================================================ */
'use client';

import React, { type FormEvent, use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Lookout } from '@/components/ui/Lookout';

/* Falls back to the local API port only if NEXT_PUBLIC_API_URL is missing;
   the real value is inlined at build time from frontend/.env.local. */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4322';

type Role = 'user' | 'admin';

const COPY = {
  en: {
    title: 'Welcome back',
    subtitle: 'Sign in to continue to your Noviq workspace.',
    client: 'Client',
    admin: 'Admin',
    clientHint: 'Access your projects, invoices and support tickets.',
    adminHint: 'Restricted area — administrators only.',
    identifier: 'Email address',
    identifierPh: 'you@company.com',
    adminIdentifier: 'Username or email',
    adminIdentifierPh: 'admin',
    password: 'Password',
    passwordPh: 'Enter your password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    backHome: 'Back to home',
    errRequired: 'Enter your credentials to continue.',
    errPassShort: 'Password must be at least 8 characters.',
    errNetwork: 'Cannot reach the Noviq API. Is the backend running on :4322?',
    badCreds: 'That email and password combination did not work.',
    badAdmin: 'Those admin credentials were not recognised.',
  },
  ar: {
    title: 'أهلاً بعودتك',
    subtitle: 'سجّل الدخول للمتابعة إلى مساحة عملك في نوفيك.',
    client: 'عميل',
    admin: 'إدارة',
    clientHint: 'ادخل إلى مشاريعك وفواتيرك وتذاكر الدعم.',
    adminHint: 'منطقة مقيدة — للمشرفين فقط.',
    identifier: 'البريد الإلكتروني',
    identifierPh: 'you@company.com',
    adminIdentifier: 'اسم المستخدم أو البريد',
    adminIdentifierPh: 'admin',
    password: 'كلمة المرور',
    passwordPh: 'أدخل كلمة المرور',
    signIn: 'تسجيل الدخول',
    signingIn: 'جارٍ الدخول…',
    noAccount: 'ليس لديك حساب؟',
    createOne: 'أنشئ حساباً',
    backHome: 'العودة للرئيسية',
    errRequired: 'أدخل بياناتك للمتابعة.',
    errPassShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
    errNetwork: 'تعذّر الوصول إلى واجهة نوفيك. هل الـ backend يعمل على المنفذ 4322؟',
    badCreds: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    badAdmin: 'بيانات دخول الإدارة غير صحيحة.',
  },
} as const;

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

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const router = useRouter();
  // Client Components cannot `await` — unwrap the params promise with `use()`.
  const { locale } = use(params);
  const t = useAdminCopy('login', locale, locale === 'ar' ? COPY.ar : COPY.en);

  const [role, setRole] = useState<Role>('user');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The eyes watch this form: caret-following, password look-away, sad on error. */
  const formRef = useRef<HTMLFormElement | null>(null);

  const isAdmin = role === 'admin';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError(t.errRequired);
      return;
    }
    if (password.length < 8) {
      setError(t.errPassShort);
      return;
    }

    setBusy(true);
    try {
      if (isAdmin) {
        /* Admins sign in with `username` against the dashboard origin. */
        const res = await fetch(`${API}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier.trim(), password }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError((data && data.error && data.error.message) || t.badAdmin);
          setBusy(false);
          return;
        }
        const { token, user } = (data || {}) as {
          token?: string;
          user?: { role?: string; email?: string; username?: string };
        };
        localStorage.setItem('admin_token', token || '');
        localStorage.setItem('admin_user', JSON.stringify(user || {}));
        /* Admins land in the backend dashboard. */
        window.location.href = `${API}/admin`;
        return;
      }

      /* Client auth goes through the single api-client transport
         (base URL + error envelope handled in one place). */
      const data = await api.auth.login({
        email: identifier.trim().toLowerCase(),
        password,
      });
      localStorage.setItem('noviq_token', data.token || '');
      localStorage.setItem('noviq_user', JSON.stringify(data.user || {}));
      router.push(`/${locale}/account`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // ApiError carries the backend message; network failure has no status.
      setError(msg || t.errNetwork);
      setBusy(false);
    }
  }

  return (
    <div className="noviq-auth">
      <div className="noviq-auth-card noviq-auth-card--wide">
        <div className="noviq-auth-side">
        <div className="noviq-auth-head">
          <span className="noviq-auth-eyebrow">Noviq</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>

        <div className="flex justify-center" style={{ marginBottom: 18 }} aria-hidden="true">
          <Lookout size={104} shape="square" scope={formRef} mood={error ? 'sad' : 'auto'} />
        </div>

        <p className="noviq-auth-hint">{isAdmin ? t.adminHint : t.clientHint}</p>
        </div>
        <div className="noviq-auth-main">

        {/* Segmented role switch */}
        <div className="noviq-auth-seg" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={!isAdmin}
            className={!isAdmin ? 'is-active' : ''}
            onClick={() => {
              setRole('user');
              setError(null);
            }}
          >
            <User size={15} aria-hidden="true" />
            {t.client}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isAdmin}
            className={isAdmin ? 'is-active' : ''}
            onClick={() => {
              setRole('admin');
              setError(null);
            }}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            {t.admin}
          </button>
        </div>

        <form ref={formRef} onSubmit={onSubmit} className="noviq-auth-form" noValidate>
          <label className="noviq-auth-field">
            <span>{isAdmin ? t.adminIdentifier : t.identifier}</span>
            <input
              type={isAdmin ? 'text' : 'email'}
              name="identifier"
              autoComplete={isAdmin ? 'username' : 'email'}
              placeholder={isAdmin ? t.adminIdentifierPh : t.identifierPh}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>

          <label className="noviq-auth-field">
            <span>{t.password}</span>
            <div className="noviq-auth-pass">
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder={t.passwordPh}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="noviq-auth-eye"
                data-lookout="reveal"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <p className="noviq-auth-error" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              {error}
            </p>
          )}

          <button type="submit" className="noviq-btn-primary noviq-auth-submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="noviq-auth-spin" aria-hidden="true" />
                {t.signingIn}
              </>
            ) : (
              <>
                {t.signIn}
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>

          <div className="noviq-auth-alt">
            {!isAdmin && (
              <span>
                {t.noAccount}{' '}
                <Link href={`/${locale}/signup`}>{t.createOne}</Link>
              </span>
            )}
            <Link href={`/${locale}`}>{t.backHome}</Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
