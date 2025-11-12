import api from '../lib/api';

export interface ParticipantProfile {
  name: string;
  bio?: string | null;
  interests?: string[];
  shared_activities?: string[];
}

export interface MatchInsightRequest {
  participants: ParticipantProfile[];
  shared_interests?: string[];
  shared_activities?: string[];
  mood?: string;
  location?: string;
}

export interface MatchInsightResponse {
  match_id: string;
  summary_text: string;
  generated_at: string;
  cached: boolean;
  moderation_applied: boolean;
}

export interface DateIdea {
  id: number;
  match_id: string;
  title: string;
  description: string;
  location?: string | null;
  idea_rank: number;
  generated_at: string;
  expires_at: string;
}

export interface DateIdeaRequest {
  match_id: string;
  shared_interests?: string[];
  location?: string;
  availability_window?: {
    start: string;
    end: string;
  } | null;
  mood?: string;
  weather?: string;
  participants?: ParticipantProfile[];
}

export interface DateIdeasResponse {
  match_id: string;
  ideas: DateIdea[];
  cached: boolean;
  generated_at: string;
}

export interface EventFilterDateRange {
  start?: string | null;
  end?: string | null;
}

export interface EventFilters {
  date_range?: EventFilterDateRange | null;
  location?: string | null;
  category?: string | null;
  keywords?: string[];
}

export interface EventRecord {
  id: string | number;
  title: string;
  description?: string | null;
  location: string;
  category: string;
  start_time: string;
  end_time: string;
  tags?: string[];
  imageUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  interest_count?: number;
  viewer_interest?: boolean;
}

export interface EventNlpResponse {
  query: string;
  filters: EventFilters;
  events: EventRecord[];
  cached: boolean;
  interpreted_query: string;
  generated_at: string;
}

export const aiApi = {
  getMatchInsight: (matchId: string, refresh = false) =>
    api.get<MatchInsightResponse>(`/matches/${matchId}/insight`, {
      params: refresh ? { refresh: true } : undefined,
    }),

  generateMatchInsight: (matchId: string, payload: MatchInsightRequest) =>
    api.post<MatchInsightResponse>(`/matches/${matchId}/insight`, payload),

  generateDateIdeas: (payload: DateIdeaRequest) =>
    api.post<DateIdeasResponse>('/ideas', payload),

  fetchDateIdeas: (matchId: string, refresh = false) =>
    api.get<DateIdeasResponse>('/ideas', {
      params: {
        match_id: matchId,
        ...(refresh ? { refresh: true } : {}),
      },
    }),

  searchEvents: (query: string, viewerId?: string, refresh = false) =>
    api.get<EventNlpResponse>('/events/nlp-search', {
      params: {
        q: query,
        ...(refresh ? { refresh: true } : {}),
        ...(viewerId ? { viewer_id: viewerId } : {}),
      },
    }),
};
