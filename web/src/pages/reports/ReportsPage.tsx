import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsExtraApi, ReportSummary, ExportDataset } from '../../api/workflow.api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';

const DATASETS: Array<{ id: ExportDataset; title: string; hint: string }> = [
  { id: 'applications', title: 'Applications', hint: 'Status, instrument, applicant, fees' },
  { id: 'certificates', title: 'Certificates', hint: 'Numbers, validity, status, hashes' },
  { id: 'verifications', title: 'Field verifications', hint: 'Officer, date, decision' },
  { id: 'instruments-due', title: 'Re-verification due list', hint: 'Next due dates and overdue instruments' },
];

const Bar: React.FC<{ label: string; value: number; max: number; tone?: string }> = ({ label, value, max, tone = 'bg-[#1a3a5c]' }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="w-32 shrink-0 text-slate-600 truncate">{label}</span>
    <div className="flex-1 h-2.5 rounded-full bg-slate-100" role="img" aria-label={`${label}: ${value}`}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, opacity: value ? 1 : 0.15 }} />
    </div>
    <span className="w-10 text-right font-mono text-slate-900">{value}</span>
  </div>
);

const card = 'bg-white rounded-2xl border border-slate-200 shadow-gov p-5';

/** Management reports (ADMIN) and CSV exports (every internal role, data is role-scoped by the API). */
export const ReportsPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ExportDataset | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const isAdmin = user?.role_id === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) return;
    reportsExtraApi.summary().then(setSummary).catch((e) => setError(e?.message || 'Could not load the report.'));
  }, [isAdmin]);

  if (authLoading) return <LoadingSpinner label="Loading..." />;
  if (!user) return <Navigate to="/dashboard" replace />;

  const download = async (id: ExportDataset) => {
    setDownloading(id);
    setExportError(null);
    try {
      await reportsExtraApi.downloadCsv(id, from || undefined, to || undefined);
    } catch (e: any) {
      setExportError(e?.message || 'Export failed.');
    } finally {
      setDownloading(null);
    }
  };

  const maxOf = (xs: number[]) => Math.max(1, ...xs);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports and exports</h1>
        <p className="text-sm text-slate-600 mt-1">Figures are limited to what your role may see. Exports open in Excel; risky cell prefixes are neutralised.</p>
      </div>

      <section className={card} aria-label="CSV export">
        <h2 className="text-sm font-bold text-slate-900">Download CSV</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-700">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block border border-slate-300 rounded-lg px-2 py-1 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block border border-slate-300 rounded-lg px-2 py-1 text-sm" />
          </label>
        </div>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DATASETS.map((d) => (
            <li key={d.id} className="border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                <p className="text-xs text-slate-500">{d.hint}</p>
              </div>
              <Button size="sm" variant="secondary" isLoading={downloading === d.id} onClick={() => download(d.id)}>
                Download CSV
              </Button>
            </li>
          ))}
        </ul>
        {exportError && <p role="alert" className="mt-2 text-sm text-rose-700">{exportError}</p>}
      </section>

      {isAdmin && error && <ErrorMessage message={error} />}
      {isAdmin && !summary && !error && <LoadingSpinner label="Building report..." />}

      {isAdmin && summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Open applications', summary.pendency.open],
              ['Oldest open (days)', summary.pendency.oldestOpenDays ?? 0],
              ['Overdue instruments', summary.instrumentStates.OVERDUE ?? 0],
              ['Public scans (30 d)', summary.publicScans?.scans_30d ?? 0],
            ].map(([k, v]) => (
              <div key={k as string} className={card}>
                <p className="text-xs text-slate-500">{k}</p>
                <p className="text-2xl font-bold text-slate-900">{v as number}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className={`${card} space-y-2`} aria-label="Pendency">
              <h2 className="text-sm font-bold text-slate-900">Pendency by age</h2>
              {Object.entries(summary.pendency.ageBuckets).map(([k, v]) => (
                <Bar key={k} label={k} value={v} max={maxOf(Object.values(summary.pendency.ageBuckets))} tone={k === 'over 30 days' ? 'bg-rose-600' : 'bg-[#1a3a5c]'} />
              ))}
            </section>

            <section className={`${card} space-y-2`} aria-label="Applications by status">
              <h2 className="text-sm font-bold text-slate-900">Applications by status</h2>
              {Object.entries(summary.applicationsByStatus).map(([k, v]) => (
                <Bar key={k} label={k.replace('_', ' ').toLowerCase()} value={v} max={maxOf(Object.values(summary.applicationsByStatus))} />
              ))}
            </section>

            <section className={`${card} space-y-2`} aria-label="Expiry forecast">
              <h2 className="text-sm font-bold text-slate-900">Certificates expiring (next 12 months)</h2>
              {summary.expiryForecast.length === 0 ? <p className="text-sm text-slate-500">Nothing expiring.</p> :
                summary.expiryForecast.map((m) => <Bar key={m.month} label={m.month} value={m.expiring} max={maxOf(summary.expiryForecast.map((x) => x.expiring))} tone="bg-amber-500" />)}
            </section>

            <section className={`${card} space-y-2`} aria-label="Instrument states">
              <h2 className="text-sm font-bold text-slate-900">Instrument verification state</h2>
              {Object.entries(summary.instrumentStates).map(([k, v]) => (
                <Bar key={k} label={k.replace('_', ' ').toLowerCase()} value={v} max={maxOf(Object.values(summary.instrumentStates))} tone={k === 'OVERDUE' || k === 'REVOKED' ? 'bg-rose-600' : k === 'DUE_SOON' ? 'bg-amber-500' : 'bg-emerald-600'} />
              ))}
            </section>
          </div>

          <section className={`${card} overflow-x-auto`} aria-label="Officer workload">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Officer workload</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="py-1.5">Officer</th><th>Open</th><th>Completed</th><th>Declined</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.officerWorkload.length === 0 && <tr><td colSpan={4} className="py-3 text-slate-500">No assignments yet.</td></tr>}
                {summary.officerWorkload.map((o) => (
                  <tr key={o.officer_id}><td className="py-1.5 font-semibold">{o.officer_name} <span className="text-xs font-normal text-slate-500">{o.role}</span></td><td>{o.open_assignments}</td><td>{o.completed_assignments}</td><td>{o.declined_assignments}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={`${card} overflow-x-auto`} aria-label="By division">
            <h2 className="text-sm font-bold text-slate-900 mb-2">By division</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="py-1.5">Division</th><th>Applications</th><th>Open</th><th>Completed</th><th>Rejected/cancelled</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.byDivision.map((d) => (
                  <tr key={d.division}><td className="py-1.5 font-semibold">{d.division}</td><td>{d.applications}</td><td>{d.open}</td><td>{d.completed}</td><td>{d.closed_without_result}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};
