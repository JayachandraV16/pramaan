import React, { useCallback, useEffect, useState } from 'react';
import { getFileUrl } from '../../api/client';
import { QueryThread, queriesApi } from '../../api/workflow.api';
import { Button } from '../common/Button';

interface Props {
  threadId: string;
  role: string;
  userId: string;
  /** called after a reply, close or reopen so a surrounding list can refresh */
  onChanged?: () => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const HISTORY_TEXT: Record<string, string> = {
  QUERY_OPENED: 'Opened',
  QUERY_REPLIED: 'Replied',
  QUERY_CLOSED: 'Closed',
  QUERY_REOPENED: 'Reopened',
};

/** One query thread: messages with their files, a reply box (with an optional file), close / reopen and the thread history. */
export const QueryThreadView: React.FC<Props> = ({ threadId, userId, onChanged }) => {
  const [thread, setThread] = useState<QueryThread | null>(null);
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setThread(await queriesApi.get(threadId));
    } catch (e: any) {
      setError(e?.message || 'Could not load this query.');
    }
  }, [threadId]);
  useEffect(() => {
    setThread(null);
    setError(null);
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (!thread) return error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : <p className="text-sm text-slate-500">Loading…</p>;
  // only an administrator or the assigned officer may resolve; the server decides and says so in can_close
  const canResolve = !!thread.can_close;
  const statusText = thread.status === 'CLOSED' ? 'Resolved and closed' : thread.awaiting === 'APPLICANT' ? 'Open: waiting for the applicant' : thread.awaiting === 'DEPARTMENT' ? 'Open: waiting for the department' : 'Open';

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3" data-testid="query-thread">
      <div>
        <p className="text-sm font-bold text-slate-900">{thread.subject}</p>
        <p className="text-[11px] text-slate-500">
          {thread.kind === 'DOCUMENT_REQUEST' ? 'Document request' : 'Clarification'}
          {thread.application_number ? ` · Application ${thread.application_number}` : ''}
        </p>
        <p className="mt-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${thread.status === 'CLOSED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`} data-testid="query-status">{statusText}</span>
        </p>
      </div>

      {thread.kind === 'DOCUMENT_REQUEST' && thread.requested_items && thread.requested_items.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="requested-items">
          <p className="text-xs font-semibold">Documents requested</p>
          <ul className="list-disc ml-5">
            {thread.requested_items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      <ul className="space-y-2 max-h-80 overflow-y-auto">
        {(thread.messages || []).map((m) => (
          <li key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.author_id === userId ? 'bg-[#1a3a5c] text-white ml-8' : 'bg-white border border-slate-200 mr-8'}`}>
            <span className="block text-[11px] opacity-75">{m.author_name} · {label(m.author_role)} · {fmt(m.created_at)}</span>
            <span className="whitespace-pre-wrap">{m.body}</span>
            {(m.attachments || []).map((a) => (
              <a key={a.id} href={getFileUrl(a.file_url)} target="_blank" rel="noreferrer" data-testid="query-attachment"
                className={`mt-1 block text-xs font-semibold underline ${m.author_id === userId ? 'text-sky-200' : 'text-[#1a3a5c]'}`}>
                File: {a.file_name}
              </a>
            ))}
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {thread.status === 'OPEN' ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reply.trim()) return;
            run(async () => {
              await queriesApi.reply(thread.id, reply.trim(), file || undefined);
              setReply('');
              setFile(null);
            });
          }}
        >
          <div className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" placeholder="Write a reply"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            <Button type="submit" size="sm" isLoading={busy} disabled={!reply.trim()}>Send</Button>
            {canResolve && (
              <Button type="button" size="sm" variant="secondary" onClick={() => run(() => queriesApi.close(thread.id))}>Resolve and close</Button>
            )}
          </div>
          <label className="block text-xs text-slate-600">
            Attach a file (JPG, PNG or PDF, up to 10 MB){thread.kind === 'DOCUMENT_REQUEST' ? ' - send the requested document here' : ''}
            <input type="file" accept="image/jpeg,image/png,application/pdf" aria-label="Attach a file" data-testid="reply-file"
              onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block text-xs" />
          </label>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">This thread is closed.</p>
          {canResolve && <Button type="button" size="sm" variant="secondary" isLoading={busy} onClick={() => run(() => queriesApi.reopen(thread.id))}>Reopen</Button>}
        </div>
      )}

      {thread.history && thread.history.length > 0 && (
        <details className="text-xs text-slate-600" data-testid="query-history">
          <summary className="cursor-pointer font-semibold">History ({thread.history.length})</summary>
          <ol className="mt-1 space-y-0.5">
            {thread.history.map((h, i) => (
              <li key={i}>{fmt(h.occurred_at)} · {HISTORY_TEXT[h.action] || h.action} by {h.actor_name || 'system'}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
};
