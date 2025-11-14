import api from '../lib/api';

export interface MeetupDetectionResponse {
  is_meetup: boolean;
  location?: string | null;
  proposed_time?: string | null; // ISO datetime
  confidence: number;
  suggestion?: string | null;
}

export interface CalendarInviteRequest {
  partner_name: string;
  partner_email?: string | null;
  location: string;
  start_time: string; // ISO datetime
  duration_minutes?: number;
  title?: string | null;
  notes?: string | null;
}

export interface CalendarInviteResponse {
  ics_content: string;
  filename: string;
  event_summary: string;
}

export const calendarApi = {
  detectMeetup: (message: string) =>
    api.post<MeetupDetectionResponse>('/calendar/detect-meetup', null, {
      params: { message },
    }),

  generateInvite: (request: CalendarInviteRequest) =>
    api.post<CalendarInviteResponse>('/calendar/generate-invite', request),

  downloadInvite: (request: CalendarInviteRequest) =>
    api.post('/calendar/download-invite', request, {
      responseType: 'blob',
    }),
};
