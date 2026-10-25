import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFileUrl } from '../../api/client';
import { HqCertificateEvidence, hqApi } from '../../api/hq.api';
import { Fingerprint } from '../certificates/Fingerprint';
import { LoadingSpinner } from '../common/LoadingSpinner';

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const Person: React.FC<{ p: { id: string | null; name: string | null } | null | undefined }> = ({ p }) => (
  <span>{p && p.name ? p.name : '-'}{p && p.id ? <span className="ml-1 font-mono text-[10px] text-slate-400">({p.id.slice(0, 8)})</span> : null}</span>
);
const section = 'rounded-xl border border-slate-200 p-4 space-y-2';
const Row: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div className="flex gap-3 text-sm"><dt className="w-40 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 break-words text-slate-900">{children}</dd></div>
);

/** Everything needed to re-check one certificate: IDs, fingerprints, readings, photos, who did what and when. */
export const EvidencePack: React.FC<{ certificateId: string }> = ({ certificateId }) => {
  const [pack, setPack] = useState<HqCertificateEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPack(null);
    setError(null);
    hqApi.certificateEvidence(certificateId).then(setPack).catch((e) => setError(e?.message || 'Could not load the evidence.'));
  }, [certificateId]);

  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>;
  if (!pack) return <LoadingSpinner label="Collecting the evidence..." />;
  const { certificate: c, instrument: i, verification: v } = pack;

  return (
    <div className="space-y-4" data-testid="evidence-pack">
      <p className="text-xs text-slate-500">Prepared {when(pack.generatedAt)}. Opening this pack is recorded in the audit log.</p>

      <section className={section}>
        <h4 className="text-sm font-bold text-slate-900">Certificate</h4>
        <dl className="space-y-1">
          <Row k="Number"><span className="font-mono font-semibold">{c.number}</span> · {c.status}</Row>
          <Row k="Certificate ID"><span className="font-mono text-xs">{c.id}</span></Row>
          <Row k="Valid">{c.validFrom} to {c.validUntil} (issued {c.issueDate})</Row>
          <Row k="Issued by"><Person p={c.issuedBy} /> {c.issuedBy ? `at ${when(c.issuedBy.at)}` : ''}</Row>
          <Row k="PDF signature">{c.signature.signed ? `signed by ${c.signature.subject || '-'}` : 'not digitally signed'}</Row>
          {c.revocation && <Row k="Revoked">{when(c.revocation.at)} by <Person p={c.revocation.by} />: {c.revocation.reason}</Row>}
          {c.file_url && <Row k="PDF"><a href={getFileUrl(c.file_url)} target="_blank" rel="noreferrer" className="text-[#1a3a5c] font-semibold hover:underline">Open the issued PDF</a></Row>}
        </dl>
        {c.fingerprints.recordSha256 && (
          <Fingerprint testId="evidence-record-fingerprint" title="Record fingerprint (SHA-256, 64 characters)" hash={c.fingerprints.recordSha256}
            note={c.fingerprints.recordMatches ? 'Recomputed just now from the stored record: it agrees.' : 'Recomputed just now from the stored record: it DOES NOT agree. The record was changed after issue.'} />
        )}
        {c.fingerprints.pdfSha256 && <Fingerprint testId="evidence-pdf-fingerprint" title="PDF file fingerprint (SHA-256, 64 characters)" hash={c.fingerprints.pdfSha256} note="Identifies the exact PDF issued. It is not a digital signature." />}
      </section>

      <section className={section}>
        <h4 className="text-sm font-bold text-slate-900">Instrument and application</h4>
        <dl className="space-y-1">
          <Row k="Instrument"><Link to={`/instruments/${i.id}`} className="font-semibold text-[#1a3a5c] hover:underline">{i.name}</Link> · serial <span className="font-mono">{i.serialNumber}</span></Row>
          <Row k="Owner"><Person p={i.owner} /></Row>
          <Row k="Application"><Link to={`/applications/${pack.application.id}`} className="font-mono text-[#1a3a5c] hover:underline">{pack.application.number}</Link></Row>
          {i.location && <Row k="Registered location">{i.location.lat.toFixed(6)}, {i.location.lng.toFixed(6)}</Row>}
        </dl>
      </section>

      <section className={section}>
        <h4 className="text-sm font-bold text-slate-900">Field verification</h4>
        <dl className="space-y-1">
          <Row k="Verification ID"><Link to={`/verifications/${v.id}`} className="font-mono text-xs text-[#1a3a5c] hover:underline">{v.id}</Link></Row>
          <Row k="Officer"><Person p={v.officer} /></Row>
          <Row k="Started / finished">{when(v.startedAt)} / {when(v.endedAt)}</Row>
          <Row k="Start GPS">{v.startGps ? `${v.startGps.lat.toFixed(6)}, ${v.startGps.lng.toFixed(6)}` : 'not recorded'}</Row>
          <Row k="Decision">{v.decision || '-'} {v.decidedBy ? <>by <Person p={v.decidedBy} /> at {when(v.decidedAt)}</> : null}</Row>
        </dl>
        {v.resultSha256 && <Fingerprint testId="evidence-result-seal" title="Result seal (SHA-256, 64 characters)" hash={v.resultSha256} note="Sealed when the result was recorded; readings can no longer be changed." />}
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500"><tr><th className="py-1">Reading</th><th>Expected</th><th>Observed</th><th>Tolerance</th><th>Result</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {pack.readings.map((r) => (<tr key={r.id}><td className="py-1">{r.type}</td><td>{r.expected ?? '-'} {r.unit}</td><td>{r.observed} {r.unit}</td><td>{r.tolerance ?? '-'}</td><td className="font-semibold">{r.result}</td></tr>))}
            {pack.readings.length === 0 && <tr><td colSpan={5} className="py-1 text-slate-500">No readings.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className={section} data-testid="evidence-photos">
        <h4 className="text-sm font-bold text-slate-900">Inspection photos ({pack.photos.length})</h4>
        {pack.photos.length === 0 && <p className="text-sm text-slate-500">No inspection photos were recorded.</p>}
        <ul className="grid sm:grid-cols-2 gap-3">
          {pack.photos.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-lg border border-slate-200 p-2">
              <a href={getFileUrl(p.file_url)} target="_blank" rel="noreferrer"><img src={getFileUrl(p.file_url)} alt={p.kind} className="h-16 w-16 rounded object-cover bg-slate-50" loading="lazy" /></a>
              <div className="min-w-0 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-900">{p.kind.replace(/_/g, ' ').toLowerCase()}</p>
                <p>ID <span className="font-mono">{p.id.slice(0, 8)}</span> · {when(p.capturedAt || p.uploadedAt)}</p>
                <p>By <Person p={p.uploadedBy} />{p.gps ? ` · GPS ${p.gps.lat.toFixed(4)}, ${p.gps.lng.toFixed(4)}` : ''}</p>
                <p className="font-mono break-all text-slate-500" title={p.sha256 || ''}>{p.sha256 ? `SHA-256 ${p.sha256}` : 'no fingerprint'}</p>
              </div>
            </li>
          ))}
        </ul>
        {pack.nameplateChecks.length > 0 && (
          <div className="pt-2">
            <h5 className="text-xs font-bold text-slate-700">Nameplate checks</h5>
            <ul className="text-xs text-slate-600 space-y-1">
              {pack.nameplateChecks.map((n) => (<li key={n.id}>{when(n.at)} · {n.status.replace(/_/g, ' ').toLowerCase()} (machine: {n.advisory.replace(/_/g, ' ').toLowerCase()}) · uploaded by {n.uploadedBy}{n.reviewedBy ? `, decided by ${n.reviewedBy}` : ''} · <span className="font-mono">{n.sha256 ? n.sha256.slice(0, 16) + '…' : ''}</span></li>))}
            </ul>
          </div>
        )}
      </section>

      <section className={section}>
        <h4 className="text-sm font-bold text-slate-900">Audit trail</h4>
        <ol className="space-y-1 text-xs text-slate-700">
          {pack.auditTrail.map((e) => (
            <li key={e.id}>{when(e.at)} · <strong>{e.action.replace(/_/g, ' ').toLowerCase()}</strong> by <Person p={e.by} /> · <span className="font-mono text-slate-400" title={e.hash}>{e.hash.slice(0, 12)}…</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
};
