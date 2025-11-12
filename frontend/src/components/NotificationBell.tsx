import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../store/notifications';

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

function formatRelative(date: string) {
  const target = new Date(date).getTime();
  const now = Date.now();
  const diff = target - now;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    const value = Math.round(diff / ms);
    if (Math.abs(value) >= 1) {
      return rtf ? rtf.format(value, unit) : new Date(date).toLocaleString();
    }
  }
  return 'just now';
}

const kindIcon: Record<string, JSX.Element> = {
  match: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.202 2.25 12.143 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5 5 0 0112 5.052 5 5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.893-2.438 6.952-4.738 9.257a25.118 25.118 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.011-.007.004-.003.001a.748.748 0 01-.704 0l-.003-.001z" />
    </svg>
  ),
  event: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 2a1 1 0 011 1v1h2.25A2.75 2.75 0 0123 6.75v12.5A2.75 2.75 0 0120.25 22H3.75A2.75 2.75 0 011 19.25V6.75A2.75 2.75 0 013.75 4H6V3a1 1 0 112 0v1h8V3a1 1 0 011-1zm4 9H3v8.25c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75zM7 12.5a1 1 0 110 2 1 1 0 010-2z" />
    </svg>
  ),
  message: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v9.586A2 2 0 002.586 17L5 19.414A2 2 0 006.414 20H18a2 2 0 002-2V6a2 2 0 00-2-2H4zm1.5 4h13a.75.75 0 010 1.5h-13A.75.75 0 015.5 8zm0 3h9a.75.75 0 010 1.5h-9a.75.75 0 010-1.5z" />
    </svg>
  ),
  system: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.5a1 1 0 011 1V6h5.5a1 1 0 010 2H13v13.5a1 1 0 11-2 0V8H5.5a1 1 0 010-2H11V2.5a1 1 0 011-1z" />
    </svg>
  ),
};

export default function NotificationBell() {
  const { notifications, unread, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggle = () => {
    setOpen((value) => !value);
    if (!open) {
      setTimeout(() => markAllRead(), 400);
    }
  };

  const icon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 006.586 13h10.828a1 1 0 00.707-1.707L17 10.586V8a6 6 0 00-6-6zm0 20a3 3 0 01-2.995-2.824L9 19h6a3 3 0 01-2.824 2.995z" />
    </svg>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Open activity feed"
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 transition-colors"
      >
        {icon}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
            {Math.min(unread, 9)}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 z-50 animate-pop">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Activity</div>
              <div className="text-xs text-gray-500">{notifications.length ? 'Latest updates' : 'Nothing new yet'}</div>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-rose-600 hover:text-rose-500"
            >
              Mark read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="mt-0.5">{kindIcon[notification.kind] ?? kindIcon.system}</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{notification.title}</div>
                  <div className="text-gray-600">{notification.body}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatRelative(notification.createdAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(notification.id)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            ))}
            {!notifications.length && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                Keep exploring the app to see activity here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
