import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NameplateQueueStatus } from '../../api/workflow.api';
import { NameplateCheck } from '../../components/instruments/NameplateCheck';
import { useAuth } from '../../context/AuthContext';

const TABS: Array<[NameplateQueueStatus, string]> = [
  ['PENDING_REVIEW', 'Waiting for a decision'],
  ['CONFIRMED_MISMATCH', 'Confirmed mismatch'],
  ['CONFIRMED_MATCH', 'Confirmed match'],
  ['UNREADABLE', 'Unreadable'],
  ['ALL', 'All'],
];

/** Officer / administrator queue of nameplate photos with the OCR reading and the registered data side by side. */
export const NameplateQueuePage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<NameplateQueueStatus>('PENDING_REVIEW');
  if (isLoading) return null;
  const role = user?.role_id || '';
  if (!user || !['ADMIN', 'LMO', 'GATC'].includes(role)) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nameplate review queue</h1>
        <p className="text-sm text-slate-500">
          {role === 'ADMIN' ? 'Every nameplate photo.' : 'Photos for instruments assigned to you.'} A person always makes the final call; the text reading is advice.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${status === value ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>
      <NameplateCheck key={status} queueStatus={status} role={role} userId={user.id} />
    </div>
  );
};
