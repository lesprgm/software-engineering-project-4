import api from '../lib/api';

// Types matching backend schemas
export interface GroupCreate {
  name: string;
  description?: string;
  owner_id: string;
}

export interface GroupRead {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  display_name?: string;
  email: string;
  role: 'owner' | 'member';
}

export interface GroupDetail extends GroupRead {
  members: GroupMember[];
}

export interface JoinGroupRequest {
  user_id: string;
  invite_code: string;
}

export interface InviteLinkResponse {
  invite_url: string;
}

export interface GroupMessageCreate {
  user_id: string;
  content: string;
}

export interface GroupMessageRead {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface GroupMessagePage {
  messages: GroupMessageRead[];
  total: number;
}

export interface AvailabilityCreate {
  user_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
}

export interface AvailabilityRead extends AvailabilityCreate {
  id: string;
}

export interface MeetingPreferences {
  duration_minutes?: number;
  window_days?: number;
  limit?: number;
}

export interface MeetingSuggestion {
  start_time: string;
  end_time: string;
  participant_ids: string[];
  conflicts: string[];
}

export interface MeetingSuggestionResponse {
  suggestions: MeetingSuggestion[];
}

export interface MeetingConfirmationRequest {
  user_id: string;
  start_time: string;
  end_time: string;
  title?: string;
}

export interface GroupMeetingRead {
  id: string;
  group_id: string;
  scheduled_start: string;
  scheduled_end: string;
  title?: string;
  suggested_by?: string;
  created_at: string;
}

export interface GroupMatchCandidate {
  group_id: string;
  group_name: string;
  compatibility_score: number;
  overlap_minutes: number;
  size: number;
}

export interface GroupMatchResponse {
  candidates: GroupMatchCandidate[];
}

// API functions
export const groupsApi = {
  // Group CRUD
  createGroup: (data: GroupCreate) =>
    api.post<GroupRead>('/groups/', data),

  listGroups: () =>
    api.get<GroupRead[]>('/groups/'),

  getGroup: (groupId: string) =>
    api.get<GroupDetail>(`/groups/${groupId}`),

  // Join & Invite
  joinGroup: (groupId: string, data: JoinGroupRequest) =>
    api.post<GroupDetail>(`/groups/${groupId}/join`, data),

  getInviteLink: (groupId: string) =>
    api.get<InviteLinkResponse>(`/groups/${groupId}/invite`),

  // Messages
  postMessage: (groupId: string, data: GroupMessageCreate) =>
    api.post<GroupMessageRead>(`/groups/${groupId}/messages`, data),

  listMessages: (groupId: string, limit = 50, offset = 0) =>
    api.get<GroupMessagePage>(`/groups/${groupId}/messages`, {
      params: { limit, offset },
    }),

  // Availability
  addAvailability: (groupId: string, data: AvailabilityCreate) =>
    api.post<AvailabilityRead>(`/groups/${groupId}/availability`, data),

  listAvailability: (groupId: string) =>
    api.get<AvailabilityRead[]>(`/groups/${groupId}/availability`),

  // Meeting Suggestions
  getMeetingSuggestions: (groupId: string, preferences?: MeetingPreferences) =>
    api.post<MeetingSuggestionResponse>(
      `/groups/${groupId}/meeting-suggestions`,
      preferences || {}
    ),

  // Confirm Meeting
  confirmMeeting: (groupId: string, data: MeetingConfirmationRequest) =>
    api.post<GroupMeetingRead>(`/groups/${groupId}/meetings`, data),

  // Group Matches
  getGroupMatches: (groupId: string) =>
    api.get<GroupMatchResponse>(`/groups/${groupId}/matches`),
};
