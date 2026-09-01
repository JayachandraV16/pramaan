import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { certificatesApi } from '../../api/certificates.api';
import { instrumentsApi } from '../../api/instruments.api';
import { applicationsApi } from '../../api/applications.api';
import { VerificationCertificate } from '../../types';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
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

export const CertificateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [cert, setCert] = useState<VerificationCertificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && id) {
      loadCertificate(id);
    }
  }, [isAuthLoading, id]);

  const loadCertificate = async (certId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, insts, apps] = await Promise.all([
        certificatesApi.getCertificateById(certId),
        instrumentsApi.listInstruments().catch(() => []),
        applicationsApi.listApplications().catch(() => []),
      ]);

      if (!data) {
        setError('Verification certificate record not found.');
      } else {
        const matchingInst = insts.find(i => i.id === data.instrument_id || (data.instrument_serial && i.serial_number === data.instrument_serial));
        const matchingApp = apps.find(a => (matchingInst && a.instrument_id === matchingInst.id) || (data.instrument_serial && a.instrument_serial === data.instrument_serial));

        const resolvedModel = data.model || matchingInst?.model || (matchingInst as any)?.instrument_model;
        const resolvedManufacturer = data.manufacturer || matchingInst?.manufacturer;
        const resolvedInstrumentName = data.instrument_name !== 'Certified Metrology Asset' ? data.instrument_name : matchingInst?.instrument_name || matchingApp?.instrument_name || data.instrument_name;

        setCert({
          ...data,
          model: resolvedModel || data.model,
          manufacturer: resolvedManufacturer || data.manufacturer,
          instrument_name: resolvedInstrumentName,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve certificate.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner label="Retrieving digital verification certificate..." />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage message={error || 'Certificate not found'} onRetry={() => id && loadCertificate(id)} />
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => navigate('/verify-public')}>
            Verify Another Certificate
          </Button>
          {user?.role_id === 'ADMIN' && (
            <Button variant="secondary" onClick={() => navigate('/certificates')}>
              ← Back to Certificates
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Action Bar */}
      <div className="no-print flex items-center justify-between">
        {user?.role_id === 'ADMIN' ? (
          <Link to="/certificates" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
            ← Back to Certificates Vault
          </Link>
        ) : (
          <Link to="/verify-public" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
            ← Back to Verify documents
          </Link>
        )}
        <div>
          <a
            href={getFileUrl(cert.certificate_file_url || `/uploads/certificates/${cert.certificate_number}.pdf`)}
            target="_blank"
            rel="noreferrer"
            download={`${cert.certificate_number}.pdf`}
            onClick={(e) => {
              if (!cert.certificate_file_url) {
                e.preventDefault();
                window.print();
              }
            }}
          >
            <Button variant="primary" size="sm">
              Download PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Official Certificate Paper Container — Exactly matching official PDF Layout */}
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
              <h1 className="text-2xl sm:text-[24px] font-bold text-[#1a3a5c] font-sans tracking-tight leading-none">
                CERTIFICATE OF VERIFICATION
              </h1>
              <p className="text-[10px] text-[#555555] font-sans font-medium">
                Legal Metrology — Weighing & Measuring Instruments
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-b border-[#cccccc] w-full" />

          {/* Certificate Number */}
          <div className="text-[11px] text-[#222222] font-sans pt-1">
            Certificate No: <strong className="font-bold text-[#222222] font-mono">{cert.certificate_number || 'N/A'}</strong>
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
                <span className="text-[12px] text-[#222222] text-left flex-1">{cert.instrument_name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                <span className="font-bold text-[#555555] uppercase w-36 shrink-0">MANUFACTURER</span>
                <span className="text-[12px] text-[#222222] text-left flex-1">{cert.manufacturer || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                <span className="font-bold text-[#555555] uppercase w-36 shrink-0">MODEL</span>
                <span className="text-[12px] text-[#222222] text-left flex-1 font-mono">{cert.model || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                <span className="font-bold text-[#555555] uppercase w-36 shrink-0">VALID FROM</span>
                <span className="text-[12px] text-[#222222] text-left flex-1">{formatDate(cert.valid_from)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#cccccc]">
                <span className="font-bold text-[#555555] uppercase w-36 shrink-0">VALID UNTIL</span>
                <span className="text-[12px] text-[#222222] text-left flex-1">{formatDate(cert.valid_until)}</span>
              </div>
            </div>

            {/* QR Code Block (Right Side) */}
            <div className="w-[110px] shrink-0 flex flex-col items-center justify-center text-center space-y-1 self-center sm:self-start">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(`${window.location.origin}/verify-public?q=${cert.qr_token || cert.certificate_number}`)}`}
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
            <p className="text-[9px] text-[#555555] font-sans">Issued on: {formatDate(cert.issue_date || cert.created_at || cert.valid_from)}</p>
          </div>

          {/* Disclaimer at Bottom */}
          <div className="pt-4 text-[8px] text-[#555555] font-sans">
            This certificate is system-generated and can be verified online using the QR code or certificate number above.
          </div>
        </div>
      </div>
    </div>
  );
};
