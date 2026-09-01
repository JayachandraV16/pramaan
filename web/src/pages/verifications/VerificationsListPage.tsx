import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { verificationsApi } from '../../api/verifications.api';
import { applicationsApi } from '../../api/applications.api';
import { instrumentsApi } from '../../api/instruments.api';
import { Verification, VerificationStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const VerificationsListPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const isAuthorized = user?.role_id === 'LMO' || user?.role_id === 'GATC' || user?.role_id === 'ADMIN';

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<VerificationStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized) {
      loadVerifications();
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, selectedStatus, searchQuery]);

  const loadVerifications = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const [list, apps, insts] = await Promise.all([
        verificationsApi.listVerifications({
          status: (selectedStatus as VerificationStatus) || undefined,
          search: searchQuery || undefined,
        }),
        applicationsApi.listApplications().catch(() => []),
        instrumentsApi.listInstruments().catch(() => []),
      ]);

      const enriched = list.map((v) => {
        const matchingApp = apps.find(a => a.id === v.application_id);
        const matchingInst = insts.find(i => (matchingApp && i.id === matchingApp.instrument_id) || (v.instrument_serial && i.serial_number === v.instrument_serial));

        const resolvedOwner = [
          v.owner_name,
          matchingApp?.owner_name,
          matchingApp?.applicant_name,
          matchingInst?.owner_name,
        ].find(n => n && n !== '—' && n !== 'Registered Owner' && n !== 'Instrument Custodian');

        const resolvedOrg = v.owner_organization || matchingApp?.owner_organization || matchingApp?.applicant_organization || matchingInst?.owner_organization;
        const resolvedAddress = [
          v.location_address,
          v.location,
          matchingApp?.location_address,
          matchingInst?.location_address,
          matchingInst?.owner_address,
        ].find(loc => loc && loc !== '—' && loc !== 'Registered Location' && loc !== 'Inspection Premises');

        const resolvedInstName = v.instrument_name !== 'Instrument' ? v.instrument_name : matchingApp?.instrument_name || matchingInst?.instrument_name || 'Weighing Instrument';
        const resolvedInstSerial = v.instrument_serial || matchingApp?.instrument_serial || matchingInst?.serial_number;

        return {
          ...v,
          owner_name: resolvedOwner || v.owner_name || '—',
          owner_organization: resolvedOrg,
          location_address: resolvedAddress || v.location_address,
          location: resolvedAddress || v.location,
          instrument_name: resolvedInstName,
          instrument_serial: resolvedInstSerial || v.instrument_serial,
        };
      });

      setVerifications(enriched);
    } catch (err: any) {
      setError(err?.message || 'Failed to load field verification records.');
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
          description="Field Verifications & Inspections are restricted to Legal Metrology Officers, Approved Test Centres (GATC), and Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

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
                    {/* Col 1: Instrument Under Test */}
                    <td className="py-4 px-4">
                      <Link to={`/verifications/${ver.id}`} className="font-bold text-slate-900 text-sm hover:underline">
                        {ver.instrument_name}
                      </Link>
                      {ver.instrument_serial && (
                        <p className="font-mono text-[10px] text-slate-500">
                          SN: {ver.instrument_serial}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-700 mt-0.5">
                        Owner: <strong>{ver.owner_name || '—'}</strong>
                        {ver.owner_organization ? ` (${ver.owner_organization})` : ''}
                      </p>
                      {ver.location && (
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {ver.location}
                        </p>
                      )}
                    </td>

                    {/* Col 2: Verification Date & Status */}
                    <td className="py-4 px-4 font-medium text-slate-800">
                      <p className="font-mono text-[11px]">{ver.verification_date}</p>
                      <Badge status={ver.status} size="sm" className="mt-1" />
                    </td>

                    {/* Col 3: Testing Officer */}
                    <td className="py-4 px-4">
                      <p className="font-semibold text-slate-900">{ver.performed_by_name || 'Assigned LMO'}</p>
                      <p className="text-[10px] text-slate-500">Legal Metrology Directorate</p>
                    </td>

                    {/* Col 4: Measurements & Observations */}
                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        {ver.readings && ver.readings.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {ver.readings.length} Test Load{ver.readings.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono">
                              ({ver.readings.map(r => `${r.observed_value} ${r.unit}`).slice(0, 2).join(', ')}{ver.readings.length > 2 ? '...' : ''})
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block text-[10px] text-slate-400">
                            No load readings recorded yet
                          </span>
                        )}

                        {ver.observations && ver.observations.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {ver.observations.length} Seal Check{ver.observations.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-[10px] text-slate-600 font-medium">
                              ({ver.observations.map(o => o.observed_value).slice(0, 2).join(', ')})
                            </span>
                          </div>
                        ) : (
                          <span className="block text-[10px] text-slate-400">
                            No qualitative checks recorded
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col 5: Decision Outcome */}
                    <td className="py-4 px-4">
                      {ver.result ? (
                        <div className="space-y-1">
                          <Badge status={ver.result.decision} size="md">
                            {ver.result.decision === 'PASS' ? 'PASSED' : 'FAILED'}
                          </Badge>
                          {ver.result.remarks && (
                            <p className="text-[10px] text-slate-600 line-clamp-1">
                              {ver.result.remarks}
                            </p>
                          )}
                          {ver.result.decided_by_name && (
                            <p className="text-[9px] text-slate-400 font-mono">
                              Officer: {ver.result.decided_by_name}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Under Testing
                        </span>
                      )}
                    </td>

                    {/* Col 6: Action */}
                    <td className="py-4 px-4 text-right">
                      <Link to={`/verifications/${ver.id}`}>
                        <Button
                          variant={ver.status === 'IN_PROGRESS' ? 'primary' : 'outline'}
                          size="sm"
                        >
                          {ver.status === 'IN_PROGRESS' ? 'Record Readings' : 'View Record →'}
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
