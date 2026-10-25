import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HqDrill, HqMapData, HqOverview, MapState, hqApi } from '../../api/hq.api';
import { HqMap, STATE_STYLE } from '../../components/maps/HqMap';
import { EvidencePack } from '../../components/hq/EvidencePack';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { Button } from '../../components/common/Button';

const TILES: Array<{ id: string; label: string; tone: string }> = [
  { id: 'applications-open', label: 'Open applications', tone: 'text-[#1a3a5c]' },
  { id: 'applications-unassigned', label: 'No officer assigned', tone: 'text-amber-700' },
  { id: 'applications-stuck', label: 'Open over 30 days', tone: 'text-rose-700' },
  { id: 'certificates-active', label: 'Active certificates', tone: 'text-emerald-700' },
  { id: 'certificates-expiring', label: 'Expiring in 30 days', tone: 'text-amber-700' },
  { id: 'certificates-revoked', label: 'Revoked certificates', tone: 'text-rose-700' },
  { id: 'instruments-overdue', label: 'Instruments overdue', tone: 'text-rose-700' },
  { id: 'verifications-failed', label: 'Failed verifications (30 d)', tone: 'text-rose-700' },
  { id: 'enforcement-open', label: 'Open enforcement cases', tone: 'text-rose-700' },
  { id: 'queries-awaiting-department', label: 'Queries awaiting reply', tone: 'text-amber-700' },
  { id: 'nameplate-pending', label: 'Nameplates to review', tone: 'text-sky-700' },
];

const card = 'bg-white rounded-2xl border border-slate-200 shadow-gov p-5';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const Bar: React.FC<{ label: string; value: number; max: number; tone?: string }> = ({ label, value, max, tone = 'bg-[#1a3a5c]' }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="w-28 shrink-0 text-slate-600 truncate">{label}</span>
    <div className="flex-1 h-2.5 rounded-full bg-slate-100" role="img" aria-label={`${label}: ${value}`}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, opacity: value ? 1 : 0.15 }} />
    </div>
    <span className="w-10 text-right font-mono text-slate-900">{value}</span>
  </div>
);

