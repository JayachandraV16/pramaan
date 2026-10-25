import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { getFileUrl } from '../api/client';
import { reportsApi } from '../api/reports.api';
import { instrumentsApi } from '../api/instruments.api';
import { applicationsApi } from '../api/applications.api';
import { assignmentsApi } from '../api/assignments.api';
import { verificationsApi } from '../api/verifications.api';
import { certificatesApi } from '../api/certificates.api';
import { 
  DashboardOverviewStats, 
  Instrument, 
  VerificationApplication, 
  VerificationAssignment, 
  Verification, 
  VerificationCertificate 
} from '../types';

export const DashboardPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const role = user?.role_id;

  const [stats, setStats] = useState<DashboardOverviewStats | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [applications, setApplications] = useState<VerificationApplication[]>([]);
  const [assignments, setAssignments] = useState<VerificationAssignment[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [certificates, setCertificates] = useState<VerificationCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actioningAssignmentId, setActioningAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user && role) {
      loadDashboardData();
    }
  }, [isAuthLoading, user, role]);

  const handleUpdateAssignmentStatus = async (assignmentId: string, status: 'ACCEPTED' | 'DECLINED') => {
    setActioningAssignmentId(assignmentId);
    try {
      await assignmentsApi.updateAssignmentStatus(assignmentId, status);
      await loadDashboardData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update assignment status.');
    } finally {
      setActioningAssignmentId(null);
    }
  };

  const loadDashboardData = async () => {
    if (!role) return;
    setIsLoading(true);
    setError(null);
    try {
      const overviewStats = await reportsApi.getDashboardOverview(role).catch(() => null);

      let instList: Instrument[] = [];
      let appList: VerificationApplication[] = [];
      let assignList: VerificationAssignment[] = [];
      let verList: Verification[] = [];
      let certList: VerificationCertificate[] = [];

      if (role === 'INSTRUMENT_OWNER') {
        [instList, appList, certList] = await Promise.all([
          instrumentsApi.listInstruments().catch(() => []),
          applicationsApi.listApplications().catch(() => []),
          certificatesApi.listCertificates().catch(() => []),
        ]);
      } else if (role === 'LMO') {
        [assignList, verList] = await Promise.all([
          assignmentsApi.listAssignments().catch(() => []),
          verificationsApi.listVerifications().catch(() => []),
        ]);
      } else if (role === 'GATC') {
        [appList, assignList, verList] = await Promise.all([
          applicationsApi.listApplications().catch(() => []),
          assignmentsApi.listAssignments().catch(() => []),
          verificationsApi.listVerifications().catch(() => []),
        ]);
      } else if (role === 'ADMIN') {
        [instList, appList, assignList, verList, certList] = await Promise.all([
          instrumentsApi.listInstruments().catch(() => []),
          applicationsApi.listApplications().catch(() => []),
          assignmentsApi.listAssignments().catch(() => []),
          verificationsApi.listVerifications().catch(() => []),
          certificatesApi.listCertificates().catch(() => []),
        ]);
      }

      setStats(overviewStats);
      setInstruments(instList);
      setApplications(appList);
      setAssignments(assignList);
      setVerifications(verList);
      setCertificates(certList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingSpinner size="lg" label="Loading role-specific dashboard metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ErrorMessage message={error} onRetry={loadDashboardData} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header with User Info & Role Badge */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-gov">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome, {user?.full_name || 'Officer'}
            </h1>
            <Badge status={role} size="md" />
          </div>
          <p className="text-xs text-slate-500">
            {user?.organization_name ? `${user.organization_name} • ` : ''}
            {user?.address || 'Jurisdiction Zone 4'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {role === 'INSTRUMENT_OWNER' && (
            <>
              <Link to="/instruments/new">
                <Button variant="outline" size="sm">
                  + Add Instrument
                </Button>
              </Link>
              <Link to="/applications/new">
                <Button variant="accent" size="sm">
                  Apply for Verification
                </Button>
              </Link>
            </>
          )}

          {(role === 'LMO' || role === 'GATC') && (
            <>
              <Link to="/assignments">
                <Button variant="accent" size="sm">
                  My Assignments ({assignments.filter(a => a.status === 'ASSIGNED' || a.status === 'ACCEPTED').length})
                </Button>
              </Link>
              <Link to="/verifications">
                <Button variant="primary" size="sm">
                  Conduct Field Verification
                </Button>
              </Link>
            </>
          )}

          {role === 'ADMIN' && (
            <>
              <Link to="/certificates">
                <Button variant="outline" size="sm">
                  All Certificates ({certificates.length})
                </Button>
              </Link>
              <Link to="/verify-public">
                <Button variant="accent" size="sm">
                  Public QR Scanner
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Role-Specific KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'INSTRUMENT_OWNER' && (
          <>
            <StatCard
              label="My Instruments"
              value={instruments.length}
              sublabel="Active & Registered assets"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatCard
              label="Active Certificates"
              value={certificates.filter(c => c.status === 'ACTIVE').length}
              sublabel="Fully compliant with stamps"
              variant="navy"
              trend={{ value: '100% compliant', positive: true }}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
            <StatCard
              label="Pending Applications"
              value={applications.filter(a => a.status !== 'COMPLETED' && a.status !== 'REJECTED').length}
              sublabel="Scheduled or Under Review"
              variant="amber"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Expired / Due"
              value={certificates.filter(c => c.status === 'EXPIRED').length}
              sublabel="Needs immediate re-verification"
              variant="default"
              icon={
                <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </>
        )}

        {(role === 'LMO' || role === 'GATC') && (
          <>
            <StatCard
              label="Assigned Queue"
              value={assignments.filter(a => a.status === 'ASSIGNED' || a.status === 'ACCEPTED').length}
              sublabel="Allocated verification tasks"
              variant="amber"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <StatCard
              label="In-Progress Inspections"
              value={verifications.filter(v => v.status === 'IN_PROGRESS').length}
              sublabel="Field readings pending completion"
              variant="navy"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            />
            <StatCard
              label="Completed Verifications"
              value={verifications.filter(v => v.status === 'COMPLETED').length}
              sublabel="This Month"
              trend={{ value: '+12% vs last month', positive: true }}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <StatCard
              label="Pass Rate"
              value={stats?.passRatePercentage !== undefined ? `${stats.passRatePercentage}%` : '—'}
              sublabel="Permissible error tolerance rate"
              variant="emerald"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </>
        )}

        {role === 'ADMIN' && (
          <>
            <StatCard
              label="National Grid Total"
              value={stats?.totalInstruments !== undefined ? stats.totalInstruments.toLocaleString() : role === 'ADMIN' && instruments.length > 0 ? instruments.length.toLocaleString() : '—'}
              sublabel="Registered weighing units"
              variant="navy"
            />
            <StatCard
              label="Active Digital Certificates"
              value={stats?.activeCertificates !== undefined ? stats.activeCertificates.toLocaleString() : role === 'ADMIN' && certificates.length > 0 ? certificates.filter(c => c.status === 'ACTIVE').length.toLocaleString() : '—'}
              sublabel="Certified & QR-tagged"
              variant="navy"
            />
            <StatCard
              label="Open Workflows"
              value={stats?.pendingApplications !== undefined ? stats.pendingApplications.toLocaleString() : role === 'ADMIN' && applications.length > 0 ? applications.filter(a => a.status !== 'COMPLETED' && a.status !== 'REJECTED').length.toLocaleString() : '—'}
              sublabel="Applications in verification pipeline"
              variant="amber"
            />
            <StatCard
              label="Avg Turnaround"
              value={stats?.avgTurnaround || '—'}
              sublabel="Application to Certificate"
            />
          </>
        )}
      </div>

      {/* Main Content Split: Applications & Quick Action Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Priority Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* For LMO and GATC: Assigned Applications Queue */}
          {(role === 'LMO' || role === 'GATC') && (
            <Card
              title="Allocated Application Queue"
              subtitle="Verification tasks assigned to you by Legal Metrology Directorate"
              action={
                <Link to="/assignments" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  View All ({assignments.length}) →
                </Link>
              }
            >
              {assignments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No applications assigned yet. Check back when Administrator allocates an application.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                        <th className="pb-3 pr-3">Application & Instrument</th>
                        <th className="pb-3 px-3">Owner / Trader & Location</th>
                        <th className="pb-3 px-3">Assigned By</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 pl-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignments
                        .filter(a => a.status !== 'COMPLETED' && a.application_status !== 'COMPLETED' && a.status !== 'DECLINED')
                        .slice(0, 5)
                        .map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Col 1: Application & Instrument */}
                          <td className="py-3 pr-3 font-medium text-slate-900">
                            <Link to={`/applications/${a.application_id}`} className="hover:underline font-mono font-bold text-pramaan-navy-900">
                              {a.application_number || a.application_id}
                            </Link>
                            {a.instrument_name && (
                              <p className="font-semibold text-slate-800 text-[11px] mt-0.5">
                                {a.instrument_name}
                              </p>
                            )}
                            {a.instrument_serial && (
                              <p className="font-mono text-[10px] text-slate-400">
                                SN: {a.instrument_serial}
                              </p>
                            )}
                            {a.application_type && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                                  {a.application_type === 'RE_VERIFICATION' ? 'Re-Verification' : 'Fresh Verification'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Col 2: Owner / Trader & Location */}
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">
                              {a.owner_name || '—'}
                            </p>
                            {a.owner_organization && (
                              <p className="text-[11px] text-slate-600">
                                {a.owner_organization}
                              </p>
                            )}
                            {a.owner_phone && (
                              <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                                <a href={`tel:${a.owner_phone}`} className="hover:underline">
                                  {a.owner_phone}
                                </a>
                              </p>
                            )}
                            {a.location_address && (
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                {a.location_address}
                              </p>
                            )}
                          </td>

                          {/* Col 3: Assigned By */}
                          <td className="py-3 px-3 text-slate-700">
                            <p className="font-medium text-slate-900">{a.assigned_by_name || 'Admin Directorate'}</p>
                            <p className="text-[10px] text-slate-400">
                              {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                            </p>
                          </td>

                          {/* Col 4: Status */}
                          <td className="py-3 px-3">
                            <Badge status={a.status} size="sm" />
                          </td>

                          {/* Col 5: Action */}
                          <td className="py-3 pl-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {a.status === 'ASSIGNED' ? (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    isLoading={actioningAssignmentId === a.id}
                                    onClick={() => handleUpdateAssignmentStatus(a.id, 'ACCEPTED')}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    isLoading={actioningAssignmentId === a.id}
                                    onClick={() => handleUpdateAssignmentStatus(a.id, 'DECLINED')}
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : a.status === 'ACCEPTED' && a.application_status !== 'COMPLETED' ? (
                                <Link to="/assignments">
                                  <Button variant="accent" size="sm">
                                    Start →
                                  </Button>
                                </Link>
                              ) : (
                                <Link to={`/applications/${a.application_id}`}>
                                  <Button variant="outline" size="sm">
                                    Details →
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Applications Section for Owners and Admins */}
          {(role === 'INSTRUMENT_OWNER' || role === 'ADMIN') && (
            <Card
              title={role === 'INSTRUMENT_OWNER' ? 'My Verification Applications' : 'Verification Applications'}
              subtitle="Latest statutory verification requests and status progression"
              action={
                <Link to="/applications" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  View All ({applications.length}) →
                </Link>
              }
            >
              {applications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No verification applications submitted yet. Click &quot;Apply for Verification&quot; to begin.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                        <th className="pb-3 pr-4">App Number</th>
                        <th className="pb-3 px-4">Instrument</th>
                        <th className="pb-3 px-4">Type</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 pl-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {applications.slice(0, 5).map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pr-4 font-mono font-medium text-slate-900">
                            <Link to={`/applications/${app.id}`} className="hover:underline font-bold text-pramaan-navy-900">
                              {app.application_number}
                            </Link>
                            {app.assignment?.assigned_to_name && (
                              <div className="text-[10px] text-emerald-700 font-sans">
                                Assigned: {app.assignment.assigned_to_name}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{app.instrument_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{app.instrument_serial}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-600">
                              {app.application_type === 'RE_VERIFICATION' ? 'Re-Verification' : 'Fresh Verification'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge status={app.status} size="sm" />
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {app.certificate_id ? (
                                <Link to={`/certificates/${app.certificate_id}`}>
                                  <Button variant="accent" size="sm">
                                    Certificate
                                  </Button>
                                </Link>
                              ) : (
                                <Link to={`/applications/${app.id}`}>
                                  <Button variant="outline" size="sm">
                                    Track →
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Instruments / Verifications Section */}
          <Card
            title={role === 'LMO' || role === 'GATC' ? 'Assigned Field Verifications' : 'Registered Instruments'}
            subtitle={role === 'LMO' || role === 'GATC' ? 'On-site verification logs and test readings' : 'Active weighing scales and measuring units'}
            action={
              role === 'LMO' || role === 'GATC' ? (
                <Link to="/verifications" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  View All ({verifications.length}) →
                </Link>
              ) : (
                <Link to="/instruments" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  View All ({instruments.length}) →
                </Link>
              )
            }
          >
            {role === 'LMO' || role === 'GATC' ? (
              <div className="space-y-3">
                {verifications.map((ver) => (
                  <div key={ver.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{ver.instrument_name}</h4>
                        <Badge status={ver.status} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-500">{ver.location}</p>
                      <p className="text-[10px] text-slate-400">
                        {ver.readings.length} measurement points recorded • {ver.observations.length} seal observations
                      </p>
                    </div>
                    <Link to={`/verifications/${ver.id}`}>
                      <Button variant="primary" size="sm">
                        {ver.status === 'IN_PROGRESS' ? 'Record Readings' : 'View Record'}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {instruments.slice(0, 4).map((inst) => (
                  <div key={inst.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-colors space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{inst.instrument_name}</h4>
                      <Badge status={inst.status} size="sm" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Cap: <strong>{inst.capacity} {inst.capacity_unit}</strong> • {inst.accuracy_class.split(' ')[0]}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-400">{inst.serial_number}</span>
                      <Link to={`/instruments/${inst.id}`} className="text-pramaan-navy-900 font-semibold hover:underline">
                        Specs →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Certificates & Recent Activity */}
        <div className="space-y-6">
          {/* Active Certificates Quick Vault */}
          <Card
            title="Digital Certificates Vault"
            subtitle={role === 'INSTRUMENT_OWNER' ? 'My Issued Verification Certificates' : 'Tamper-proof QR certificates'}
            action={
              role === 'ADMIN' ? (
                <Link to="/certificates" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  All ({certificates.length}) →
                </Link>
              ) : (
                <Link to="/verify-public" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                  Verify QR →
                </Link>
              )
            }
          >
            {certificates.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">No Certificates Issued Yet</p>
                <p className="text-[11px] text-slate-400">
                  {role === 'INSTRUMENT_OWNER'
                    ? 'Once your verification passes and Administrator generates the certificate, it will appear here.'
                    : 'Awaiting certificate generations.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {certificates.slice(0, 5).map((cert) => (
                  <div key={cert.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-pramaan-navy-950">{cert.certificate_number}</span>
                      <Badge status={cert.status} size="sm" />
                    </div>
                    <p className="text-xs font-medium text-slate-800 truncate">{cert.instrument_name}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/70">
                      <span>Valid: <strong className="text-slate-800">{cert.valid_until}</strong></span>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/certificates/${cert.id}`}>
                          <Button variant="primary" size="sm">
                            View
                          </Button>
                        </Link>
                        <a
                          href={getFileUrl(cert.certificate_file_url || `/uploads/certificates/${cert.certificate_number}.pdf`)}
                          target="_blank"
                          rel="noreferrer"
                          download={`${cert.certificate_number}.pdf`}
                        >
                          <Button variant="outline" size="sm">
                            PDF
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Department Activity Feed */}
          <Card title="Statutory Activity Feed" subtitle="Real-time audit log">
            <div className="space-y-3">
              {stats?.recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="space-y-0.5 flex-1">
                    <p className="font-semibold text-slate-900">{act.title}</p>
                    <p className="text-slate-500 text-[11px]">{act.description}</p>
                    <p className="text-[10px] text-slate-400">{act.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
