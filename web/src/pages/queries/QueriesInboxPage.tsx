import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { QueryThread, queriesApi } from '../../api/workflow.api';
import { QueryThreadView } from '../../components/queries/QueryThreadView';
import { useAuth } from '../../context/AuthContext';

type Tab = 'ME' | 'OPEN' | 'DOCS' | 'CLOSED';
const TABS: Array<[Tab, string]> = [
  ['ME', 'Waiting for me'],
  ['OPEN', 'All open'],
  ['DOCS', 'Document requests'],
  ['CLOSED', 'Closed'],
];
const paramsFor = (tab: Tab) =>
  tab === 'ME' ? { awaiting: 'me', status: 'OPEN' } : tab === 'OPEN' ? { status: 'OPEN' } : tab === 'DOCS' ? { kind: 'DOCUMENT_REQUEST', status: 'OPEN' } : { status: 'CLOSED' };

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '');

/** Everything said between applicants and the department, across all applications. */
export const QueriesInboxPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('ME');
  const [rows, setRows] = useState<QueryThread[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await queriesApi.inbox(paramsFor(tab)));
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Could not load your queries.');
    }
  }, [tab]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  if (isLoading) return null;
  if (!user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Queries</h1>
        <p className="text-sm text-slate-500">Questions and document requests about applications.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([value, text]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setSelected(null); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${tab === value ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            {text}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <ul className="bg-white rounded-2xl border border-slate-200 shadow-gov divide-y divide-slate-100 self-start" data-testid="inbox-list">
          {rows === null && <li className="p-4 text-sm text-slate-500">Loading…</li>}
          {rows !== null && rows.length === 0 && <li className="p-4 text-sm text-slate-500" data-testid="inbox-empty">Nothing here.</li>}
          {(rows || []).map((t) => (
            <li key={t.id} data-testid="inbox-item">
              <button type="button" onClick={() => setSelected(t.id)} className={`w-full text-left p-3 hover:bg-slate-50 ${selected === t.id ? 'bg-slate-50' : ''}`}>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1a3a5c] truncate flex-1">{t.subject}</span>
                  {t.kind === 'DOCUMENT_REQUEST' && <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">Documents</span>}
                  <span className="text-[11px] text-slate-400">{when(t.last_message_at || t.created_at)}</span>
                </span>
                <span className="block text-xs text-slate-500 truncate">
                  {t.application_number} · {t.instrument_name}{t.instrument_serial ? ` (${t.instrument_serial})` : ''}
                </span>
                <span className="block text-xs text-slate-600 truncate">{t.last_message}</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          {selected ? (
            <>
              <QueryThreadView threadId={selected} role={user.role_id} userId={user.id} onChanged={load} />
              {(() => {
                const t = (rows || []).find((r) => r.id === selected);
                return t ? <Link to={`/applications/${t.application_id}`} className="mt-2 inline-block text-xs font-semibold text-[#1a3a5c] hover:underline">Open the application</Link> : null;
              })()}
            </>
          ) : (
            <p className="text-sm text-slate-500">Choose a query to read it.</p>
          )}
        </div>
      </div>
    </div>
  );
};
