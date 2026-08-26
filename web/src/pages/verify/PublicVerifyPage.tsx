import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { certificatesApi } from '../../api/certificates.api';
import { PublicVerificationLookupResult } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PramaanLogo } from '../../components/common/PramaanLogo';

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
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <PramaanLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Public Certificate & QR Authentication
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
          Verify the authenticity and legal calibration status of any weighing or measuring instrument across India.
        </p>
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
              <div className="shrink-0 text-2xl mt-0.5">
                {result.result === 'VALID' ? '🛡️' : result.result === 'EXPIRED' ? '⚠️' : '❌'}
              </div>
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
              <Link to={`/certificates/${result.certificate.id}`} className="shrink-0">
                <Button variant="primary" size="sm">
                  View Full Legal Certificate 📜
                </Button>
              </Link>
            )}
          </div>

          {/* Authenticated Instrument Specs */}
          {result.authenticated && result.certificate && result.instrument && (
            <Card title="Authenticated Equipment Details" subtitle="Records retrieved from National Metrology Directory">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Instrument Name:</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{result.instrument.instrument_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Stamped Serial Number:</span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{result.instrument.serial_number}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Capacity & Accuracy Class:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {result.instrument.capacity} {result.instrument.capacity_unit} ({result.instrument.accuracy_class})
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Certificate Validity Window:</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {result.certificate.valid_from} to {result.certificate.valid_until}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2">
                  <span className="text-slate-500 block text-[11px]">Trading Custodian & Mandi Location:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {result.owner_name} ({result.owner_organization})
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">{result.instrument.location_address}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Issuing Metrology Officer:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{result.officer_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[11px]">Verification Stamped Date:</span>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5">{result.verification_date}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
