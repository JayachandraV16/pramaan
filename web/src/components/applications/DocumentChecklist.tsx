import React, { useCallback, useEffect, useState } from 'react';
import { documentsApi, DocumentChecklist as Checklist } from '../../api/workflow.api';
import { useI18n } from '../../i18n/I18nContext';

interface Props {
  applicationId: string;
  canUpload: boolean;
  /** reloaded when the application changes (e.g. status) */
  refreshKey?: string;
}

/** Documents the application needs, with what has been uploaded. Renders nothing when none are required. */
export const DocumentChecklist: React.FC<Props> = ({ applicationId, canUpload, refreshKey }) => {
  const { lang } = useI18n();
  const [list, setList] = useState<Checklist | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await documentsApi.checklist(applicationId));
    } catch {
      setList(null); // not allowed or not available: show nothing
    }
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!list || list.items.length === 0) return null;

  const upload = async (documentType: string, file: File | undefined) => {
    if (!file) return;
    setBusyType(documentType);
    setError(null);
    try {
      await documentsApi.upload(applicationId, documentType, file);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-slate-900">Required documents</h3>
        <span className={`text-[11px] rounded-full px-2 py-0.5 font-semibold ${list.complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {list.complete ? 'Complete' : `${list.missing.length} missing`}
        </span>
      </div>
      {!list.complete && <p className="text-xs text-slate-500 mt-1">An officer can be assigned once every required document is uploaded.</p>}
      <ul className="mt-3 divide-y divide-slate-100">
        {list.items.map((item) => (
          <li key={item.documentType} className="py-2 flex flex-wrap items-center gap-3">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${item.satisfied ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`} aria-label={item.satisfied ? 'Uploaded' : 'Missing'}>
              {item.satisfied ? '✓' : '!'}
            </span>
            <span className="flex-1 min-w-0 text-sm">
              <span className="font-semibold text-slate-900">{lang === 'hi' && item.labelHi ? item.labelHi : item.label}</span>
              {item.fileName && <span className="block text-xs text-slate-500 truncate">{item.fileName}</span>}
            </span>
            {canUpload && (
              <label className="text-xs font-semibold text-[#1a3a5c] cursor-pointer hover:underline">
                {busyType === item.documentType ? 'Uploading…' : item.satisfied ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  disabled={busyType !== null}
                  onChange={(e) => {
                    upload(item.documentType, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
};
