import { create } from 'zustand';

export type NotificationKind = 'match' | 'event' | 'message' | 'system';

export type ActivityNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type NotificationState = {
  notifications: ActivityNotification[];
  unread: number;
  addNotification: (payload: Omit<ActivityNotification, 'id' | 'createdAt' | 'read'> & { createdAt?: string }) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
};

const STORAGE_KEY = 'cc_notifications';

function loadInitial(): ActivityNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(notifications: ActivityNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 20)));
  } catch {
    // ignore write errors (storage may be full)
  }
}

const initialNotifications = loadInitial();

export const useNotifications = create<NotificationState>((set) => ({
  notifications: initialNotifications,
  unread: initialNotifications.filter((n) => !n.read).length,
  addNotification: (payload) => {
    const notification: ActivityNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
    };
    set((state) => {
      const next = [notification, ...state.notifications].slice(0, 20);
      persist(next);
      return { notifications: next, unread: next.filter((n) => !n.read).length };
    });
  },
  markAllRead: () => {
    set((state) => {
      const next = state.notifications.map((n) => ({ ...n, read: true }));
      persist(next);
      return { notifications: next, unread: 0 };
    });
  },
  dismiss: (id) => {
    set((state) => {
      const next = state.notifications.filter((n) => n.id !== id);
      persist(next);
      return { notifications: next, unread: next.filter((n) => !n.read).length };
    });
  },
}));
