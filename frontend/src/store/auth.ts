import { create } from 'zustand';
import type { UserProfile } from '../services/users';

export type User = {
  id: string;
  email: string;
  displayName: string;
  name: string;
  email: string;
  avatarUrl?: string;
  interests?: string[];
  bio?: string;
  photos?: string[];
  pronouns?: string;
  location?: string;
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

function normalizeUser(raw: any): User | null {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.displayName ?? raw.name ?? '',
    name: raw.name ?? raw.displayName ?? '',
    avatarUrl: raw.avatarUrl,
    interests: raw.interests,
    bio: raw.bio,
    photos: raw.photos,
    pronouns: raw.pronouns,
    location: raw.location,
  };
}

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function mapProfileToAuthUser(profile: UserProfile): User {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    name: profile.displayName,
    avatarUrl: profile.photos?.[0],
    photos: profile.photos,
    interests: profile.interests,
    bio: profile.bio,
    pronouns: profile.pronouns,
    location: profile.location,
  };
}

function loadInitial(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? normalizeUser(JSON.parse(userRaw)) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    persistUser(user);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
  setUser: (user) => {
    persistUser(user);
    set({ user });
  },
}));
