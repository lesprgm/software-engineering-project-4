import api from '../lib/api';

export interface UserMatchCandidate {
  user_id: string;
  display_name: string;
  compatibility_score: number;
  shared_interests: string[];
  schedule_score: number;
  personality_overlap: number;
}

export interface UserMatchResponse {
  candidates: UserMatchCandidate[];
}

export const matchesService = {
  getUserMatches: (userId: string, limit = 10) =>
    api.get<UserMatchResponse>(`/matches/users/${userId}`, { params: { limit } }),
};
