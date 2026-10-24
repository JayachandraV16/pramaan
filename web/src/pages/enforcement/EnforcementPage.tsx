import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  enforcementApi,
  EnforcementCase,
  EnforcementStatus,
  EnforcementSummary,
  OffenceType,
  RepeatOffender,
} from '../../api/workflow.api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

const OFFENCES: Array<[OffenceType, string]> = [
  ['UNSTAMPED_INSTRUMENT', 'Unstamped instrument'],
  ['UNVERIFIED_INSTRUMENT', 'Unverified instrument'],
  ['EXPIRED_CERTIFICATE', 'Expired certificate'],
  ['SEAL_TAMPERING', 'Seal tampering'],
  ['FALSE_WEIGHT_OR_MEASURE', 'False weight or measure'],
  ['OTHER', 'Other offence'],
  ['NONE', 'No offence found (compliant spot check)'],
];
const OFFENCE_LABEL = Object.fromEntries(OFFENCES) as Record<string, string>;

const NEXT: Record<EnforcementStatus, EnforcementStatus[]> = {
  OPEN: ['NOTICE_ISSUED', 'PENALTY_IMPOSED', 'RESOLVED', 'DISMISSED'],
  NOTICE_ISSUED: ['PENALTY_IMPOSED', 'RESOLVED', 'DISMISSED'],
  PENALTY_IMPOSED: ['RESOLVED'],
  RESOLVED: [],
  DISMISSED: [],
};

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const inr = (n: string | number | null) => (n == null ? '-' : `₹ ${Number(n).toLocaleString('en-IN')}`);

const FLAG_STYLE: Record<string, string> = {
  REPEAT: 'bg-amber-100 text-amber-800',
  HABITUAL: 'bg-rose-100 text-rose-800',
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  NOTICE_ISSUED: 'bg-amber-100 text-amber-800',
  PENALTY_IMPOSED: 'bg-rose-100 text-rose-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  DISMISSED: 'bg-slate-200 text-slate-700',
};

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]';
const card = 'bg-white rounded-2xl border border-slate-200 shadow-gov p-5';

type Tab = 'CASES' | 'OFFENDERS';

