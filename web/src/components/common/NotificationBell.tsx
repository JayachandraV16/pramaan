import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { notificationsApi } from '../../api/workflow.api';

/** Bell with the unread count; refreshed on every navigation and once a minute. */
export const NotificationBell: React.FC = () => {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      notificationsApi
        .list()
        .then((rows) => alive && setUnread(rows.filter((n) => !n.read_at).length))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <Link
      to="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-white hover:bg-white/10"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
};
