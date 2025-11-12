import { create } from 'zustand';
import { useAuthStore } from './auth';

type NotificationPref = 'toasts' | 'email' | 'silent';

type OnboardingState = {
  completed: boolean;
  interests: string[];
  availability: string | null;
  notificationPreference: NotificationPref;
  complete: () => void;
  skip: () => void;
  toggleInterest: (interest: string) => void;
  setAvailability: (value: string) => void;
  setNotificationPreference: (value: NotificationPref) => void;
};

const STORAGE_KEY = 'cc_onboarding';

function load() {
  if (typeof window === 'undefined') {
    return { completed: false, interests: [], availability: null, notificationPreference: 'toasts' as NotificationPref };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: false, interests: [], availability: null, notificationPreference: 'toasts' as NotificationPref };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      completed: parsed.completed ?? false,
      interests: parsed.interests ?? [],
      availability: parsed.availability ?? null,
      notificationPreference: parsed.notificationPreference ?? 'toasts',
    };
  } catch {
    return { completed: false, interests: [], availability: null, notificationPreference: 'toasts' as NotificationPref };
  }
}

function persist(state: Pick<OnboardingState, 'completed' | 'interests' | 'availability' | 'notificationPreference'>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

const initial = load();

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initial,
  complete: () => {
    set((state) => {
      const next = { ...state, completed: true };
      persist(next);
      const auth = useAuthStore.getState();
      if (auth.user) {
        auth.setUser({
          ...auth.user,
          interests: state.interests.length ? state.interests : auth.user.interests,
        });
      }
      return next;
    });
  },
  skip: () => {
    set((state) => {
      const next = { ...state, completed: true };
      persist(next);
      return next;
    });
  },
  toggleInterest: (interest) => {
    set((state) => {
      const exists = state.interests.includes(interest);
      const nextInterests = exists ? state.interests.filter((item) => item !== interest) : [...state.interests, interest].slice(0, 6);
      const next = { ...state, interests: nextInterests };
      persist(next);
      return next;
    });
  },
  setAvailability: (value) => {
    set((state) => {
      const next = { ...state, availability: value };
      persist(next);
      return next;
    });
  },
  setNotificationPreference: (value) => {
    set((state) => {
      const next = { ...state, notificationPreference: value };
      persist(next);
      return next;
    });
  },
}));