/** Command HQ: national counters, the instrument map, drill-down to the records, and evidence packs. ADMIN only. */
export const CommandHqPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role_id === 'ADMIN';

  const [overview, setOverview] = useState<HqOverview | null>(null);
  const [map, setMap] = useState<HqMapData | null>(null);
  const [mapState, setMapState] = useState<MapState | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<HqDrill | null>(null);
  const [drillFilter, setDrillFilter] = useState<{ metric: string; division?: string; offset: number } | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<{ id: string; label: string } | null>(null);
  const [csvStatus, setCsvStatus] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    hqApi.overview().then(setOverview).catch((e) => setError(e?.message || 'Could not load Command HQ.'));
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);
  useEffect(() => {
    if (!isAdmin) return;
    hqApi.map(mapState).then(setMap).catch(() => setMap({ instruments: [], cases: [], truncated: false }));
  }, [isAdmin, mapState]);
  useEffect(() => {
    if (!drillFilter) return;
    setDrillError(null);
    hqApi.drill(drillFilter.metric, { division: drillFilter.division, offset: drillFilter.offset, limit: 15 }).then(setDrill).catch((e) => setDrillError(e?.message || 'Could not load the records.'));
  }, [drillFilter]);

  if (isLoading) return <LoadingSpinner label="Loading..." />;
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  const open = (metric: string, division?: string) => {
    setDrill(null);
    setDrillFilter({ metric, division, offset: 0 });
    setTimeout(() => document.getElementById('hq-drill')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const downloadCsv = async () => {
    setCsvBusy(true);
    setCsvError(null);
    try {
      await hqApi.downloadEvidenceCsv({ status: csvStatus });
    } catch (e: any) {
      setCsvError(e?.message || 'Export failed.');
    } finally {
      setCsvBusy(false);
    }
  };

  if (error) return <div className="max-w-6xl mx-auto px-4 py-10"><ErrorMessage message={error} onRetry={load} /></div>;
  if (!overview) return <div className="max-w-6xl mx-auto px-4 py-10"><LoadingSpinner label="Loading Command HQ..." /></div>;

  const t = overview.tiles;
  const maxTrend = Math.max(1, ...overview.monthlyTrends.map((m) => Math.max(m.submitted, m.approved, m.rejected)));
  const maxForecast = Math.max(1, ...overview.expiryForecast.map((m) => m.expiring));
  const states = Object.entries(overview.instrumentStates);
  const maxState = Math.max(1, ...states.map(([, n]) => n));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" data-testid="command-hq">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Command HQ</h1>
          <p className="text-sm text-slate-500">Operations at a glance. Select a number to see the records behind it. Updated {new Date(overview.generatedAt).toLocaleTimeString('en-IN')}.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
      </div>

      {/* ---- KPI tiles (each one opens the records behind it) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="hq-tiles">
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Instruments registered</p>
          <p className="text-2xl font-bold text-slate-900" data-testid="tile-instruments">{t.instruments}</p>
          <p className="text-[11px] text-slate-500">{t.instruments_on_map} have a map location · {t.verifications_30d} verifications in 30 days</p>
        </div>
        {TILES.map((tile) => (
          <button key={tile.id} type="button" onClick={() => open(tile.id)} aria-pressed={drillFilter?.metric === tile.id} data-testid={`tile-${tile.id}`}
            className={`${card} text-left hover:border-[#1a3a5c] focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${drillFilter?.metric === tile.id ? 'ring-2 ring-[#1a3a5c]' : ''}`}>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{tile.label}</p>
            <p className={`text-2xl font-bold ${tile.tone}`} data-testid={`tile-value-${tile.id}`}>{t[tile.id] ?? 0}</p>
            <p className="text-[11px] text-[#1a3a5c]">Show records</p>
          </button>
        ))}
      </div>

      {/* ---- needs attention */}
      <section className={card} aria-label="Needs attention">
        <h2 className="text-sm font-bold text-slate-900">Needs attention</h2>
        <div className="mt-3 grid md:grid-cols-2 gap-4">
          {overview.attention.map((a) => (
            <div key={a.metric} data-testid={`attention-${a.metric}`}>
              <button type="button" onClick={() => open(a.metric)} className="text-xs font-semibold text-[#1a3a5c] hover:underline">{a.title} ({a.total})</button>
              {a.rows.length === 0 ? <p className="text-xs text-slate-400">Nothing.</p> : (
                <ul className="mt-1 divide-y divide-slate-100 text-xs">
                  {a.rows.map((r) => (
                    <li key={r.id} className="py-1 flex gap-2"><Link to={r.link} className="font-mono text-[#1a3a5c] hover:underline">{r.reference}</Link><span className="truncate flex-1 text-slate-600">{r.title}</span><span className="text-slate-400">{when(r.at)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- map */}
      <section className={card} aria-label="Instrument map">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-900 flex-1">Instrument map</h2>
          <label className="text-xs text-slate-600">Show{' '}
            <select value={mapState} onChange={(e) => setMapState(e.target.value as MapState | '')} aria-label="Map filter" data-testid="map-filter" className="border border-slate-300 rounded-lg px-2 py-1 text-xs">
              <option value="">all instruments</option>
              {(Object.keys(STATE_STYLE) as MapState[]).map((s) => <option key={s} value={s}>{STATE_STYLE[s].label}</option>)}
            </select>
          </label>
        </div>
        <HqMap data={map} onOpen={(path) => navigate(path)} />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Map legend">
          {(Object.keys(STATE_STYLE) as MapState[]).map((s) => (
            <li key={s} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-white shadow" style={{ background: STATE_STYLE[s].color }} />{STATE_STYLE[s].label}</li>
          ))}
          <li className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-slate-800 bg-orange-500" />Open enforcement case</li>
        </ul>
        <p className="mt-1 text-[11px] text-slate-500" data-testid="map-note">
          {map ? `${map.instruments.length} instruments and ${map.cases.length} open cases shown` : 'Loading the map…'}
          {t.instruments > t.instruments_on_map ? ` · ${t.instruments - t.instruments_on_map} instruments have no location and are not plotted` : ''}
          {map?.truncated ? ' · only the first 2000 are drawn; choose a filter' : ''}
        </p>
      </section>

      {/* ---- charts and tables */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className={card} aria-label="Monthly trend">
          <h2 className="text-sm font-bold text-slate-900">Applications by month</h2>
          <div className="mt-3 space-y-2">
            {overview.monthlyTrends.map((m) => (
              <div key={m.month} className="space-y-0.5">
                <p className="text-[11px] font-semibold text-slate-700">{m.month}</p>
                <Bar label="submitted" value={m.submitted} max={maxTrend} />
                <Bar label="approved" value={m.approved} max={maxTrend} tone="bg-emerald-600" />
                <Bar label="rejected" value={m.rejected} max={maxTrend} tone="bg-rose-600" />
              </div>
            ))}
          </div>
        </section>
        <section className={card} aria-label="Instrument states">
          <h2 className="text-sm font-bold text-slate-900">Instruments by verification state</h2>
          <div className="mt-3 space-y-2">
            {states.map(([state, n]) => <Bar key={state} label={(STATE_STYLE[state as MapState]?.label || state).replace('Certificate revoked', 'Revoked').replace('Due within 30 days', 'Due soon')} value={n} max={maxState} tone={state === 'OVERDUE' || state === 'REVOKED' ? 'bg-rose-600' : state === 'DUE_SOON' ? 'bg-amber-500' : 'bg-[#1a3a5c]'} />)}
          </div>
          <h3 className="mt-5 text-sm font-bold text-slate-900">Certificates expiring (next 12 months)</h3>
          <div className="mt-2 space-y-1.5">
            {overview.expiryForecast.length === 0 ? <p className="text-xs text-slate-400">None.</p> : overview.expiryForecast.map((m) => <Bar key={m.month} label={m.month} value={m.expiring} max={maxForecast} tone="bg-amber-500" />)}
          </div>
        </section>
        <section className={card} aria-label="Divisions">
          <h2 className="text-sm font-bold text-slate-900">Divisions</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="py-1">Division</th><th>Applications</th><th>Open</th><th>Completed</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {overview.byDivision.map((d) => (
                <tr key={d.division}>
                  <td className="py-1.5 font-semibold">{d.division}</td><td>{d.applications}</td>
                  <td><button type="button" className="font-mono text-[#1a3a5c] hover:underline" onClick={() => open('applications-open', d.division)} aria-label={`Open applications in ${d.division}`}>{d.open}</button></td>
                  <td>{d.completed}</td>
                </tr>
              ))}
              {overview.byDivision.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-400">No applications yet.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className={card} aria-label="Officer workload">
          <h2 className="text-sm font-bold text-slate-900">Officer workload</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="py-1">Officer</th><th>Open</th><th>Done</th><th>Declined</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {overview.officerWorkload.map((o) => <tr key={o.officer_id}><td className="py-1.5">{o.officer_name} <span className="text-[10px] text-slate-400">{o.role}</span></td><td>{o.open_assignments}</td><td>{o.completed_assignments}</td><td>{o.declined_assignments}</td></tr>)}
              {overview.officerWorkload.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-400">No assignments yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      {/* ---- drill-down */}
      <section id="hq-drill" className={card} aria-label="Records" data-testid="hq-drill">
        {!drillFilter ? (
          <p className="text-sm text-slate-500">Select a number above to list the records behind it.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900 flex-1">{drill ? drill.title : 'Loading…'}{drillFilter.division ? ` · division ${drillFilter.division}` : ''}{drill ? ` (${drill.total})` : ''}</h2>
              <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => { setDrillFilter(null); setDrill(null); }}>Close</button>
            </div>
            {drillError && <p role="alert" className="text-sm text-rose-700">{drillError}</p>}
            {drill && (
              <>
                <div className="overflow-x-auto">
                  <table className="mt-2 w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="py-1">Reference</th><th>Subject</th><th>Status</th><th>Date</th><th>Responsible</th><th /></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {drill.rows.map((r) => (
                        <tr key={r.id} data-testid="drill-row">
                          <td className="py-1.5 font-mono text-xs"><Link to={r.link} className="text-[#1a3a5c] hover:underline">{r.reference}</Link></td>
                          <td className="max-w-[18rem] truncate">{r.title}</td>
                          <td className="text-xs">{r.status.replace(/_/g, ' ').toLowerCase()}</td>
                          <td className="text-xs">{when(r.at)}</td>
                          <td className="text-xs">{r.responsible || '-'}</td>
                          <td className="text-right">{r.entity === 'certificate' && <button type="button" className="text-xs font-semibold text-[#1a3a5c] hover:underline" onClick={() => setEvidenceFor({ id: r.id, label: r.reference })}>Evidence</button>}</td>
                        </tr>
                      ))}
                      {drill.rows.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-400">No records.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <Button size="sm" variant="secondary" disabled={drill.offset === 0} onClick={() => setDrillFilter({ ...drillFilter, offset: Math.max(0, drill.offset - drill.limit) })}>Previous</Button>
                  <span>{drill.total === 0 ? 0 : drill.offset + 1}-{Math.min(drill.offset + drill.limit, drill.total)} of {drill.total}</span>
                  <Button size="sm" variant="secondary" disabled={drill.offset + drill.limit >= drill.total} onClick={() => setDrillFilter({ ...drillFilter, offset: drill.offset + drill.limit })}>Next</Button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ---- evidence report */}
      <section className={card} aria-label="Evidence report">
        <h2 className="text-sm font-bold text-slate-900">Evidence report</h2>
        <p className="text-xs text-slate-600">One row per certificate with its record and PDF fingerprints, the result seal, inspection photo IDs and fingerprints, the officer, who issued it and when. Opening a certificate's evidence from the list above shows the same facts in full. Both are recorded in the audit log.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-700">Certificates
            <select value={csvStatus} onChange={(e) => setCsvStatus(e.target.value)} aria-label="Certificate status" className="mt-1 block border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">all</option><option value="ACTIVE">active</option><option value="REVOKED">revoked</option><option value="EXPIRED">expired</option>
            </select>
          </label>
          <Button size="sm" isLoading={csvBusy} onClick={downloadCsv} data-testid="evidence-csv">Download evidence report (CSV)</Button>
        </div>
        {csvError && <p role="alert" className="mt-2 text-sm text-rose-700">{csvError}</p>}
      </section>

      <Modal isOpen={!!evidenceFor} onClose={() => setEvidenceFor(null)} title="Evidence pack" subtitle={evidenceFor ? `Certificate ${evidenceFor.label}` : undefined} maxWidth="4xl">
        {evidenceFor && <EvidencePack certificateId={evidenceFor.id} />}
      </Modal>
    </div>
  );
};
