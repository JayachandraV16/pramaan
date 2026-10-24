import React, { useCallback, useEffect, useState } from 'react';
import { documentsApi, DocumentRequirement } from '../../api/workflow.api';
import { Button } from '../common/Button';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]';

/** ADMIN: which supporting documents an application needs before an officer can be assigned. */
export const DocumentRequirementsAdmin: React.FC = () => {
  const [rows, setRows] = useState<DocumentRequirement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ documentType: '', label: '', labelHi: '', applicationType: '', instrumentOrigin: '' });

  const load = useCallback(async () => {
    try {
      setRows(await documentsApi.requirements());
    } catch (e: any) {
      setError(e?.message || 'Could not load document requirements.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    const body: Record<string, unknown> = { documentType: form.documentType, label: form.label };
    if (form.labelHi.trim()) body.labelHi = form.labelHi;
    if (form.applicationType) body.applicationType = form.applicationType;
    if (form.instrumentOrigin) body.instrumentOrigin = form.instrumentOrigin;
    act(async () => {
      await documentsApi.createRequirement(body);
      setForm({ documentType: '', label: '', labelHi: '', applicationType: '', instrumentOrigin: '' });
    });
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Required documents</h2>
        <p className="text-xs text-slate-500">
          Applications cannot be assigned to an officer until the listed documents are uploaded. Nothing is required until you add it here; set it according to your State's rules.
        </p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Document code *
          <input required value={form.documentType} onChange={f('documentType')} placeholder="e.g. MODEL_APPROVAL" className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Name shown to applicants *
          <input required value={form.label} onChange={f('label')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Name in Hindi
          <input value={form.labelHi} onChange={f('labelHi')} className={inputCls} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Only for
          <select value={form.applicationType} onChange={f('applicationType')} className={inputCls}>
            <option value="">Every application</option>
            <option value="VERIFICATION">First verification</option>
            <option value="RE_VERIFICATION">Re-verification</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Instrument origin
          <select value={form.instrumentOrigin} onChange={f('instrumentOrigin')} className={inputCls}>
            <option value="">Any</option>
            <option value="LOCAL">Locally made</option>
            <option value="IMPORTED">Imported</option>
          </select>
        </label>
        <div className="sm:col-span-2 flex items-end">
          <Button type="submit" isLoading={busy} disabled={!form.documentType.trim() || !form.label.trim()}>Add requirement</Button>
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No documents are required at the moment.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className={`py-2 flex flex-wrap items-center gap-3 ${r.is_active ? '' : 'opacity-50'}`}>
              <span className="flex-1 min-w-0 text-sm">
                <span className="font-semibold">{r.label}</span> <code className="text-xs text-slate-500">{r.document_type}</code>
                <span className="block text-xs text-slate-500">
                  {r.application_type ? r.application_type.replace('_', '-').toLowerCase() : 'every application'} · {r.instrument_origin ? r.instrument_origin.toLowerCase() : 'any origin'}
                </span>
              </span>
              <Button size="sm" variant="secondary" isLoading={busy} onClick={() => act(() => documentsApi.updateRequirement(r.id, { isActive: !r.is_active }))}>
                {r.is_active ? 'Switch off' : 'Switch on'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
