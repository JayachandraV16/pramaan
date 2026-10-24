import { useI18n } from '../../i18n/I18nContext';
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  certificatesApi,
  PublicVerificationResponse,
  DocumentCheckResponse,
} from '../../api/certificates.api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import pramaanLogoMain from '../../assets/pramaan_logo_main.png';

/** Date-only strings (YYYY-MM-DD) are calendar dates: format without timezone shifts. */
function formatDate(d?: string | null) {
  if (!d) return 'N/A';
  const dateOnly = /^\d{4}-\d{2}-\d{2}/.test(d);
  const date = new Date(dateOnly ? `${d.slice(0, 10)}T00:00:00Z` : d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

type Verdict = 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID' | 'TAMPERED' | 'NOT_FOUND';

function getVerdict(r: PublicVerificationResponse): Verdict {
  if (r.tampered) return 'TAMPERED';
  if (!r.certificate) return 'NOT_FOUND';
  return r.result;
}

const VERDICT_COPY: Record<Verdict, { title: string; text: string; tone: string }> = {
  VALID: {
    title: 'Valid certificate',
    text: 'This certificate was issued by Pramaan, is within its validity period and has not been revoked.',
    tone: 'bg-emerald-50 border-emerald-300 text-emerald-950',
  },
  EXPIRED: {
    title: 'Certificate expired',
    text: 'This certificate is genuine but its validity period has ended. The instrument needs re-verification.',
    tone: 'bg-amber-50 border-amber-300 text-amber-950',
  },
  REVOKED: {
    title: 'Certificate revoked',
    text: 'This certificate was revoked by the Legal Metrology authority and must not be relied upon.',
    tone: 'bg-rose-50 border-rose-300 text-rose-950',
  },
  INVALID: {
    title: 'Certificate not valid yet',
    text: 'This certificate exists but its validity period has not started.',
    tone: 'bg-rose-50 border-rose-300 text-rose-950',
  },
  TAMPERED: {
    title: 'Possible tampering detected',
    text: 'The data or QR link does not match what Pramaan recorded when the certificate was issued. Do not rely on this document and report it to the Legal Metrology office.',
    tone: 'bg-rose-100 border-rose-400 text-rose-950',
  },
  NOT_FOUND: {
    title: 'No such certificate',
    text: 'No certificate with this number or QR token exists in the Pramaan registry.',
    tone: 'bg-rose-50 border-rose-300 text-rose-950',
  },
};

const INTEGRITY_LABEL: Record<string, string> = {
  VALID: 'Verified',
  MATCH: 'Matches issued record',
  INVALID: 'Does not match',
  MISMATCH: 'Does not match issued record',
  NOT_PROVIDED: 'Not provided (looked up manually)',
  UNAVAILABLE: 'Not available (older certificate)',
};

export const PublicVerifyPage: React.FC = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const signatureParam = searchParams.get('s') || '';

  const [query, setQuery] = useState(queryParam);
  const [result, setResult] = useState<PublicVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [docResult, setDocResult] = useState<DocumentCheckResponse | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const lookup = async (identifier: string, signature?: string) => {
    if (!identifier.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await certificatesApi.verifyPublic(identifier, signature));
    } catch (err: any) {
      setError(err?.message || 'Could not reach the verification service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      lookup(queryParam, signatureParam || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam, signatureParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) setSearchParams({ q });
  };

  const handleDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocLoading(true);
    setDocError(null);
    setDocResult(null);
    try {
      setDocResult(await certificatesApi.checkDocument(file));
    } catch (err: any) {
      setDocError(err?.message || 'Could not check this file.');
    } finally {
      setDocLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const verdict = result ? getVerdict(result) : null;
  const cert = result?.certificate;

  const rows: Array<[string, string | undefined | null]> = cert
    ? [
        ['Certificate No.', cert.certificateNumber],
        ['Instrument', cert.instrumentName],
        ['Manufacturer', cert.manufacturer],
        ['Model', cert.model],
        ['Serial No.', cert.serialNumber],
        ['Capacity', cert.capacity ? `${cert.capacity} ${cert.capacityUnit || ''}`.trim() : null],
        ['Accuracy class', cert.accuracyClass],
        ['Owner', [cert.ownerName, cert.ownerOrganization].filter(Boolean).join(' · ') || null],
        ['Verified by', cert.officerName],
        ['Valid from', formatDate(cert.validFrom)],
        ['Valid until', formatDate(cert.validUntil)],
        ['Status', cert.status],
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="text-center">
        <img src={pramaanLogoMain} alt="Pramaan" className="w-16 h-16 mx-auto mb-2 object-contain" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('verify.title', 'Verify a certificate')}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {t('verify.intro', 'Scan the QR code on the certificate, or enter its certificate number.')}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-gov space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="verify-query" className="block text-xs font-semibold text-slate-700">
            {t('verify.queryLabel', 'Certificate number or QR token *')}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="verify-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. CERT-2026-000123"
              required
              className="flex-1 px-4 py-3 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
            <Button type="submit" variant="accent" size="md" isLoading={isLoading} className="py-3 px-6 shrink-0">
              Verify now
            </Button>
          </div>
        </form>
      </div>

      {isLoading && <LoadingSpinner label="Checking the Pramaan registry..." />}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      )}

      {result && verdict && (
        <div className="space-y-6">
          <div className={`rounded-2xl p-6 border shadow-gov ${VERDICT_COPY[verdict].tone}`} role="status">
            <h2 className="text-lg font-bold">{t(`verify.${verdict}.title`, VERDICT_COPY[verdict].title)}</h2>
            <p className="text-sm mt-1 leading-relaxed">{t(`verify.${verdict}.text`, VERDICT_COPY[verdict].text)}</p>
            {result.certificate?.revokedAt && (
              <p className="text-xs mt-2">Revoked on {formatDate(result.certificate.revokedAt)}.</p>
            )}
          </div>

          {cert && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-gov overflow-hidden">
              <dl className="divide-y divide-slate-100">
                {rows
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex gap-4 px-5 py-2.5 text-sm">
                      <dt className="w-40 shrink-0 font-semibold text-slate-500 uppercase text-[11px] tracking-wide pt-0.5">
                        {label}
                      </dt>
                      <dd className="text-slate-900 break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {result.integrity && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-800">{t('verify.integrity', 'Integrity checks')}</h3>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>
                  QR signature:{' '}
                  <strong>{INTEGRITY_LABEL[result.integrity.signature] ?? result.integrity.signature}</strong>
                </li>
                <li>
                  Certificate record:{' '}
                  <strong>{INTEGRITY_LABEL[result.integrity.recordHash] ?? result.integrity.recordHash}</strong>
                </li>
                {result.integrity.recordFingerprint && (
                  <li>
                    Record fingerprint (SHA-256, first 16):{' '}
                    <code className="font-mono text-xs">{result.integrity.recordFingerprint}</code>
                  </li>
                )}
                <li>
                  {t('verify.signature', 'Digital signature')}:{' '}
                  <strong>
                    {result.integrity.pdfSigned
                      ? t('verify.signedBy', 'Signed by {who}', { who: result.integrity.signerSubject || '-' })
                      : t('verify.notSigned', 'Not digitally signed (issued without a signing key)')}
                  </strong>
                </li>
                {result.integrity.pdfSha256 && (
                  <li className="break-all">
                    PDF SHA-256: <code className="font-mono text-xs">{result.integrity.pdfSha256}</code>
                  </li>
                )}
              </ul>
              <p className="text-xs text-slate-500">Checked {new Date(result.verifiedAt).toLocaleString('en-IN')}.</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-gov space-y-3">
        <h2 className="text-sm font-bold text-slate-800">{t('verify.checkPdf', 'Check a certificate PDF')}</h2>
        <p className="text-xs text-slate-600">
          Received a certificate as a file? Upload it to confirm it is byte-for-byte the document Pramaan issued.
          Any edit, even a single character, will be detected. The file is not stored.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleDocument}
          aria-label="Certificate PDF"
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200"
        />
        {docLoading && <LoadingSpinner label="Calculating SHA-256 and checking the registry..." />}
        {docError && (
          <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
            {docError}
          </div>
        )}
        {docResult && (
          <div
            role="status"
            className={`rounded-lg border p-3 text-sm ${
              docResult.matches
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            <p className="font-semibold">{docResult.message}</p>
            {docResult.matches && (
              <p className="mt-1 text-xs">
                Certificate {docResult.certificateNumber} · status {docResult.status}
              </p>
            )}
            {docResult.signature && (
              <p className="mt-1 text-xs">
                {t('verify.signature', 'Digital signature')}:{' '}
                {!docResult.signature.signed
                  ? t('verify.fileNotSigned', 'this file carries no signature')
                  : docResult.signature.valid
                  ? t('verify.sigValid', 'valid, signed by {who}', { who: docResult.signature.subject || '-' }) +
                    (docResult.signature.coversWholeFile === false ? ' ' + t('verify.sigExtra', '(content was added after signing)') : '') +
                    (docResult.signature.selfSigned ? ' ' + t('verify.sigSelf', '(self-signed key: not from a certifying authority)') : '')
                  : t('verify.sigBroken', 'INVALID - the document was changed after it was signed')}
              </p>
            )}
            <p className="mt-1 break-all text-[11px] font-mono opacity-80">SHA-256 {docResult.sha256}</p>
          </div>
        )}
      </div>
    </div>
  );
};
