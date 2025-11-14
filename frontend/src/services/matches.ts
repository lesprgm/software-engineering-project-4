import api from '../lib/api';

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function mockResponse<T>(data: T) {
  return Promise.resolve({ data });
}

export interface UserMatchCandidate {
  user_id: string;
  display_name: string;
  compatibility_score: number;
  shared_interests: string[];
  schedule_score: number;
  personality_overlap: number;
  bio?: string;
  tagline?: string;
  photos?: string[];
}

export interface UserMatchResponse {
  candidates: UserMatchCandidate[];
}

export interface SwipeAction {
  target_user_id: string;
  swiped_right: boolean;
}

export interface SwipeResponse {
  is_mutual_match: boolean;
  message: string;
}

export const matchesService = {
  getUserMatches: (userId: string, limit = 10) =>
    isTestEnv
      ? mockResponse<UserMatchResponse>({ candidates: [] })
      : api.get<UserMatchResponse>(`/matches/users/${userId}`, { params: { limit } }),
  
  recordSwipe: (userId: string, swipe: SwipeAction) =>
    isTestEnv
      ? mockResponse<SwipeResponse>({ is_mutual_match: false, message: 'test-mode swipe recorded' })
      : api.post<SwipeResponse>(`/matches/users/${userId}/swipe`, swipe),
  
  getMutualMatches: (userId: string) =>
    isTestEnv
      ? mockResponse<UserMatchResponse>({ candidates: [] })
      : api.get<UserMatchResponse>(`/matches/users/${userId}/mutual`),

  getRightSwipes: (userId: string) =>
    isTestEnv
      ? mockResponse<UserMatchResponse>({ candidates: [] })
      : api.get<UserMatchResponse>(`/matches/users/${userId}/right-swipes`),
};
