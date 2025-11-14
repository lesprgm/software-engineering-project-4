import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupsApi, GroupCreate, JoinGroupRequest, GroupMessageCreate, AvailabilityCreate, MeetingPreferences, MeetingConfirmationRequest } from '../services/groups';
import { matchesService } from '../services/matches';

// Query keys
export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: () => [...groupKeys.lists()] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
  messages: (id: string) => [...groupKeys.all, 'messages', id] as const,
  availability: (id: string) => [...groupKeys.all, 'availability', id] as const,
  matches: (id: string) => [...groupKeys.all, 'matches', id] as const,
  userMatches: (userId: string) => [...groupKeys.all, 'user-matches', userId] as const,
};

// List all groups
export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: async () => {
      const response = await groupsApi.listGroups();
      return response.data;
    },
  });
}

// Get single group details
export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: async () => {
      const response = await groupsApi.getGroup(groupId);
      return response.data;
    },
    enabled: !!groupId,
  });
}

// Create group mutation
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupCreate) => groupsApi.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

// Join group mutation
export function useJoinGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JoinGroupRequest) => groupsApi.joinGroup(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

// Get invite link
export function useInviteLink(groupId: string) {
  return useQuery({
    queryKey: [...groupKeys.detail(groupId), 'invite'],
    queryFn: async () => {
      const response = await groupsApi.getInviteLink(groupId);
      return response.data;
    },
    enabled: !!groupId,
  });
}

// Messages
export function useGroupMessages(groupId: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...groupKeys.messages(groupId), limit, offset],
    queryFn: async () => {
      const response = await groupsApi.listMessages(groupId, limit, offset);
      return response.data;
    },
    enabled: !!groupId,
  });
}

export function usePostMessage(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupMessageCreate) => groupsApi.postMessage(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.messages(groupId) });
    },
  });
}

// Availability
export function useGroupAvailability(groupId: string) {
  return useQuery({
    queryKey: groupKeys.availability(groupId),
    queryFn: async () => {
      const response = await groupsApi.listAvailability(groupId);
      return response.data;
    },
    enabled: !!groupId,
  });
}

export function useAddAvailability(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AvailabilityCreate) => groupsApi.addAvailability(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.availability(groupId) });
    },
  });
}

// Meeting Suggestions
export function useMeetingSuggestions(groupId: string) {
  return useMutation({
    mutationFn: (preferences?: MeetingPreferences) => 
      groupsApi.getMeetingSuggestions(groupId, preferences),
  });
}

// Confirm Meeting
export function useConfirmMeeting(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MeetingConfirmationRequest) => 
      groupsApi.confirmMeeting(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

// Group Matches
export function useGroupMatches(groupId: string) {
  return useQuery({
    queryKey: groupKeys.matches(groupId),
    queryFn: async () => {
      const response = await groupsApi.getGroupMatches(groupId);
      return response.data;
    },
    enabled: !!groupId,
  });
}

export function useUserMatches(userId?: string) {
  return useQuery({
    queryKey: userId ? groupKeys.userMatches(userId) : ['user-matches', 'anonymous'],
    enabled: !!userId,
    queryFn: async () => {
      const response = await matchesService.getUserMatches(userId!);
      return response.data.candidates;
    },
  });
}

export function useMutualMatches(userId?: string) {
  return useQuery({
    queryKey: userId ? [...groupKeys.all, 'mutual-matches', userId] : ['mutual-matches', 'anonymous'],
    enabled: !!userId,
    queryFn: async () => {
      const response = await matchesService.getMutualMatches(userId!);
      return response.data.candidates;
    },
  });
}

export function useRightSwipes(userId?: string) {
  return useQuery({
    queryKey: userId ? [...groupKeys.all, 'right-swipes', userId] : ['right-swipes', 'anonymous'],
    enabled: !!userId,
    queryFn: async () => {
      const response = await matchesService.getRightSwipes(userId!);
      return response.data.candidates;
    },
  });
}

export function useRecordSwipe(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (swipe: { target_user_id: string; swiped_right: boolean }) =>
      matchesService.recordSwipe(userId, swipe),
    onSuccess: () => {
      // Invalidate match candidates, mutual matches, and right swipes
      queryClient.invalidateQueries({ queryKey: groupKeys.userMatches(userId) });
      queryClient.invalidateQueries({ queryKey: [...groupKeys.all, 'mutual-matches', userId] });
      queryClient.invalidateQueries({ queryKey: [...groupKeys.all, 'right-swipes', userId] });
    },
  });
}
