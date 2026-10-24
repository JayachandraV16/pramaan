import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { feesApi, FeeKind, FeeRule, InstrumentTypeRow } from '../../api/workflow.api';
import { Button } from '../../components/common/Button';
import { DocumentRequirementsAdmin } from '../../components/admin/DocumentRequirementsAdmin';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';

const KIND_LABEL: Record<FeeKind, string> = {
  VERIFICATION: 'Verification fee',
  CONVEYANCE: 'Conveyance',
  QUARTER_JUMP: 'Quarter-jump surcharge',
};

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]';

/** ADMIN: configurable fee rules (nothing is hard-coded) and default certificate validity per instrument type. */
export const FeeRulesPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [types, setTypes] = useState<InstrumentTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ feeKind: 'VERIFICATION' as FeeKind, amount: '', instrumentTypeId: '', applicationType: '', minCapacity: '', maxCapacity: '', effectiveFrom: '', description: '' });
  const [months, setMonths] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, t] = await Promise.all([feesApi.rules(), feesApi.types()]);
      setRules(r);
      setTypes(t);
      setMonths(Object.fromEntries(t.map((x) => [x.id, x.default_validity_months ? String(x.default_validity_months) : ''])));
    } catch (e: any) {
      setError(e?.message || 'Could not load fee rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role_id === 'ADMIN') load();
  }, [load, user]);

  if (authLoading) return <LoadingSpinner label="Loading..." />;
  if (!user || user.role_id !== 'ADMIN') return <Navigate to="/dashboard" replace />;

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { feeKind: form.feeKind, amount: Number(form.amount) };
    if (form.instrumentTypeId) body.instrumentTypeId = form.instrumentTypeId;
    if (form.applicationType) body.applicationType = form.applicationType;
    if (form.minCapacity) body.minCapacity = Number(form.minCapacity);
    if (form.maxCapacity) body.maxCapacity = Number(form.maxCapacity);
    if (form.effectiveFrom) body.effectiveFrom = form.effectiveFrom;
    if (form.description.trim()) body.description = form.description.trim();
    act(async () => {
      await feesApi.createRule(body);
      setForm({ ...form, amount: '', minCapacity: '', maxCapacity: '', description: '' });
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fees and validity rules</h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter the amounts from your State's fee notification. The most specific active rule applies to each application (instrument type, then application type, then capacity band). Rules are end-dated, never deleted.
        </p>
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <h2 className="sm:col-span-3 text-sm font-bold text-slate-900">Add a fee rule</h2>
        <label className="text-xs font-semibold text-slate-700">Fee type
          <select value={form.feeKind} onChange={set('feeKind')} className={inputCls}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Amount (₹)
          <input type="number" min="0" step="0.01" required value={form.amount} onChange={set('amount')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700">Instrument type (optional)
          <select value={form.instrumentTypeId} onChange={set('instrumentTypeId')} className={inputCls}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Application type (optional)
          <select value={form.applicationType} onChange={set('applicationType')} className={inputCls}>
            <option value="">Any</option>
            <option value="VERIFICATION">Verification</option>
            <option value="RE_VERIFICATION">Re-verification</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Min capacity
          <input type="number" min="0" step="any" value={form.minCapacity} onChange={set('minCapacity')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700">Max capacity
          <input type="number" min="0" step="any" value={form.maxCapacity} onChange={set('maxCapacity')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700">Effective from
          <input type="date" value={form.effectiveFrom} onChange={set('effectiveFrom')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Note (e.g. notification reference)
          <input value={form.description} onChange={set('description')} className={inputCls} />
        </label>
        <div className="sm:col-span-3"><Button type="submit" isLoading={busy} disabled={!form.amount}>Add rule</Button></div>
      </form>

      {loading ? (
        <LoadingSpinner label="Loading rules..." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-gov overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Fee</th><th className="px-4 py-2.5">Applies to</th><th className="px-4 py-2.5">Capacity</th>
                  <th className="px-4 py-2.5">Valid</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No fee rules yet. Without a matching rule the fee entered on the application is used.</td></tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className={r.is_active ? '' : 'opacity-50'}>
                    <td className="px-4 py-2.5 font-semibold">{KIND_LABEL[r.fee_kind]}<div className="text-xs font-normal text-slate-500">{r.description}</div></td>
                    <td className="px-4 py-2.5">{r.instrument_type_name || 'All types'} · {r.application_type ? r.application_type.replace('_', '-').toLowerCase() : 'any application'}</td>
                    <td className="px-4 py-2.5">{r.min_capacity != null || r.max_capacity != null ? `${r.min_capacity ?? 0} – ${r.max_capacity ?? '∞'}` : 'Any'}</td>
                    <td className="px-4 py-2.5">{r.effective_from}{r.effective_to ? ` → ${r.effective_to}` : ' →'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">₹ {Number(r.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant={r.is_active ? 'secondary' : 'primary'} isLoading={busy} onClick={() => act(() => feesApi.updateRule(r.id, { isActive: !r.is_active }))}>
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
            <h2 className="text-sm font-bold text-slate-900">Default certificate validity</h2>
            <p className="text-xs text-slate-500 mb-3">Used for the certificate's "valid until" date when the admin does not enter one.</p>
            <ul className="divide-y divide-slate-100">
              {types.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <span className="flex-1 text-sm font-semibold">{t.name}</span>
                  <input
                    type="number" min="1" max="120" aria-label={`Validity in months for ${t.name}`}
                    value={months[t.id] ?? ''} onChange={(e) => setMonths({ ...months, [t.id]: e.target.value })}
                    className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500">months</span>
                  <Button size="sm" variant="secondary" isLoading={busy} disabled={!months[t.id] || Number(months[t.id]) === t.default_validity_months}
                    onClick={() => act(() => feesApi.setValidity(t.id, Number(months[t.id])))}>Save</Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <DocumentRequirementsAdmin />
    </div>
  );
};
