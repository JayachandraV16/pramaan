import React, { useCallback, useEffect, useState } from 'react';
import { getFileUrl } from '../../api/client';
import {
  nameplateApi,
  NameplateAdvisory,
  NameplateCheck as Check,
  NameplateFieldStatus,
  NameplateQueueStatus,
} from '../../api/workflow.api';
import { Button } from '../common/Button';

interface Props {
  /** One instrument's checks (with upload). Omit and pass `queueStatus` for the officer/admin review queue. */
  instrumentId?: string;
  queueStatus?: NameplateQueueStatus;
  role: string;
  userId: string;
}

const FIELD_LABEL: Record<string, string> = {
  serialNumber: 'Serial number',
  manufacturer: 'Manufacturer',
  model: 'Model',
  capacity: 'Capacity',
  accuracyClass: 'Accuracy class',
};

const FIELD_STYLE: Record<NameplateFieldStatus, { text: string; cls: string }> = {
  MATCH: { text: 'Match', cls: 'bg-emerald-100 text-emerald-800' },
  CLOSE: { text: 'Close - check', cls: 'bg-amber-100 text-amber-800' },
  MISMATCH: { text: 'Mismatch', cls: 'bg-rose-100 text-rose-800' },
  NOT_READ: { text: 'Not read', cls: 'bg-slate-200 text-slate-700' },
  NOT_REGISTERED: { text: 'Not registered', cls: 'bg-slate-100 text-slate-500' },
};

const ADVISORY_STYLE: Record<NameplateAdvisory, { text: string; cls: string }> = {
  ALL_MATCH: { text: 'Machine suggests: all fields match', cls: 'bg-emerald-50 border-emerald-300 text-emerald-900' },
  NEEDS_REVIEW: { text: 'Machine suggests: needs a careful look', cls: 'bg-amber-50 border-amber-300 text-amber-900' },
  LIKELY_MISMATCH: { text: 'Machine suggests: details do not match', cls: 'bg-rose-50 border-rose-300 text-rose-900' },
  UNREADABLE: { text: 'Machine could not read the plate', cls: 'bg-slate-100 border-slate-300 text-slate-800' },
};

