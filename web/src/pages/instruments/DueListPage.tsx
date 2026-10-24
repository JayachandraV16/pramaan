import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dueApi, DueInstrument, DueState } from '../../api/workflow.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

type Tab = 'ATTENTION' | DueState | 'ALL';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ATTENTION', label: 'Needs attention' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'DUE_SOON', label: 'Due in 30 days' },
  { id: 'NEVER_VERIFIED', label: 'Never verified' },
  { id: 'VALID', label: 'Valid' },
  { id: 'ALL', label: 'All' },
];

const STATE_STYLE: Record<DueState, { text: string; cls: string }> = {
  OVERDUE: { text: 'Overdue', cls: 'bg-rose-100 text-rose-800' },
  DUE_SOON: { text: 'Due soon', cls: 'bg-amber-100 text-amber-800' },
  VALID: { text: 'Valid', cls: 'bg-emerald-100 text-emerald-800' },
  NEVER_VERIFIED: { text: 'Never verified', cls: 'bg-slate-200 text-slate-700' },
  REVOKED: { text: 'Certificate revoked', cls: 'bg-rose-100 text-rose-800' },
};

/** Re-verification tracking: which instruments are due, overdue or never verified. */
export const DueListPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('ATTENTION');
  const [rows, setRows] = useState<DueInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canView = !!user;

  const load = () => {
    setLoading(true);
    setError(null);
    dueApi
      .list()
      .then(setRows)
      .catch((e) => setError(e?.message || 'Could not load the due list.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (canView) load();
  }, [canView]);

  if (authLoading) return <LoadingSpinner label="Loading..." />;
  if (!canView) return <Navigate to="/dashboard" replace />;

  const attention: DueState[] = ['OVERDUE', 'DUE_SOON', 'NEVER_VERIFIED', 'REVOKED'];
  const shown = rows.filter((r) => (tab === 'ALL' ? true : tab === 'ATTENTION' ? attention.includes(r.verification_state) : r.verification_state === tab));
  const count = (t: Tab) => rows.filter((r) => (t === 'ALL' ? true : t === 'ATTENTION' ? attention.includes(r.verification_state) : r.verification_state === t)).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Re-verification due list</h1>
        <p className="text-sm text-slate-600 mt-1">Based on the valid-until date of each instrument's latest usable certificate. Reminders go out 30, 15, 7 and 1 day before expiry.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by state">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tab === t.id ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            {t.label} ({count(t.id)})
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}
      {loading ? (
        <LoadingSpinner label="Loading..." />
      ) : shown.length === 0 && !error ? (
        <EmptyState title="Nothing here" description="No instruments in this state." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-gov overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5">Instrument</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Certificate</th><th className="px-4 py-2.5">Due date</th><th className="px-4 py-2.5">State</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => {
                const s = STATE_STYLE[r.verification_state] ?? STATE_STYLE.VALID;
                const days = r.days_until_due;
                return (
                  <tr key={r.instrument_id}>
                    <td className="px-4 py-2.5"><Link className="font-semibold text-[#1a3a5c] hover:underline" to={`/instruments/${r.instrument_id}`}>{r.instrument_name}</Link></td>
                    <td className="px-4 py-2.5 text-slate-600">{r.owner_name || '-'}<div className="text-xs">{r.owner_organization}</div></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.certificate_number || '-'}</td>
                    <td className="px-4 py-2.5">{r.next_due_date || '-'}{days != null && <div className="text-xs text-slate-500">{days < 0 ? `${-days} days overdue` : `in ${days} days`}</div>}</td>
                    <td className="px-4 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      {user && (user.role_id === 'INSTRUMENT_OWNER' || user.role_id === 'ADMIN') && r.verification_state !== 'VALID' && (
                        <Link className="text-xs font-semibold text-[#1a3a5c] hover:underline" to={`/applications/new?instrumentId=${r.instrument_id}`}>
                          {r.verification_state === 'NEVER_VERIFIED' ? 'Apply →' : 'Renew →'}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
