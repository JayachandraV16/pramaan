import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { certificatesApi } from '../../api/certificates.api';
import { VerificationCertificate } from '../../types';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { PramaanLogo } from '../../components/common/PramaanLogo';

export const CertificateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized = user?.role_id === 'ADMIN';

  const [cert, setCert] = useState<VerificationCertificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized && id) {
      loadCertificate(id);
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, id]);

  const loadCertificate = async (certId: string) => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await certificatesApi.getCertificateById(certId);
      if (!data) {
        setError('Verification certificate record not found.');
      } else {
        setCert(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve certificate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner label="Retrieving digital verification certificate..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Digital Certificate registry is restricted to Directorate Administrators. To verify an instrument certificate by QR code or serial number, please use the Public Citizen Portal."
          actionText="Open Citizen Verification Tool"
          onAction={() => navigate('/verify-public')}
        />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage message={error || 'Certificate not found'} onRetry={() => id && loadCertificate(id)} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/certificates')}>
            ← Back to Certificates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print flex items-center justify-between">
        <Link to="/certificates" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          ← Back to Certificates Vault
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/verify-public?q=${cert.certificate_number}`}>
            <Button variant="outline" size="sm">
              Public QR Scan View
            </Button>
          </Link>
          <Button variant="accent" size="sm" onClick={handlePrint}>
            🖨️ Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Official Certificate Paper Container */}
      <div className="certificate-container bg-white border-4 border-pramaan-navy-950 rounded-2xl p-8 sm:p-12 shadow-2xl relative overflow-hidden certificate-watermark">
        {/* Decorative Corner Ornaments */}
        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-pramaan-gold-600 pointer-events-none" />
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-pramaan-gold-600 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-pramaan-gold-600 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-pramaan-gold-600 pointer-events-none" />

        {/* Certificate Header */}
        <div className="text-center space-y-2 border-b-2 border-slate-200 pb-6 mb-6">
          <div className="flex justify-center mb-2">
            <PramaanLogo size="lg" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
            GOVERNMENT OF INDIA • DIRECTORATE OF LEGAL METROLOGY
          </p>
          <p className="text-[11px] text-slate-500">
            Department of Consumer Affairs, Food & Public Distribution
          </p>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-pramaan-navy-950 pt-2 font-serif">
            Certificate of Verification & Stamping
          </h1>
          <p className="text-[11px] text-slate-600 max-w-xl mx-auto italic">
            Issued under Section 24 of the Legal Metrology Act, 2009 (Act No. 1 of 2010) read with Rule 14 of the Legal Metrology (General) Rules, 2011.
          </p>
        </div>

        {/* Certificate Number & Status Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Official Certificate Number:</span>
            <span className="font-mono font-bold text-base text-pramaan-navy-950 tracking-wider">
              {cert.certificate_number}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Validity Period:</span>
              <span className="font-semibold text-slate-900">{cert.valid_from} to {cert.valid_until}</span>
            </div>
            <Badge status={cert.status} size="lg" />
          </div>
        </div>

        {/* Certified Body / Specifications */}
        <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
          <p>
            This is to certify that the weighing / measuring instrument described hereunder has been tested, calibrated, verified, and stamped by the authorized Legal Metrology Officer in accordance with the permissible Maximum Permissible Error (MPE) tolerances prescribed in Schedule IX of the Legal Metrology (General) Rules, 2011:
          </p>

          {/* Instrument Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <span className="text-slate-500 block text-[11px]">Instrument Nomenclature:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{cert.instrument_name}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Classification / Type:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{cert.instrument_type_name}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">OEM Serial Number:</span>
              <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{cert.instrument_serial}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Accuracy Class:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{cert.accuracy_class}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Max Measurable Capacity:</span>
              <p className="font-bold text-slate-900 mt-0.5">{cert.capacity} {cert.capacity_unit}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Jurisdiction Division:</span>
              <p className="font-medium text-slate-800 mt-0.5">{cert.jurisdiction_zone}</p>
            </div>
          </div>

          {/* Custody / Location */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-slate-500 block text-[11px]">Issued In Custody of:</span>
            <p className="font-bold text-slate-900 text-sm mt-0.5">{cert.owner_name} ({cert.owner_organization})</p>
            <p className="text-slate-600 text-[11px] mt-0.5">{cert.location_address}</p>
          </div>
        </div>

        {/* Security QR Token & Verification Officer Signature */}
        <div className="mt-8 pt-6 border-t-2 border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* QR Code */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white border-2 border-slate-900 rounded-xl shadow-xs shrink-0">
              {/* SVG QR Code Simulation */}
              <svg className="w-16 h-16 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h2v2h-2v-2zm-4 0h2v2h-2v-2zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 0h2v2h-2v-2zm-2-2h2v2h-2v-2zm6-6h2v2h-2v-2zm-4 0h2v2h-2v-2zm2 2h2v2h-2v-2z" />
              </svg>
            </div>
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <span className="font-bold text-slate-800 uppercase block">Digital Security Token</span>
              <p className="font-mono text-emerald-800">{cert.qr_token}</p>
              <p className="text-slate-400">Scan via mobile camera to authenticate authenticity against national ledger.</p>
            </div>
          </div>

          {/* Officer Stamp */}
          <div className="text-right space-y-1 text-xs">
            <div className="inline-block p-2 rounded-lg border border-amber-300 bg-amber-50/60 text-center mb-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">
                ✓ DIGITALLY STAMPED & VERIFIED
              </span>
              <span className="text-[9px] text-amber-700 font-mono">Date: {cert.issue_date}</span>
            </div>
            <p className="font-bold text-slate-900">{cert.issued_by_name}</p>
            <p className="text-slate-500 text-[11px]">{cert.issued_by_designation}</p>
            <p className="text-[10px] text-slate-400">Directorate of Legal Metrology, Government of India</p>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
          This is a system-generated statutory digital certificate authenticated with encrypted QR verification tokens under the Legal Metrology Act, 2009.
        </div>
      </div>
    </div>
  );
};
