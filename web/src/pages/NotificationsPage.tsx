import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { notificationsApi, AppNotification } from '../api/workflow.api';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';

const TYPE_LABEL: Record<string, string> = {
  APPLICATION_UPDATE: 'Application',
  VERIFICATION_SCHEDULED: 'Scheduled',
  CERTIFICATE_ISSUED: 'Certificate issued',
  CERTIFICATE_EXPIRING: 'Expiring soon',
  CERTIFICATE_EXPIRED: 'Expired',
  CERTIFICATE_REVOKED: 'Revoked',
  QUERY_MESSAGE: 'Query',
};

const TONE: Record<string, string> = {
  CERTIFICATE_EXPIRING: 'bg-amber-100 text-amber-800',
  CERTIFICATE_EXPIRED: 'bg-rose-100 text-rose-800',
  CERTIFICATE_REVOKED: 'bg-rose-100 text-rose-800',
  CERTIFICATE_ISSUED: 'bg-emerald-100 text-emerald-800',
};

const when = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** In-app notification centre: application updates, schedules, certificate and expiry alerts, queries. */
export const NotificationsPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await notificationsApi.list());
    } catch (e: any) {
      setError(e?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return <LoadingSpinner label="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;

  const unread = items.filter((n) => !n.read_at).length;
  const shown = onlyUnread ? items.filter((n) => !n.read_at) : items;

  const target = (n: AppNotification) =>
    n.related_certificate_id ? `/certificates/${n.related_certificate_id}` : n.related_application_id ? `/applications/${n.related_application_id}` : null;

  const open = async (n: AppNotification) => {
    const to = target(n);
    if (!n.read_at) {
      try {
        await notificationsApi.markRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      } catch {
        /* navigating matters more than the read flag */
      }
    }
    if (to) navigate(to);
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update notifications.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{t('notif.title', 'Notifications')}</h1>
          <p className="text-sm text-slate-600">{unread ? t('notif.unreadCount', '{n} unread', { n: unread }) : t('notif.caughtUp', 'You are all caught up.')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
          {t('notif.unreadOnly', 'Unread only')}
        </label>
        <Button size="sm" variant="secondary" isLoading={busy} disabled={!unread} onClick={markAll}>
          {t('notif.markAll', 'Mark all as read')}
        </Button>
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}

      {loading ? (
        <LoadingSpinner label="Loading notifications..." />
      ) : shown.length === 0 && !error ? (
        <EmptyState title={t('notif.empty', 'Nothing to show')} description={onlyUnread ? t('notif.emptyHelp', 'Updates about your applications and certificates will appear here.') : t('notif.emptyHelp', 'Updates about your applications and certificates will appear here.')} />
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 shadow-gov divide-y divide-slate-100 overflow-hidden">
          {shown.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 ${n.read_at ? '' : 'bg-sky-50/60'}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-[#1a3a5c]'}`} aria-label={n.read_at ? 'Read' : 'Unread'} />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${n.read_at ? 'font-medium' : 'font-bold'} text-slate-900`}>{n.title}</span>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${TONE[n.type] || 'bg-slate-100 text-slate-700'}`}>{t(`notif.type.${n.type}`, TYPE_LABEL[n.type] || n.type)}</span>
                  </span>
                  <span className="block text-sm text-slate-600 mt-0.5">{n.message}</span>
                  <span className="block text-[11px] text-slate-400 mt-1">{when(n.created_at, lang)}</span>
                </span>
                {target(n) && <span className="self-center text-xs text-[#1a3a5c] font-semibold">{t('notif.open', 'Open →')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Notifications are shown inside Pramaan only; e-mail and SMS delivery is not set up yet. <Link to="/dashboard" className="underline">Back to dashboard</Link>
      </p>
    </div>
  );
};
