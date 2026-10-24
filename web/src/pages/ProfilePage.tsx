import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/workflow.api';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]';
const card = 'bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-3';

type Notice = { kind: 'ok' | 'err'; text: string } | null;

const NoticeLine: React.FC<{ n: Notice }> = ({ n }) =>
  n ? (
    <p role={n.kind === 'err' ? 'alert' : 'status'} className={`text-sm ${n.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
      {n.text}
    </p>
  ) : null;

/** Own profile and password. Role, e-mail and status cannot be changed here. */
export const ProfilePage: React.FC = () => {
  const { user, isLoading, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', organizationName: '', address: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<'profile' | 'pw' | null>(null);

  useEffect(() => {
    if (user) setForm({ fullName: user.full_name || '', phone: user.phone || '', organizationName: user.organization_name || '', address: user.address || '' });
  }, [user]);

  if (isLoading) return <LoadingSpinner label="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('profile');
    setProfileNotice(null);
    try {
      await profileApi.update({ fullName: form.fullName.trim(), phone: form.phone.trim(), organizationName: form.organizationName.trim(), address: form.address.trim() });
      await refreshUser();
      setProfileNotice({ kind: 'ok', text: 'Profile updated.' });
    } catch (err: any) {
      setProfileNotice({ kind: 'err', text: err?.message || 'Could not update the profile.' });
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNotice(null);
    if (pw.next !== pw.confirm) return setPwNotice({ kind: 'err', text: 'The new passwords do not match.' });
    if (pw.next.length < 8 || !/[A-Za-z]/.test(pw.next) || !/\d/.test(pw.next)) {
      return setPwNotice({ kind: 'err', text: 'Use at least 8 characters with a letter and a digit.' });
    }
    setBusy('pw');
    try {
      await profileApi.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwNotice({ kind: 'ok', text: 'Password changed.' });
    } catch (err: any) {
      setPwNotice({ kind: 'err', text: err?.message || 'Could not change the password.' });
    } finally {
      setBusy(null);
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
        <p className="text-sm text-slate-600 mt-1">{user.email} · {user.role_id.replace('_', ' ').toLowerCase()}</p>
      </div>

      <form onSubmit={saveProfile} className={card}>
        <h2 className="text-sm font-bold text-slate-900">Contact details</h2>
        <label className="block text-xs font-semibold text-slate-700">Full name<input required value={form.fullName} onChange={f('fullName')} className={inputCls} /></label>
        <label className="block text-xs font-semibold text-slate-700">Phone<input value={form.phone} onChange={f('phone')} className={inputCls} /></label>
        <label className="block text-xs font-semibold text-slate-700">Organisation<input value={form.organizationName} onChange={f('organizationName')} className={inputCls} /></label>
        <label className="block text-xs font-semibold text-slate-700">Address<input value={form.address} onChange={f('address')} className={inputCls} /></label>
        <NoticeLine n={profileNotice} />
        <Button type="submit" isLoading={busy === 'profile'}>Save changes</Button>
      </form>

      <form onSubmit={savePassword} className={card}>
        <h2 className="text-sm font-bold text-slate-900">Change password</h2>
        <label className="block text-xs font-semibold text-slate-700">Current password<input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={inputCls} /></label>
        <label className="block text-xs font-semibold text-slate-700">New password<input type="password" autoComplete="new-password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputCls} /></label>
        <label className="block text-xs font-semibold text-slate-700">Confirm new password<input type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={inputCls} /></label>
        <NoticeLine n={pwNotice} />
        <Button type="submit" isLoading={busy === 'pw'}>Change password</Button>
      </form>
    </div>
  );
};
