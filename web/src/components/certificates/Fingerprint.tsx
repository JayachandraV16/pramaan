import React, { useState } from 'react';

interface Props {
  title: string;
  /** the full 64-character SHA-256, lower-case hex */
  hash: string;
  /** one or two plain sentences saying what this value is and is not */
  note: React.ReactNode;
  testId?: string;
}

/** The whole 64-character SHA-256 in readable groups, with a copy button and a plain explanation. */
export const Fingerprint: React.FC<Props> = ({ title, hash, note, testId }) => {
  const [copied, setCopied] = useState(false);
  const groups = hash.match(/.{1,8}/g) || [hash]; // 8 groups of 8
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available: the value is selectable on screen */
    }
  };
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 space-y-1.5" data-testid={testId}>
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700 flex-1">{title}</p>
        <button type="button" onClick={copy} className="text-[11px] font-semibold text-[#1a3a5c] hover:underline">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="font-mono text-sm font-semibold text-slate-900 break-all select-all" data-testid={testId ? `${testId}-value` : undefined} aria-label={`${title}: ${hash}`}>
        {groups.map((g, i) => (
          <span key={i} className="inline-block mr-2">{g}</span>
        ))}
      </p>
      <p className="text-[11px] text-slate-600">{note}</p>
    </div>
  );
};
