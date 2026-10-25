import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Footer } from '../components/common/Footer';

/* Small inline icons: no image files, so the page has no external assets. */
const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// k = translation key prefix (see i18n/hi.ts); the English text is the fallback.
const STEPS = [
  { k: 'step1', title: 'Register the instrument', text: 'The owner records the weighing or measuring instrument once: type, capacity, serial number, location.' },
  { k: 'step2', title: 'Apply online', text: "Apply for verification or re-verification. The fee is calculated from the department's fee rules." },
  { k: 'step3', title: 'Officer assigned and scheduled', text: 'The department assigns a Legal Metrology Officer or test centre and books a date. Double bookings are blocked.' },
  { k: 'step4', title: 'Field inspection', text: 'The officer records readings on site. The system decides pass or fail for each reading against its tolerance, and evidence photos are fingerprinted.' },
  { k: 'step5', title: 'Certificate issued', text: 'A PASS result produces a PDF certificate with a QR code. Its fingerprint and signature are stored.' },
  { k: 'step6', title: 'Anyone can verify', text: 'Scan the QR or enter the certificate number. Altered or revoked certificates are flagged immediately.' },
];

const TRUST = [
  { k: 'trust1', icon: 'M9 12l2 2 4-4m5.6-3.2A11.9 11.9 0 0112 2.9 11.9 11.9 0 013.4 5.8 12 12 0 003 9c0 5.6 3.8 10.3 9 11.6 5.2-1.3 9-6 9-11.6 0-1.1-.1-2.2-.4-3.2z', title: 'Tamper detection', text: 'Every certificate PDF has a SHA-256 fingerprint and a signed QR link. Upload a PDF on the verify page to check it was really issued here.' },
  { k: 'trust2', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Never miss a due date', text: 'Owners get reminders 30, 15, 7 and 1 day before a certificate expires, and the department sees what is overdue.' },
  { k: 'trust3', icon: 'M18.4 5.6l-12.8 12.8M12 21a9 9 0 100-18 9 9 0 000 18z', title: 'Revocation that sticks', text: 'A revoked certificate is flagged on every check and cannot be reinstated. The reason is recorded.' },
  { k: 'trust4', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', title: 'A trail you can audit', text: 'Status changes and sensitive actions go into a hash-chained log, so history cannot be quietly rewritten.' },
];

const ROLES = [
  { k: 'role1', who: 'Instrument owners', what: 'Register instruments, apply, track status, answer officer queries, download certificates.' },
  { k: 'role2', who: 'Legal Metrology Officers and test centres', what: 'See assigned work, record inspections with readings, GPS and photos.' },
  { k: 'role3', who: 'Department administrators', what: 'Review applications, assign and schedule officers, issue or revoke certificates, run reports.' },
  { k: 'role4', who: 'Consumers and traders', what: 'Check any certificate for free, without an account.' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/verify-public?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="w-full bg-white text-slate-800">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#12263d] via-[#1a3a5c] to-[#24527f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#FFAA17]">{t('landing.eyebrow', 'Legal Metrology · Online verification')}</p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold leading-tight">
              {t('landing.title', 'Trust every scale and measure, with a certificate you can check in seconds.')}
            </h1>
            <p className="mt-4 text-white/85 max-w-xl">
              {t('landing.lead', 'Pramaan takes weighing and measuring instruments from application to a tamper-evident digital certificate, and lets anyone confirm it is genuine.')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {user ? (
                <Link to="/dashboard" className="px-5 py-2.5 rounded-lg bg-[#FFAA17] text-[#1a1a2e] font-bold text-sm hover:bg-[#f8aa24]">{t('landing.dashboard', 'Go to my dashboard')}</Link>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2.5 rounded-lg bg-[#FFAA17] text-[#1a1a2e] font-bold text-sm hover:bg-[#f8aa24]">{t('landing.signIn', 'Sign in')}</Link>
                  <Link to="/register" className="px-5 py-2.5 rounded-lg border border-white/50 font-bold text-sm hover:bg-white/10">{t('landing.register', 'Register as an owner')}</Link>
                </>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="bg-white text-slate-800 rounded-2xl shadow-xl p-6" aria-label={t('landing.verifyTitle', 'Verify a certificate')}>
            <h2 className="text-lg font-extrabold text-[#1a3a5c]">{t('landing.verifyTitle', 'Verify a certificate')}</h2>
            <p className="text-sm text-slate-600 mt-1">{t('landing.verifyHelp', 'Enter the certificate number printed on the certificate, or the code from its QR link.')}</p>
            <label htmlFor="cert-query" className="sr-only">{t('landing.verifyTitle', 'Verify a certificate')}</label>
            <input
              id="cert-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('landing.verifyPlaceholder', 'e.g. CERT-2026-000123')}
              className="mt-4 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            />
            <button type="submit" disabled={!query.trim()} className="mt-3 w-full px-4 py-2.5 rounded-lg bg-[#1a3a5c] text-white font-bold text-sm hover:bg-[#12263d] disabled:opacity-50">
              {t('landing.verifyButton', 'Check certificate')}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              <Link to="/verify-public" className="font-semibold text-[#1a3a5c] hover:underline">
                {t('landing.verifyPdf', 'Have the PDF instead? Upload it to check its fingerprint')}
              </Link>
            </p>
          </form>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 scroll-mt-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a3a5c]">{t('landing.stepsTitle', 'From application to certificate')}</h2>
        <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <li key={s.k} className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-[#1a3a5c] text-white text-sm font-bold">{i + 1}</span>
              <h3 className="mt-3 font-bold text-slate-900">{t(`landing.${s.k}.title`, s.title)}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(`landing.${s.k}.text`, s.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="bg-[#F4F5F8] border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a3a5c]">{t('landing.trustTitle', 'Built so certificates can be trusted')}</h2>
          <div className="mt-8 grid sm:grid-cols-2 gap-5">
            {TRUST.map((x) => (
              <div key={x.k} className="flex gap-4 rounded-2xl bg-white border border-slate-200 p-5">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-[#1a3a5c]/10 text-[#1a3a5c] flex items-center justify-center"><Icon d={x.icon} /></span>
                <div>
                  <h3 className="font-bold text-slate-900">{t(`landing.${x.k}.title`, x.title)}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(`landing.${x.k}.text`, x.text)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a3a5c]">{t('landing.rolesTitle', 'Who uses Pramaan')}</h2>
        <dl className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-5">
          {ROLES.map((r) => (
            <div key={r.k} className="border-l-4 border-[#FFAA17] pl-4">
              <dt className="font-bold text-slate-900">{t(`landing.${r.k}.who`, r.who)}</dt>
              <dd className="text-sm text-slate-600 mt-0.5">{t(`landing.${r.k}.what`, r.what)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Footer />
    </div>
  );
};
