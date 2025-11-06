import { create } from 'zustand';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  interests?: string[];
};

type AuthState = {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
};

const TOKEN_KEY = 'cc_token';
const USER_KEY = 'cc_user';

function loadInitial(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as User) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));