const STATUS_TEXT: Record<string, { text: string; cls: string }> = {
  PENDING_REVIEW: { text: 'Waiting for a person to confirm', cls: 'bg-sky-100 text-sky-800' },
  CONFIRMED_MATCH: { text: 'Confirmed: matches the record', cls: 'bg-emerald-100 text-emerald-800' },
  CONFIRMED_MISMATCH: { text: 'Confirmed: does not match', cls: 'bg-rose-100 text-rose-800' },
  UNREADABLE: { text: 'Decided: photo unreadable', cls: 'bg-slate-200 text-slate-700' },
};

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** OCR-assisted nameplate check: upload a photo, see what was read against the registered data, a person decides. */
export const NameplateCheck: React.FC<Props> = ({ instrumentId, queueStatus, role, userId }) => {
  const inQueue = !instrumentId;
  const canReview = role === 'ADMIN' || role === 'LMO' || role === 'GATC';
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([nameplateApi.status(), instrumentId ? nameplateApi.list(instrumentId) : nameplateApi.queue(queueStatus)]);
      setAvailable(s.available);
      setChecks(list);
    } catch (e: any) {
      setError(e?.message || 'Could not load nameplate checks.');
    }
  }, [instrumentId, queueStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file || !instrumentId) return;
    setBusy(true);
    setError(null);
    try {
      await nameplateApi.upload(instrumentId, file);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not read the photo.');
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (c: Check) => {
    const d = decision[c.id] as 'CONFIRMED_MATCH' | 'CONFIRMED_MISMATCH' | 'UNREADABLE' | undefined;
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      await nameplateApi.review(c.id, { decision: d, note: note[c.id] || undefined });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-4" aria-label="Nameplate check">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{inQueue ? 'Nameplate photos to review' : 'Nameplate check (assisted by OCR)'}</h2>
          <p className="text-xs text-slate-500">
            {inQueue
              ? 'Look at the photo itself: the machine reading is a suggestion and you decide.'
              : "Photograph the instrument's nameplate. The text is read on this server and compared with the registered details. It is a suggestion only: a person confirms the result."}
          </p>
        </div>
        {inQueue ? null : available === false ? (
          <span className="text-xs rounded-lg bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2">
            Text reading is not set up on this server (run <code>npm run ocr:setup</code>). Check the plate by eye.
          </span>
        ) : (
          <label className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold text-white ${busy ? 'bg-slate-400' : 'bg-[#1a3a5c] hover:bg-[#12263d] cursor-pointer'}`}>
            {busy ? 'Reading…' : 'Upload nameplate photo'}
            <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" disabled={busy || available === null}
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {checks.length === 0 && available !== null && <p className="text-sm text-slate-500" data-testid="nameplate-empty">{inQueue ? 'Nothing to show here.' : 'No nameplate has been checked yet.'}</p>}

      {checks.map((c) => {
        const adv = ADVISORY_STYLE[c.advisory];
        const st = STATUS_TEXT[c.status];
        const canDecide = canReview && c.status === 'PENDING_REVIEW' && c.uploaded_by_id !== userId;
        return (
          <article key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-3" data-testid="nameplate-check">
            {inQueue && (
              <p className="text-sm font-bold text-slate-900">
                {c.instrument_name} <span className="font-mono text-xs font-normal text-slate-600">{c.instrument_serial}</span>
                <span className="ml-2 text-xs font-normal text-slate-500">owner: {c.owner_name}</span>
              </p>
            )}
            <a href={getFileUrl(c.file_url)} target="_blank" rel="noreferrer" className="block">
              <img src={getFileUrl(c.file_url)} alt="Nameplate photo" loading="lazy" data-testid="nameplate-image"
                className="max-h-56 rounded-lg border border-slate-200 bg-slate-50 object-contain" />
            </a>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{when(c.created_at)} · {c.uploaded_by_name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
              <a href={getFileUrl(c.file_url)} target="_blank" rel="noreferrer" className="text-[#1a3a5c] font-semibold hover:underline">View photo</a>
              <span className="ml-auto">OCR confidence {c.ocr_confidence != null ? Math.round(Number(c.ocr_confidence)) : '-'}%</span>
            </div>

            <div className={`rounded-lg border px-3 py-2 text-sm ${adv.cls}`} role="status">
              <p className="font-semibold">{adv.text}</p>
              <p className="text-xs mt-0.5">{c.advisory_summary}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="py-1.5 pr-3">Field</th><th className="pr-3">Registered</th><th className="pr-3">Read from plate</th><th>Result</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(FIELD_LABEL).map((key) => {
                    const f = c.comparison.fields[key];
                    if (!f) return null;
                    const s = FIELD_STYLE[f.status];
                    return (
                      <tr key={key}>
                        <td className="py-1.5 pr-3 font-semibold text-slate-700">{FIELD_LABEL[key]}</td>
                        <td className="pr-3">{f.registered ?? '-'}</td>
                        <td className="pr-3 font-mono text-xs">{f.read ?? '-'}</td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span>
                          {f.note && <span className="ml-2 text-[11px] text-slate-500">{f.note}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {Object.keys(c.comparison.extra || {}).length > 0 && (
              <p className="text-xs text-slate-500">
                Also printed on the plate: {Object.entries(c.comparison.extra).map(([k, v]) => `${k === 'year' ? 'year' : 'approval no.'} ${v}`).join(', ')}
              </p>
            )}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Raw text read by the engine ({c.engine})</summary>
              <pre className="mt-1 whitespace-pre-wrap bg-slate-50 rounded p-2 text-[11px]">{c.raw_text || '(nothing read)'}</pre>
            </details>

            {c.status !== 'PENDING_REVIEW' && (
              <p className="text-sm text-slate-700">
                Decided by <strong>{c.reviewed_by_name}</strong> on {c.reviewed_at ? when(c.reviewed_at) : ''}
                {c.review_note ? `: “${c.review_note}”` : '.'}
              </p>
            )}
            {c.status === 'PENDING_REVIEW' && canReview && !canDecide && c.uploaded_by_id === userId && (
              <p className="text-xs text-slate-500">You uploaded this photo, so a different person has to confirm it.</p>
            )}

            {canDecide && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Your decision (check the plate itself, not only this table)</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {([['CONFIRMED_MATCH', 'Details match the record'], ['CONFIRMED_MISMATCH', 'Details do not match'], ['UNREADABLE', 'Photo not usable']] as const).map(([v, text]) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name={`decision-${c.id}`} value={v} checked={decision[c.id] === v} onChange={() => setDecision({ ...decision, [c.id]: v })} />
                      {text}
                    </label>
                  ))}
                </div>
                <input
                  value={note[c.id] || ''}
                  onChange={(e) => setNote({ ...note, [c.id]: e.target.value })}
                  placeholder={decision[c.id] && decision[c.id] !== 'CONFIRMED_MATCH' ? 'Note (required)' : 'Note (optional)'}
                  aria-label="Note"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <Button size="sm" isLoading={busy} disabled={!decision[c.id] || (decision[c.id] !== 'CONFIRMED_MATCH' && (note[c.id] || '').trim().length < 5)} onClick={() => submitReview(c)}>
                  Record my decision
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};
