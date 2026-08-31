import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { certificatesApi } from '../../api/certificates.api';
import { VerificationCertificate, CertificateStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const CertificatesListPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const isAuthorized = user?.role_id === 'ADMIN';

  const [certificates, setCertificates] = useState<VerificationCertificate[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<CertificateStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized) {
      loadCertificates();
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, selectedStatus, searchQuery]);

  const loadCertificates = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await certificatesApi.listCertificates({
        status: (selectedStatus as CertificateStatus) || undefined,
        search: searchQuery || undefined,
      });
      setCertificates(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load verification certificates.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingSpinner label="Authenticating permissions..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Digital Certificate registry management is restricted to Directorate Administrators. To verify an instrument certificate by QR code or serial number, please use the Public Citizen Portal."
          actionText="Open Citizen Verification Tool"
          onAction={() => navigate('/verify-public')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Digital Verification Certificates</h1>
          <p className="text-xs text-slate-500 mt-1">
            Statutory stamped verification certificates with encrypted QR tokens and validity periods.
          </p>
        </div>
        <Link to="/verify-public">
          <Button variant="accent" size="md">
            Public QR Lookup Tool
          </Button>
        </Link>
      </div>

      {/* Filter Card */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Certificate Records</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by certificate no. (CERT-LM-...), serial, owner..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Validity Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as CertificateStatus | '')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            >
              <option value="">All Certificates</option>
              <option value="ACTIVE">ACTIVE (Valid & Stamped)</option>
              <option value="EXPIRED">EXPIRED (Renewal Due)</option>
              <option value="REVOKED">REVOKED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Certificates Table */}
      {isLoading ? (
        <LoadingSpinner label="Loading certified records vault..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadCertificates} />
      ) : certificates.length === 0 ? (
        <EmptyState
          title="No Certificates Found"
          description="No digital certificates match your search filters."
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Certificate Number</th>
                  <th className="py-3.5 px-4">Instrument & Serial</th>
                  <th className="py-3.5 px-4">Owner / Trading Entity</th>
                  <th className="py-3.5 px-4">Validity Window</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Certificate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-mono">
                      <Link to={`/certificates/${cert.id}`} className="font-bold text-pramaan-navy-900 hover:underline">
                        {cert.certificate_number}
                      </Link>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">Issued: {cert.issue_date}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{cert.instrument_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{cert.instrument_serial}</div>
                      <div className="text-[11px] text-slate-500">{cert.capacity} {cert.capacity_unit} ({cert.accuracy_class.split(' ')[0]})</div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-900">{cert.owner_name}</p>
                      <p className="text-[11px] text-slate-500">{cert.owner_organization}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-800">Until: <strong className="text-slate-900">{cert.valid_until}</strong></p>
                      <p className="text-[10px] text-slate-400">From: {cert.valid_from}</p>
                    </td>
                    <td className="py-4 px-4">
                      <Badge status={cert.status} size="sm" />
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Link to={`/certificates/${cert.id}`}>
                        <Button variant="primary" size="sm">
                          View Certificate 📜
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
