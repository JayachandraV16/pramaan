import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { verificationsApi } from '../../api/verifications.api';
import { Verification, VerificationStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const VerificationsListPage: React.FC = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<VerificationStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVerifications();
  }, [selectedStatus, searchQuery]);

  const loadVerifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await verificationsApi.listVerifications({
        status: (selectedStatus as VerificationStatus) || undefined,
        search: searchQuery || undefined,
      });
      setVerifications(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load field verification records.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Field Verifications & Inspections</h1>
          <p className="text-xs text-slate-500 mt-1">
            Physical calibration readings, load-point tolerances, and qualitative seal integrity records.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Verification Logs</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by instrument name, serial no, location..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Inspection Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as VerificationStatus | '')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            >
              <option value="">All Verification Activities</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Readings being recorded)</option>
              <option value="COMPLETED">COMPLETED (Decision Stamped)</option>
              <option value="ABORTED">ABORTED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Verifications Table */}
      {isLoading ? (
        <LoadingSpinner label="Fetching verification log records..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadVerifications} />
      ) : verifications.length === 0 ? (
        <EmptyState
          title="No Verifications Found"
          description="No field verification activities match your current search filters."
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Instrument Under Test</th>
                  <th className="py-3.5 px-4">Verification Date</th>
                  <th className="py-3.5 px-4">Testing Officer</th>
                  <th className="py-3.5 px-4">Measurements & Observations</th>
                  <th className="py-3.5 px-4">Decision Outcome</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifications.map((ver) => (
                  <tr key={ver.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{ver.instrument_name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{ver.instrument_serial}</div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xs">{ver.location}</div>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800">
                      <p>{ver.verification_date}</p>
                      <Badge status={ver.status} size="sm" className="mt-1" />
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-900">{ver.performed_by_name || 'Assigned LMO'}</p>
                      <p className="text-[10px] text-slate-500">Legal Metrology Directorate</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {ver.readings.length} Load Readings
                        </span>
                        <span className="inline-block ml-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {ver.observations.length} Qualitative Checks
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {ver.result ? (
                        <Badge status={ver.result.decision} size="md">
                          {ver.result.decision === 'PASS' ? 'PASSED ✓' : 'FAILED ✗'}
                        </Badge>
                      ) : (
                        <span className="text-amber-700 font-medium text-[11px]">Under Testing</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link to={`/verifications/${ver.id}`}>
                        <Button
                          variant={ver.status === 'IN_PROGRESS' ? 'primary' : 'outline'}
                          size="sm"
                        >
                          {ver.status === 'IN_PROGRESS' ? 'Enter Readings' : 'View Record →'}
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