/** Enforcement: register offences found on inspection, track repeat offenders, handle cases (admin). */
export const EnforcementPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const role = user?.role_id;
  const isAdmin = role === 'ADMIN';
  const isOfficer = role === 'ADMIN' || role === 'LMO' || role === 'GATC';

  const [tab, setTab] = useState<Tab>('CASES');
  const [cases, setCases] = useState<EnforcementCase[]>([]);
  const [offenders, setOffenders] = useState<RepeatOffender[]>([]);
  const [summary, setSummary] = useState<EnforcementSummary | null>(null);
  const [open, setOpen] = useState<EnforcementCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ source: 'SPOT_CHECK', offenceType: 'UNSTAMPED_INSTRUMENT', subjectName: '', subjectPhone: '', subjectOrganization: '', description: '', location: '' });
  const [next, setNext] = useState<{ status: EnforcementStatus | ''; note: string; amount: string; reference: string }>({ status: '', note: '', amount: '', reference: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      setCases(await enforcementApi.list());
      if (isOfficer) setOffenders(await enforcementApi.offenders());
      if (isAdmin) setSummary(await enforcementApi.summary());
    } catch (e: any) {
      setError(e?.message || 'Could not load enforcement data.');
    } finally {
      setLoading(false);
    }
  }, [isOfficer, isAdmin]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return <LoadingSpinner label="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const openCase = (c: EnforcementCase) => act(async () => { setOpen(await enforcementApi.get(c.id)); setNext({ status: '', note: '', amount: '', reference: '' }); });

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    act(async () => {
      const body: Record<string, unknown> = { ...form };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await enforcementApi.create(body);
      setForm({ ...form, subjectName: '', subjectPhone: '', subjectOrganization: '', description: '', location: '' });
      setShowForm(false);
    });
  };

  const submitStatus = () => {
    if (!open || !next.status) return;
    act(async () => {
      await enforcementApi.setStatus(open.id, {
        status: next.status as EnforcementStatus,
        note: next.note || undefined,
        penaltyAmount: next.amount ? Number(next.amount) : undefined,
        penaltyReference: next.reference || undefined,
      });
      setOpen(await enforcementApi.get(open.id));
      setNext({ status: '', note: '', amount: '', reference: '' });
    });
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{isOfficer ? 'Enforcement' : 'My enforcement cases'}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {isOfficer
              ? 'Offences found on spot checks, complaints and routine inspections. A 2nd offence in 12 months flags a repeat offender, a 3rd a habitual one.'
              : 'Cases the department has registered about you and their status.'}
          </p>
        </div>
        {isOfficer && <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close form' : 'Register a case'}</Button>}
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}

      {isAdmin && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Open cases', summary.totals.open_cases],
            ['Repeat offenders', summary.offenderFlags.find((x) => x.flag === 'REPEAT')?.count ?? 0],
            ['Habitual offenders', summary.offenderFlags.find((x) => x.flag === 'HABITUAL')?.count ?? 0],
            ['Penalties imposed', inr(summary.totals.penalties_total)],
          ].map(([k, v]) => (
            <div key={k as string} className={card}>
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-2xl font-bold text-slate-900">{v as React.ReactNode}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && isOfficer && (
        <form onSubmit={register} className={`${card} grid grid-cols-1 sm:grid-cols-3 gap-3`}>
          <h2 className="sm:col-span-3 text-sm font-bold text-slate-900">Register a case</h2>
          <label className="text-xs font-semibold text-slate-700">Found during
            <select value={form.source} onChange={f('source')} className={inputCls}>
              <option value="SPOT_CHECK">Spot check</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="ROUTINE_INSPECTION">Routine inspection</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Finding
            <select value={form.offenceType} onChange={f('offenceType')} className={inputCls}>
              {OFFENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Trader / owner name *
            <input required value={form.subjectName} onChange={f('subjectName')} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-slate-700">Phone
            <input value={form.subjectPhone} onChange={f('subjectPhone')} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-slate-700">Shop / organisation
            <input value={form.subjectOrganization} onChange={f('subjectOrganization')} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-3">What was found *
            <textarea required rows={2} value={form.description} onChange={f('description')} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Location
            <input value={form.location} onChange={f('location')} className={inputCls} />
          </label>
          <div className="flex items-end"><Button type="submit" isLoading={busy} disabled={!form.subjectName.trim() || !form.description.trim()}>Register case</Button></div>
        </form>
      )}

      {isOfficer && (
        <div className="flex gap-2" role="tablist">
          {([['CASES', `Cases (${cases.length})`], ['OFFENDERS', `Repeat offenders (${offenders.length})`]] as Array<[Tab, string]>).map(([id, text]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tab === id ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{text}</button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading..." />
      ) : tab === 'OFFENDERS' && isOfficer ? (
        offenders.length === 0 ? <EmptyState title="No repeat offenders" description="Nobody has two or more offences in the last 12 months." /> : (
          <div className={`${card} overflow-x-auto p-0`}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5">Offender</th><th className="px-4 py-2.5">Flag</th><th className="px-4 py-2.5">12 months</th><th className="px-4 py-2.5">All time</th><th className="px-4 py-2.5">Last offence</th><th className="px-4 py-2.5 text-right">Penalties</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offenders.map((o) => (
                  <tr key={o.offender_key}>
                    <td className="px-4 py-2.5 font-semibold">{o.subject_name}<div className="text-xs font-normal text-slate-500">{o.subject_organization}</div></td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FLAG_STYLE[o.flag]}`}>{label(o.flag)}</span></td>
                    <td className="px-4 py-2.5">{o.offences_12m}</td>
                    <td className="px-4 py-2.5">{o.offences_total}</td>
                    <td className="px-4 py-2.5">{o.last_offence_on ? day(o.last_offence_on) : '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{inr(o.penalties_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : cases.length === 0 ? (
        <EmptyState title="No cases" description={isOfficer ? 'Register a case when you find an offence on an inspection.' : 'There are no enforcement cases about you.'} />
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5">Case</th><th className="px-4 py-2.5">Subject</th><th className="px-4 py-2.5">Finding</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openCase(c)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#1a3a5c] font-semibold">{c.case_number}</td>
                  <td className="px-4 py-2.5 font-semibold">
                    {c.subject_name}
                    {c.offender_flag && FLAG_STYLE[c.offender_flag] && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${FLAG_STYLE[c.offender_flag]}`}>{label(c.offender_flag)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{OFFENCE_LABEL[c.offence_type] ?? c.offence_type}</td>
                  <td className="px-4 py-2.5">{day(c.detected_on)}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[c.status]}`}>{label(c.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <section className={`${card} space-y-3`} aria-label="Case detail">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900"><span className="font-mono">{open.case_number}</span> · {OFFENCE_LABEL[open.offence_type] ?? open.offence_type}</h2>
              <p className="text-sm text-slate-600">
                {open.subject_name}{open.subject_organization ? `, ${open.subject_organization}` : ''} · {label(open.source)} on {day(open.detected_on)}
                {open.detected_by_name ? ` by ${open.detected_by_name}` : ''}
              </p>
            </div>
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setOpen(null)}>Close</button>
          </div>
          <p className="text-sm whitespace-pre-wrap">{open.description}</p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Offence number</dt><dd className="font-semibold">{open.offence_number || '-'}</dd></div>
            <div><dt className="text-xs text-slate-500">Location</dt><dd>{open.location || '-'}</dd></div>
            <div><dt className="text-xs text-slate-500">Penalty</dt><dd className="font-mono">{inr(open.penalty_amount)}{open.penalty_reference ? ` (${open.penalty_reference})` : ''}</dd></div>
            <div><dt className="text-xs text-slate-500">Offences (12 months)</dt><dd>{open.offender_offences_12m ?? '-'}</dd></div>
          </dl>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Timeline</h3>
            <ol className="mt-2 border-l-2 border-slate-200 ml-2 space-y-2">
              {(open.events || []).map((ev) => (
                <li key={ev.id} className="pl-4 relative">
                  <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-[#1a3a5c]" aria-hidden="true" />
                  <p className="text-sm font-semibold">{ev.from_status ? `${label(ev.from_status)} → ` : ''}{label(ev.to_status)}</p>
                  <p className="text-xs text-slate-500">{new Date(ev.created_at).toLocaleString('en-IN')}{ev.actor_name ? ` · ${ev.actor_name}` : ''}</p>
                  {ev.note && <p className="text-xs text-slate-700">“{ev.note}”</p>}
                </li>
              ))}
            </ol>
          </div>

          {isAdmin && NEXT[open.status].length > 0 && (
            <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="text-xs font-semibold text-slate-700">Move to
                <select value={next.status} onChange={(e) => setNext({ ...next, status: e.target.value as EnforcementStatus })} className={inputCls}>
                  <option value="">Choose…</option>
                  {NEXT[open.status].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </label>
              {next.status === 'PENALTY_IMPOSED' && (
                <>
                  <label className="text-xs font-semibold text-slate-700">Penalty (₹) *
                    <input type="number" min="1" value={next.amount} onChange={(e) => setNext({ ...next, amount: e.target.value })} className={inputCls} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Challan / reference
                    <input value={next.reference} onChange={(e) => setNext({ ...next, reference: e.target.value })} className={inputCls} />
                  </label>
                </>
              )}
              <label className={`text-xs font-semibold text-slate-700 ${next.status === 'PENALTY_IMPOSED' ? 'sm:col-span-4' : 'sm:col-span-2'}`}>Note {next.status === 'DISMISSED' ? '* (reason)' : ''}
                <input value={next.note} onChange={(e) => setNext({ ...next, note: e.target.value })} className={inputCls} />
              </label>
              <div className="flex items-end">
                <Button isLoading={busy} onClick={submitStatus}
                  disabled={!next.status || (next.status === 'PENALTY_IMPOSED' && !(Number(next.amount) > 0)) || (next.status === 'DISMISSED' && next.note.trim().length < 5)}>
                  Update case
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
