'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { api } from '@/lib/api-client';
import { waMeUrl, profileUrl } from '@/lib/social';
import type { ApiError } from '@/lib/api-client';

interface ContactProps {
  locale: string;
  content?: {
    eyebrow: string;
    title: string;
    desc: string;
    ctaLabel: string;
    successMessage: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    optional: string;
    locations: string;
    company: string;
    companyPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    sending: string;
    sent: string;
    error: string;
  };
  brand?: {
    email: string;
    phone: string;
    locations: string;
    whatsapp?: string;
    facebook?: string;
    instagram?: string;
  };
}

export default function Contact({ locale, content, brand }: ContactProps) {
  const t = useTranslations();
  /* CMS-first: header + brand info from the homepage bundle. */
  const head = {
    eyebrow: content?.eyebrow || t('contact.eyebrow') || 'Contact',
    title: content?.title || t('contact.title'),
    desc: content?.desc || t('contact.description'),
  };
  /* Every string on this form is admin-owned. The dictionary is only a
     fallback for when the CMS has not been filled in yet. */
  const s = (key: keyof NonNullable<ContactProps['content']>): string =>
    (content?.[key] as string | undefined) || (t(`contact.${key}`) as unknown as string) || '';

  const email = brand?.email || 'hello@noviqsolutions.com';
  const phone = brand?.phone || '+1-415-555-0182';
  const phoneHref = `tel:${phone.replace(/[^+\d]/g, '')}`;
  const locations = brand?.locations || '';
  /* All three handles are admin-owned (Site Content → Brand) and are
     normalised by lib/social.ts: wa.me needs the full international
     number with the trunk zero dropped, and a pasted @handle is not
     part of a profile path. An unset handle yields '' and the icon
     is simply not rendered — no dead link. */
  const whatsappHref = waMeUrl(brand?.whatsapp);
  const facebookHref = profileUrl(brand?.facebook, 'https://facebook.com');
  const instagramHref = profileUrl(brand?.instagram, 'https://instagram.com');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      await api.contact.submit(formData);
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', company: '', message: '' });
    } catch (e) {
      /* Network down, validation error, or 5xx — all land here. */
      setStatus('error');
    }
  };

  return (
    <section className="noviq-section-qodix" aria-labelledby="contact-heading">
      <div className="noviq-wrap">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          <div>
            <p className="eyebrow">{head.eyebrow}</p>
            <h2 id="contact-heading" className="noviq-h2 mt-5 text-slate-900 dark:text-white">
              {head.title}
            </h2>
            <p className="noviq-lead mb-8">
              {head.desc}
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{s('email')}</h3>
                  <a href={`mailto:${email}`} className="inline-flex items-center min-h-[44px] text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                    {email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{s('phone')}</h3>
                  <a href={phoneHref} className="inline-flex items-center min-h-[44px] text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                    {phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{s('locations')}</h3>
                  <address className="not-italic text-slate-600 dark:text-slate-400">
                    {locations || 'San Francisco · London · Singapore'}
                  </address>
                </div>
              </div>
            </div>

            {/* Social media links — admin-owned, hidden entirely when unset.
                Styling lives in .noviq-social (styles/globals.css) so this row
                and the footer row can never drift apart. */}
            {(whatsappHref || facebookHref || instagramHref) && (
              <div className="noviq-social-row mt-9">
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="noviq-social noviq-social--whatsapp"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  </a>
                )}
                {facebookHref && (
                  <a
                    href={facebookHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="noviq-social noviq-social--facebook"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                )}
                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="noviq-social noviq-social--instagram"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 md:p-8" noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {s('name')}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder={s('namePlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {s('email')}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder={s('emailPlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {s('phone')}
                  {/* Optional, and said so — a field marked required that
                      the API treats as optional is a support ticket. */}
                  {s('optional') && (
                    <span className="ms-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                      {s('optional')}
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                  /* Pinned LTR: on the Arabic page an inherited RTL field
                     renders "+1 415 555 0182" with the + on the wrong end
                     and the groups in reverse. The field stays positioned
                     per the form's direction; only the value is LTR. */
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder={s('phonePlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {s('company')}
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder={s('companyPlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {s('message')}
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors resize-y"
                  placeholder={s('messagePlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="noviq-cta-primary w-full"
              >
                {status === 'submitting' ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {s('sending')}
                  </>
                ) : status === 'success' ? (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {s('sent')}
                  </>
                ) : (
                  <>
                    {s('ctaLabel')}
                    <Send className="h-5 w-5" aria-hidden="true" />
                  </>
                )}
              </button>

              {status === 'error' && (
                <p className="text-center text-red-600 dark:text-red-400 text-sm">
                  {s('error')}
                </p>
              )}

              {status === 'success' && s('successMessage') && (
                <p className="text-center text-slate-600 dark:text-slate-300 text-sm">
                  {s('successMessage')}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
