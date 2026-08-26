import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { reportsApi } from '../api/reports.api';
import { instrumentsApi } from '../api/instruments.api';
import { applicationsApi } from '../api/applications.api';
import { verificationsApi } from '../api/verifications.api';
import { certificatesApi } from '../api/certificates.api';
import { 
  DashboardOverviewStats, 
  Instrument, 
  VerificationApplication, 
  Verification,
  VerificationCertificate 
} from '../types';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role_id || 'INSTRUMENT_OWNER';

  const [stats, setStats] = useState<DashboardOverviewStats | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [applications, setApplications] = useState<VerificationApplication[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [certificates, setCertificates] = useState<VerificationCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [role]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewStats, instList, appList, verList, certList] = await Promise.all([
        reportsApi.getDashboardOverview(role),
        instrumentsApi.listInstruments(),
        applicationsApi.listApplications(),
        verificationsApi.listVerifications(),
        certificatesApi.listCertificates(),
      ]);

      setStats(overviewStats);
      setInstruments(instList);
      setApplications(appList);
      setVerifications(verList);
      setCertificates(certList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
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
              <Link to="/verifications">
                <Button variant="primary" size="sm">
                  Conduct Field Verification
                </Button>
              </Link>
              <Link to="/applications">
                <Button variant="outline" size="sm">
                  Review Queue ({applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length})
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
              value={applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length}
              sublabel="Applications awaiting schedule"
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
              value="96.2%"
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

        {(role === 'ADMIN' || role === 'PUBLIC_USER') && (
          <>
            <StatCard
              label="National Grid Total"
              value={stats?.totalInstruments || 1124500}
              sublabel="Registered weighing units"
              variant="navy"
            />
            <StatCard
              label="Active Digital Certificates"
              value={stats?.activeCertificates || 959037}
              sublabel="Certified & QR-tagged"
              variant="emerald"
              trend={{ value: '94.4% pass', positive: true }}
            />
            <StatCard
              label="Open Workflows"
              value={stats?.pendingApplications || 14205}
              sublabel="Under review or scheduled"
              variant="amber"
            />
            <StatCard
              label="Avg Turnaround"
              value="41.5 hrs"
              sublabel="Application to Certificate"
            />
          </>
        )}
      </div>

      {/* Main Content Split: Applications & Quick Action Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Priority Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applications Section */}
          <Card
            title="Verification Applications"
            subtitle="Latest statutory verification requests and status progression"
            action={
              <Link to="/applications" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                View All ({applications.length}) →
              </Link>
            }
          >
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
                  {applications.slice(0, 4).map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pr-4 font-mono font-medium text-slate-900">
                        {app.application_number}
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
                        <Link
                          to={`/applications/${app.id}`}
                          className="text-xs font-medium text-pramaan-gold-700 hover:underline"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Instruments / Verifications Section */}
          <Card
            title={role === 'LMO' || role === 'GATC' ? 'Assigned Field Verifications' : 'Registered Instruments'}
            subtitle={role === 'LMO' || role === 'GATC' ? 'On-site verification logs and test readings' : 'Active weighing scales and measuring units'}
            action={
              <Link to={role === 'LMO' || role === 'GATC' ? '/verifications' : '/instruments'} className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                View All →
              </Link>
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
            subtitle="Tamper-proof QR certificates"
            action={
              <Link to="/certificates" className="text-xs font-semibold text-pramaan-navy-800 hover:underline">
                All ({certificates.length}) →
              </Link>
            }
          >
            <div className="space-y-3">
              {certificates.map((cert) => (
                <div key={cert.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-800">{cert.certificate_number}</span>
                    <Badge status={cert.status} size="sm" />
                  </div>
                  <p className="text-[11px] font-medium text-slate-700">{cert.instrument_name}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Valid until: <strong>{cert.valid_until}</strong></span>
                    <Link to={`/certificates/${cert.id}`} className="text-amber-700 font-semibold hover:underline">
                      View Seal →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
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
