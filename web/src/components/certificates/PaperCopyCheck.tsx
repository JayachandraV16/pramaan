import React, { useRef, useState } from 'react';
import { CopyCheckResponse, certificatesApi } from '../../api/certificates.api';
import { LoadingSpinner } from '../common/LoadingSpinner';

const LEVEL_STYLE: Record<string, string> = {
  INFO: 'border-sky-300 bg-sky-50 text-sky-950',
  WARN: 'border-amber-300 bg-amber-50 text-amber-950',
  ALERT: 'border-rose-400 bg-rose-50 text-rose-950',
};
const LEVEL_TITLE: Record<string, string> = {
  INFO: 'What the check found',
  WARN: 'Be careful: not enough to rely on',
  ALERT: 'Warning: do not rely on this paper',
};
const FIELD_STYLE: Record<string, { text: string; cls: string }> = {
  MATCH: { text: 'Agrees', cls: 'bg-emerald-100 text-emerald-800' },
  CLOSE: { text: 'Close - check by eye', cls: 'bg-amber-100 text-amber-800' },
  MISMATCH: { text: 'Differs', cls: 'bg-rose-100 text-rose-800' },
  NOT_READ: { text: 'Not read from the picture', cls: 'bg-slate-200 text-slate-700' },
  NOT_ON_RECORD: { text: 'Not on record', cls: 'bg-slate-100 text-slate-500' },
};

/**
 * Public check of a paper certificate: a photo, a scan or a scanned PDF. The QR code and the printed
 * text are compared with the registry. This never says a paper is authentic: the registry is the authority.
 */
export const PaperCopyCheck: React.FC = () => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopyCheckResponse | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await certificatesApi.checkCopy(file));
    } catch (err: any) {
      setError(err?.message || 'Could not check this file.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-gov space-y-3" data-testid="paper-copy-check">
      <h3 className="text-sm font-bold text-slate-800">Have a paper certificate? Check a photo or scan of it</h3>
      <p className="text-xs text-slate-600">
        Upload a clear photograph or scan (JPG, PNG or PDF) of the whole certificate with the QR code visible. The QR code and the printed details are compared with the Pramaan registry.
        The picture is not stored.
      </p>
      <p className="text-xs rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700">
        This check can show whether the registry holds the certificate and whether the printed details agree with it. It cannot prove that a paper is the original, and reading text from a photo can make mistakes.
      </p>
      <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" onChange={onFile} aria-label="Photo or scan of the certificate" data-testid="copy-file"
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200" />
      {busy && <LoadingSpinner label="Reading the QR code and the printed text..." />}
      {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>}

      {result && (
        <div className="space-y-3" data-testid="copy-result">
          <div role="status" className={`rounded-lg border p-3 text-sm ${LEVEL_STYLE[result.conclusion.level]}`} data-testid="copy-conclusion" data-code={result.conclusion.code}>
            <p className="text-[11px] font-bold uppercase tracking-wide">{LEVEL_TITLE[result.conclusion.level]}</p>
            <p className="mt-1">{result.conclusion.text}</p>
          </div>

          <ul className="text-xs text-slate-700 space-y-0.5">
            {result.exactFile && (
              <li>File: {result.exactFile.matches ? `identical to the PDF issued as ${result.exactFile.certificateNumber}` : 'not a PDF issued by Pramaan'}</li>
            )}
            <li>QR code: {result.qr.found ? (result.qr.usable ? 'read, leads to the Pramaan portal' : result.qr.reason === 'FOREIGN_HOST' ? `read, but leads to another website (${result.qr.host})` : 'read, but is not a Pramaan verification link') : 'not found in the picture'}</li>
            <li>Printed text: {!result.printed.attempted ? 'not read (text reading is not available)' : result.printed.read ? `read (confidence about ${result.printed.confidence}%)` : 'nothing useful could be read'}</li>
            {result.registry && <li>Registry: {result.registry.certificate ? `certificate ${result.registry.certificate.certificateNumber}, status ${result.registry.result}` : 'no such certificate'}</li>}
          </ul>

          {result.comparison.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="py-1.5 pr-3">Detail</th><th className="pr-3">Printed on the paper</th><th className="pr-3">In the registry</th><th>Result</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.comparison.map((c) => {
                    const st = FIELD_STYLE[c.status] || FIELD_STYLE.NOT_READ;
                    return (
                      <tr key={c.field} data-testid={`cmp-${c.field}`} data-status={c.status}>
                        <td className="py-1.5 pr-3 font-semibold text-slate-700">{c.label}</td>
                        <td className="pr-3 font-mono text-xs">{c.printed ?? '-'}</td>
                        <td className="pr-3 font-mono text-xs">{c.registry ?? '-'}</td>
                        <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>{c.note && <span className="ml-2 text-[11px] text-slate-500">{c.note}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <ul className="list-disc ml-5 text-[11px] text-slate-500 space-y-0.5" data-testid="copy-limits">
            {result.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};
