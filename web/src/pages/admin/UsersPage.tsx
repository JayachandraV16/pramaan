import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi, ManagedUser, ManagedUserStatus } from '../../api/users.api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

type Tab = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'ALL';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'PENDING_APPROVAL', label: 'Awaiting approval' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'ALL', label: 'All accounts' },
];

const ROLE_LABEL: Record<string, string> = {
  INSTRUMENT_OWNER: 'Instrument owner',
  LMO: 'Legal Metrology Officer',
  GATC: 'GATC',
  ADMIN: 'Administrator',
  PUBLIC_USER: 'Public user',
};

/** ADMIN console: approve self-registered officers, suspend / reactivate accounts. */
export const UsersPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('PENDING_APPROVAL');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await usersApi.listUsers({
        status: tab === 'ALL' ? undefined : (tab as ManagedUserStatus),
        search: search.trim() || undefined,
        limit: 100,
      });
      setUsers(page.items);
      setTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Could not load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    if (user?.role_id === 'ADMIN') load();
  }, [load, user]);

  if (isAuthLoading) return <LoadingSpinner label="Loading..." />;
  if (!user || user.role_id !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const change = async (target: ManagedUser, status: 'ACTIVE' | 'SUSPENDED') => {
    const verb = status === 'ACTIVE' ? (target.status === 'PENDING_APPROVAL' ? 'approve' : 'reactivate') : 'suspend';
    if (!window.confirm(`Are you sure you want to ${verb} ${target.full_name}?`)) return;
    setBusyId(target.id);
    setActionError(null);
    try {
      await usersApi.updateStatus(target.id, status);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Could not update the account.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User accounts</h1>
        <p className="text-sm text-slate-600 mt-1">
          Officers and test centres who register online stay locked until you approve them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Account status">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              tab === t.id ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, organisation"
          aria-label="Search accounts"
          className="ml-auto w-full sm:w-72 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
        />
      </div>

      {actionError && <ErrorMessage title="Action failed" message={actionError} />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {isLoading ? (
        <LoadingSpinner label="Loading accounts..." />
      ) : users.length === 0 && !error ? (
        <EmptyState title="No accounts" description={tab === 'PENDING_APPROVAL' ? 'No one is waiting for approval.' : 'No accounts match this filter.'} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-gov overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Organisation</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-2.5">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <div>{u.email || '-'}</div>
                    <div className="text-xs">{u.phone || ''}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{u.organization_name || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : u.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {u.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                    {u.id !== user.id && (u.status === 'PENDING_APPROVAL' || u.status === 'SUSPENDED' || u.status === 'INACTIVE') && (
                      <Button size="sm" variant="primary" isLoading={busyId === u.id} onClick={() => change(u, 'ACTIVE')}>
                        {u.status === 'PENDING_APPROVAL' ? 'Approve' : 'Reactivate'}
                      </Button>
                    )}
                    {u.id !== user.id && u.status === 'ACTIVE' && (
                      <Button size="sm" variant="danger" isLoading={busyId === u.id} onClick={() => change(u, 'SUSPENDED')}>
                        Suspend
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">{total} account(s)</p>
        </div>
      )}
    </div>
  );
};
