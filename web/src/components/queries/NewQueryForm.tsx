import React, { useState } from 'react';
import { queriesApi } from '../../api/workflow.api';
import { Button } from '../common/Button';

interface Props {
  applicationId: string;
  role: string;
  onCreated: (threadId: string) => void;
}

/** Raise a question, or (department only) ask the applicant for specific documents. */
export const NewQueryForm: React.FC<Props> = ({ applicationId, role, onCreated }) => {
  const isStaff = role === 'ADMIN' || role === 'LMO' || role === 'GATC';
  const [kind, setKind] = useState<'CLARIFICATION' | 'DOCUMENT_REQUEST'>('CLARIFICATION');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requested = items.split('\n').map((s) => s.trim()).filter(Boolean);
  const ready = subject.trim() && message.trim() && (kind === 'CLARIFICATION' || requested.length > 0);

  return (
    <form
      className="mt-4 space-y-2 border-t border-slate-100 pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const t = await queriesApi.create(applicationId, subject.trim(), message.trim(), kind === 'DOCUMENT_REQUEST' ? { kind, requestedItems: requested } : undefined);
          setSubject('');
          setMessage('');
          setItems('');
          onCreated(t.id);
        } catch (err: any) {
          setError(err?.message || 'Could not send the query.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs font-semibold text-slate-700">{kind === 'DOCUMENT_REQUEST' ? 'Request documents' : 'Raise a new query'}</p>
      {isStaff && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" name="query-kind" checked={kind === 'CLARIFICATION'} onChange={() => setKind('CLARIFICATION')} />Ask a question</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="query-kind" checked={kind === 'DOCUMENT_REQUEST'} onChange={() => setKind('DOCUMENT_REQUEST')} />Request documents</label>
        </div>
      )}
      <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Query subject" placeholder="Subject" required
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Query message" rows={2} required
        placeholder={kind === 'DOCUMENT_REQUEST' ? 'Why these documents are needed' : 'Describe what you need clarified'}
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      {kind === 'DOCUMENT_REQUEST' && (
        <textarea value={items} onChange={(e) => setItems(e.target.value)} aria-label="Documents requested" rows={3}
          placeholder={'One document per line, for example:\nCalibration certificate\nPurchase invoice'}
          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      )}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <Button type="submit" size="sm" isLoading={busy} disabled={!ready}>{kind === 'DOCUMENT_REQUEST' ? 'Send request' : 'Send query'}</Button>
    </form>
  );
};
