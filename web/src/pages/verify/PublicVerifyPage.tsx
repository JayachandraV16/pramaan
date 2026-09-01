import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { certificatesApi } from '../../api/certificates.api';
import { PublicVerificationLookupResult } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { getFileUrl } from '../../api/client';
import pramaanLogoMain from '../../assets/pramaan_logo_main.png';
function formatDate(d?: string | Date) {
  if (!d) return 'N/A';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export const PublicVerifyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [result, setResult] = useState<PublicVerificationLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      handleLookup(queryParam);
    }
  }, [queryParam]);

  const handleLookup = async (lookupQuery: string) => {
    if (!lookupQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await certificatesApi.lookupCertificateByNumberOrQr(lookupQuery);
      setResult(res);
    } catch (err) {
      setResult({
        authenticated: false,
        result: 'INVALID',
        remarks: 'Error querying certificate ledger.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      handleLookup(query.trim());
    }
  };

  const sampleLookups = [
    { label: 'Active Valid Certificate', query: 'CERT-LM-MH-2026-098124', badge: 'VALID' },
    { label: 'Expired Certificate (Needs Renewal)', query: 'CERT-LM-MH-2025-044182', badge: 'EXPIRED' },
    { label: 'High Precision Balance (Class I)', query: 'CERT-LM-MH-2025-077123', badge: 'VALID' },
    { label: 'Unregistered / Invalid Token', query: 'FAKE-QR-TOKEN-9999', badge: 'INVALID' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Verify documents
        </h1>
      </div>

      {/* Lookup Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-gov space-y-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Enter Certificate Number, QR Token, or Equipment Serial Number *
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. CERT-LM-MH-2026-098124 or SN-ESS-2023-44129"
                required
                className="w-full pl-11 pr-4 py-3 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
            <Button
              type="submit"
              variant="accent"
              size="md"
              isLoading={isLoading}
              className="py-3 px-6 shrink-0"
            >
              Verify Now
            </Button>
          </div>
        </form>

        {/* Demo Samples */}
        <div className="pt-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Try Demo Certificate Records:
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleLookups.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(s.query);
                  setSearchParams({ q: s.query });
                  handleLookup(s.query);
                }}
                className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <span>{s.label}</span>
                <Badge status={s.badge} size="sm" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Display */}
      {isLoading ? (
        <LoadingSpinner label="Authenticating digital signature with national metrology registry..." />
      ) : hasSearched && result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status Verdict Header */}
          <div
            className={`rounded-2xl p-6 border shadow-gov flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
              result.result === 'VALID'
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : result.result === 'EXPIRED'
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-rose-50/90 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">
                    {result.result === 'VALID'
                      ? 'OFFICIALLY VERIFIED & VALID'
                      : result.result === 'EXPIRED'
                      ? 'CERTIFICATE EXPIRED (RENEWAL REQUIRED)'
                      : 'INVALID / UNRECOGNIZED CERTIFICATE'}
                  </h3>
                  <Badge status={result.result} size="md" />
                </div>
                <p className="text-xs mt-1 leading-relaxed opacity-90">{result.remarks}</p>
              </div>
            </div>

            {result.certificate && (
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/certificates/${result.certificate.id}`}>
                  <Button variant="primary" size="sm">
                    View Certificate
                  </Button>
                </Link>
                <a
                  href={getFileUrl(result.certificate.certificate_file_url || `/uploads/certificates/${result.certificate.certificate_number}.pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  download={`${result.certificate.certificate_number}.pdf`}
                  onClick={(e) => {
                    if (!result.certificate?.certificate_file_url) {
                      e.preventDefault();
                      window.print();
                    }
                  }}
                >
                  <Button variant="accent" size="sm">
                    Download PDF
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Generated Official Certificate Paper — Exactly matching official PDF Layout */}
          {result.authenticated && result.certificate && (
            <div className="certificate-container bg-white border border-[#1a3a5c] p-[10px] shadow-2xl relative">
              <div className="border-2 border-[#1a3a5c] p-6 sm:p-8 space-y-4 bg-white">
                {/* Header Section: Logo + Department Text */}
                <div className="flex items-center gap-5 pb-2">
                  <img
                    src={pramaanLogoMain}
                    alt="Pramaan Logo"
                    className="w-[100px] h-[100px] object-contain shrink-0"
                  />
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#555555] uppercase tracking-wider font-sans font-medium">
                      DEPARTMENT OF CONSUMER AFFAIRS
                    </p>
                    <h2 className="text-2xl sm:text-[24px] font-bold text-[#1a3a5c] font-sans tracking-tight leading-none">
                      CERTIFICATE OF VERIFICATION
                    </h2>
                    <p className="text-[10px] text-[#555555] font-sans font-medium">
                      Legal Metrology — Weighing & Measuring Instruments
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-b border-[#cccccc] w-full" />

                {/* Certificate Number */}
                <div className="text-[11px] text-[#222222] font-sans pt-1">
                  Certificate No: <strong className="font-bold text-[#222222] font-mono">{result.certificate.certificate_number || 'N/A'}</strong>
                </div>

                {/* Body Statement */}
                <p className="text-[12.5px] text-[#222222] font-sans leading-relaxed text-justify">
                  This is to certify that the weighing/measuring instrument described below has been examined and verified in accordance with the applicable Legal Metrology standards, and found to conform to the prescribed requirements of accuracy.
                </p>

                {/* Details Table & QR Code Block (Matching PDF structure) */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pt-2">
                  {/* Details Table (Left Side) */}
                  <div className="flex-1 space-y-0 text-[11px] font-sans">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                      <span className="font-bold text-[#555555] uppercase w-36 shrink-0">INSTRUMENT</span>
                      <span className="text-[12px] text-[#222222] text-left flex-1">{result.certificate.instrument_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                      <span className="font-bold text-[#555555] uppercase w-36 shrink-0">MANUFACTURER</span>
                      <span className="text-[12px] text-[#222222] text-left flex-1">{result.certificate.manufacturer || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                      <span className="font-bold text-[#555555] uppercase w-36 shrink-0">MODEL</span>
                      <span className="text-[12px] text-[#222222] text-left flex-1 font-mono">{result.certificate.model || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                      <span className="font-bold text-[#555555] uppercase w-36 shrink-0">VALID FROM</span>
                      <span className="text-[12px] text-[#222222] text-left flex-1">{formatDate(result.certificate.valid_from)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                      <span className="font-bold text-[#555555] uppercase w-36 shrink-0">VALID UNTIL</span>
                      <span className="text-[12px] text-[#222222] text-left flex-1">{formatDate(result.certificate.valid_until)}</span>
                    </div>
                  </div>

                  {/* QR Code Block (Right Side) */}
                  <div className="w-[110px] shrink-0 flex flex-col items-center justify-center text-center space-y-1 self-center sm:self-start">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(`${window.location.origin}/verify-public?q=${result.certificate.qr_token || result.certificate.certificate_number}`)}`}
                      alt="QR Code"
                      className="w-[110px] h-[110px] object-contain border border-slate-200"
                    />
                    <p className="text-[9px] text-[#555555] font-sans text-center">Scan to verify authenticity</p>
                  </div>
                </div>

                {/* Footer: Signature + Issue Date */}
                <div className="pt-8 space-y-1">
                  <div className="w-44 border-b border-[#222222]" />
                  <p className="text-[10px] text-[#222222] font-sans font-normal pt-0.5">Authorised Signatory</p>
                  <p className="text-[9px] text-[#555555] font-sans">Issued on: {formatDate(result.certificate.issue_date || result.verification_date || result.certificate.valid_from)}</p>
                </div>

                {/* Disclaimer at Bottom */}
                <div className="pt-4 text-[8px] text-[#555555] font-sans">
                  This certificate is system-generated and can be verified online using the QR code or certificate number above.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
