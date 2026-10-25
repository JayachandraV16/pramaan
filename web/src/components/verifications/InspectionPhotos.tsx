import React, { useCallback, useEffect, useState } from 'react';
import { getFileUrl } from '../../api/client';
import { EVIDENCE_KIND_LABEL, EvidenceKind, EvidencePhoto, evidenceApi } from '../../api/workflow.api';

interface Props {
  verificationId: string;
  /** Officers and administrators may add photos while the inspection is in progress. */
  canUpload: boolean;
}

const KINDS = Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[];

/** Photos taken during the inspection: readings, test weights, seals and the instrument's condition. */
export const InspectionPhotos: React.FC<Props> = ({ verificationId, canUpload }) => {
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [kind, setKind] = useState<EvidenceKind>('READING');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPhotos(await evidenceApi.list(verificationId));
    } catch (e: any) {
      setError(e?.message || 'Could not load the inspection photos.');
    }
  }, [verificationId]);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await evidenceApi.upload(verificationId, kind, file, note.trim() || undefined);
      setNote('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not upload the photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-4" aria-label="Inspection photos" data-testid="inspection-photos">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Inspection photos</h2>
        <p className="text-xs text-slate-500">Photos of the displayed reading, the test weights, the seals and the condition of the instrument. Each file is fingerprinted when it is uploaded.</p>
      </div>

      {canUpload && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-700">
            What does the photo show?
            <select value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)} data-testid="evidence-kind" className="mt-1 block border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              {KINDS.map((k) => <option key={k} value={k}>{EVIDENCE_KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 flex-1 min-w-[160px]">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </label>
          <label className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold text-white ${busy ? 'bg-slate-400' : 'bg-[#1a3a5c] hover:bg-[#12263d] cursor-pointer'}`}>
            {busy ? 'Uploading…' : 'Add photo'}
            <input type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" disabled={busy} data-testid="evidence-file"
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">No inspection photos yet.</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <li key={p.id} className="border border-slate-200 rounded-xl overflow-hidden" data-testid="evidence-item">
              <a href={getFileUrl(p.file_url)} target="_blank" rel="noreferrer">
                <img src={getFileUrl(p.file_url)} alt={p.evidence_kind ? EVIDENCE_KIND_LABEL[p.evidence_kind] : p.file_name} loading="lazy" className="h-28 w-full object-cover bg-slate-50" />
              </a>
              <div className="p-2 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-800">{p.evidence_kind ? EVIDENCE_KIND_LABEL[p.evidence_kind] : 'Photo'}</p>
                {p.description && <p>{p.description}</p>}
                {p.file_sha256 && <p className="font-mono text-slate-400" title={p.file_sha256}>{p.file_sha256.slice(0, 12)}…</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
