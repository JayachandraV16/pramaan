import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { DocumentChecklist } from './DocumentChecklist';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { QueryThreadView } from '../queries/QueryThreadView';
import { NewQueryForm } from '../queries/NewQueryForm';
import {
  applicationActionsApi,
  queriesApi,
  StatusHistoryEntry,
  QueryThread,
} from '../../api/workflow.api';

interface Props {
  applicationId: string;
  status: string;
  hasVerification: boolean;
  role: string;
  userId: string;
  grasChallanNumber?: string;
  paymentVerifiedAt?: string | null;
  totalFee?: number | null;
  /** called after an action changed the application so the page can reload it */
  onChanged: () => void;
}

const OPEN_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED'];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Status timeline, admin reject / payment actions and the officer-owner query threads. */
export const ApplicationExtras: React.FC<Props> = (p) => {
  const isAdmin = p.role === 'ADMIN';
  const [history, setHistory] = useState<StatusHistoryEntry[] | null>(null);
  const [threads, setThreads] = useState<QueryThread[] | null>(null);
  const [openThread, setOpenThread] = useState<QueryThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await applicationActionsApi.history(p.applicationId));
    } catch (e: any) {
      setHistory([]);
      setError(e?.message || 'Could not load the status history.');
    }
  }, [p.applicationId]);

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await queriesApi.list(p.applicationId));
    } catch (e: any) {
      setThreads([]);
      setError(e?.message || 'Could not load queries.');
    }
  }, [p.applicationId]);

  useEffect(() => {
    loadHistory();
    loadThreads();
  }, [loadHistory, loadThreads, p.status]);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
    } catch (e: any) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const openThreadById = (id: string) => run(async () => setOpenThread(await queriesApi.get(id)));

  const canReject = isAdmin && !p.hasVerification && OPEN_STATUSES.includes(p.status);
  const needsPayment = isAdmin && !p.paymentVerifiedAt && !!p.grasChallanNumber && OPEN_STATUSES.includes(p.status);

  return (
    <section className="space-y-5" aria-label="Application activity">
      {error && (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ---------- fee / payment ---------- */}
      {(p.totalFee != null || p.grasChallanNumber) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
          <h3 className="text-sm font-bold text-slate-900">Fee and payment</h3>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Computed fee</dt>
              <dd className="font-semibold">{p.totalFee != null ? `₹ ${Number(p.totalFee).toLocaleString('en-IN')}` : 'Not configured'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">GRAS challan</dt>
              <dd className="font-mono">{p.grasChallanNumber || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Payment</dt>
              <dd>
                {p.paymentVerifiedAt ? (
                  <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                    Verified {fmt(p.paymentVerifiedAt)}
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">Not verified</span>
                )}
              </dd>
            </div>
          </dl>
          {needsPayment && (
            <Button
              className="mt-3"
              size="sm"
              isLoading={busy}
              onClick={() => run(() => applicationActionsApi.verifyPayment(p.applicationId), p.onChanged)}
            >
              Mark payment verified
            </Button>
          )}
        </div>
      )}

      {/* ---------- required documents ---------- */}
      <DocumentChecklist applicationId={p.applicationId} canUpload={isAdmin || p.role === 'INSTRUMENT_OWNER'} refreshKey={p.status} />

      {/* ---------- reject ---------- */}
      {canReject && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
          {!showReject ? (
            <Button variant="danger" size="sm" onClick={() => setShowReject(true)}>
              Reject application…
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => applicationActionsApi.reject(p.applicationId, rejectReason.trim()),
                  () => {
                    setShowReject(false);
                    setRejectReason('');
                    p.onChanged();
                  }
                );
              }}
              className="space-y-2"
            >
              <label htmlFor="reject-reason" className="text-sm font-bold text-slate-900">
                Reason for rejection (shown to the applicant)
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                minLength={10}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
                placeholder="At least 10 characters"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" size="sm" isLoading={busy} disabled={rejectReason.trim().length < 10}>
                  Confirm rejection
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowReject(false)}>
                  Keep application
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ---------- queries ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
        <h3 className="text-sm font-bold text-slate-900">Queries and clarifications</h3>
        {threads === null ? (
          <LoadingSpinner label="Loading queries..." />
        ) : threads.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No queries on this application yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {threads.map((t) => (
              <li key={t.id} className="py-2 flex items-center gap-3">
                <button type="button" className="text-left flex-1 min-w-0" onClick={() => openThreadById(t.id)}>
                  <span className="block text-sm font-semibold text-[#1a3a5c] truncate">{t.kind === 'DOCUMENT_REQUEST' ? 'Documents: ' : ''}{t.subject}</span>
                  <span className="block text-xs text-slate-500 truncate">{t.last_message}</span>
                </button>
                {t.status === 'CLOSED' ? (
                  <span className="text-[11px] rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">Closed</span>
                ) : (
                  <span className="text-[11px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                    {t.awaiting === 'APPLICANT' ? 'Awaiting applicant' : t.awaiting === 'DEPARTMENT' ? 'Awaiting department' : 'Open'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {openThread && (
          <div className="mt-3 space-y-1">
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setOpenThread(null)}>
              Close view
            </button>
            <QueryThreadView threadId={openThread.id} role={p.role} userId={p.userId} onChanged={loadThreads} />
          </div>
        )}

        {p.role !== 'PUBLIC_USER' && (
          <NewQueryForm
            applicationId={p.applicationId}
            role={p.role}
            onCreated={async (id) => {
              await loadThreads();
              setOpenThread(await queriesApi.get(id));
            }}
          />
        )}
      </div>

      {/* ---------- history ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
        <h3 className="text-sm font-bold text-slate-900">Status history</h3>
        {history === null ? (
          <LoadingSpinner label="Loading history..." />
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">No recorded changes.</p>
        ) : (
          <ol className="mt-3 border-l-2 border-slate-200 ml-2 space-y-3">
            {history.map((h) => (
              <li key={h.id} className="pl-4 relative">
                <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-[#1a3a5c]" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">
                  {h.from_status ? `${label(h.from_status)} → ` : ''}
                  {label(h.to_status)}
                </p>
                <p className="text-xs text-slate-500">
                  {fmt(h.changed_at)}
                  {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                </p>
                {h.reason && <p className="text-xs text-slate-700 mt-0.5">“{h.reason}”</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
