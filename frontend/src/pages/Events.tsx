import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ToastProvider';
import Map from '../components/Map';
import { aiApi, EventFilters } from '../services/ai';
import { useAuthStore } from '../store/auth';

const FALLBACK_POSTER = `${import.meta.env.BASE_URL ?? '/'}events/placeholder.svg`;

interface UiEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  created_at?: string;
  updated_at?: string;
  tags?: string[] | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface InterestInfo {
  event_id: number;
  interested_count: number;
}

interface EventsQueryState {
  events: UiEvent[];
  interpretedQuery?: string;
  filters?: EventFilters | null;
  cached?: boolean;
  error?: boolean;
}

function loadInterested(key: string): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
    return [];
  } catch {
    return [];
  }
}

function persistInterested(key: string, values: number[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore storage failures such as private mode or quota limits
  }
}

function formatDateRange(startIso: string, endIso?: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const startText = formatter.format(start);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${startText} · ${timeFormatter.format(end)}`;
  }
  return `${startText} → ${formatter.format(end)}`;
}

function makeOsmEmbed(lat: number, lng: number) {
  const delta = 0.005;
  const bbox = `${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function toIcs(event: UiEvent) {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const payload = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusConnect//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@campus-connect`,
    `DTSTAMP:${format(new Date())}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location ?? ''}`,
    event.description ? `DESCRIPTION:${event.description}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return new Blob([payload.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

function shareSummary(event: UiEvent) {
  const when = formatDateRange(event.start_time, event.end_time);
  const base = `${event.title}\n${when} @ ${event.location ?? 'TBD'}`;
  return event.description ? `${base}\n\n${event.description}` : base;
}

async function share(event: UiEvent, notify: (message: string, variant?: 'success' | 'error') => void) {
  const message = shareSummary(event);
  const shareData: ShareData = {
    title: event.title,
    text: message,
    url: window.location.origin + '/events',
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      notify('Share dialog opened.', 'success');
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      notify('Event copied to clipboard.', 'success');
    } else {
      notify('Sharing is not supported on this device.', 'error');
    }
  } catch {
    // user cancelled share sheet or the call failed silently
  }
}

function normalizeEvent(record: { id: number | string; [key: string]: unknown }): UiEvent {
  const startTime = typeof record.start_time === 'string' ? record.start_time : new Date().toISOString();
  return {
    id: Number(record.id),
    title: typeof record.title === 'string' ? record.title : 'Untitled event',
    description: (record.description as string | null | undefined) ?? null,
    location: (record.location as string | null | undefined) ?? null,
    start_time: startTime,
    end_time: (record.end_time as string | null | undefined) ?? null,
    created_at: record.created_at as string | undefined,
    updated_at: record.updated_at as string | undefined,
    tags: (record.tags as string[] | null | undefined) ?? null,
    image_url: (record.image_url as string | null | undefined) ?? (record.imageUrl as string | null | undefined) ?? null,
    lat: typeof record.lat === 'number' ? record.lat : null,
    lng: typeof record.lng === 'number' ? record.lng : null,
  };
}

export default function Events() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user } = useAuthStore();

  const interestKey = useMemo(() => (user?.id ? `cc_event_interest_${user.id}` : 'cc_event_interest_guest'), [user?.id]);
  const [interestedIds, setInterestedIds] = useState<number[]>(() => loadInterested(interestKey));

  useEffect(() => {
    setInterestedIds(loadInterested(interestKey));
  }, [interestKey]);

  useEffect(() => {
    persistInterested(interestKey, interestedIds);
  }, [interestKey, interestedIds]);

  const eventsQuery = useQuery<EventsQueryState>({
    queryKey: ['events', search.trim()],
    queryFn: async () => {
      const trimmed = search.trim();
      try {
        if (!trimmed) {
          const response = await api.get('/events', { params: { upcoming: true } });
          const events = Array.isArray(response.data) ? response.data.map((event) => normalizeEvent(event)) : [];
          return {
            events,
            interpretedQuery: 'All upcoming events',
            filters: null,
            cached: false,
          } satisfies EventsQueryState;
        }
        const { data } = await aiApi.searchEvents(trimmed);
        return {
          events: data.events.map((event) => normalizeEvent(event)),
          interpretedQuery: data.interpreted_query,
          filters: data.filters,
          cached: data.cached,
        } satisfies EventsQueryState;
      } catch (error) {
        console.error('Unable to load events', error);
        return {
          events: [],
          interpretedQuery: 'Unable to load events.',
          filters: null,
          error: true,
        } satisfies EventsQueryState;
      }
    },
    retry: false,
  });

  const events = eventsQuery.data?.events ?? [];
  const filters = eventsQuery.data?.filters;
  const interpretedQuery = eventsQuery.data?.interpretedQuery;
  const loadError = eventsQuery.data?.error ?? false;
  const { isLoading, isError } = eventsQuery;

  const selected = useMemo(() => events.find((event) => event.id === openId) ?? null, [events, openId]);

  const interestQuery = useQuery<InterestInfo | null>({
    queryKey: ['event-interest', openId],
    queryFn: async () => {
      if (!openId) return null;
      const response = await api.get<InterestInfo>(`/events/${openId}/interests`);
      return response.data;
    },
    enabled: openId !== null,
    staleTime: 30000,
  });

  type ToggleVars = { eventId: number; userId: string; previouslyInterested: boolean };

  const interestMutation = useMutation<InterestInfo, unknown, ToggleVars>({
    mutationFn: async ({ eventId, userId }) => {
      const response = await api.post<InterestInfo>(`/events/${eventId}/interests`, { user_id: userId });
      return response.data;
    },
    onSuccess: (info, { eventId, previouslyInterested }) => {
      setInterestedIds((prev) =>
        previouslyInterested ? prev.filter((id) => id !== eventId) : [...prev, eventId]
      );
      queryClient.setQueryData(['event-interest', eventId], info);
      notify(previouslyInterested ? 'Removed from Interested list' : 'Saved to Interested list', 'success');
    },
    onError: () => {
      notify('Unable to update interest right now. Please try again.', 'error');
    },
  });

  const handleToggleInterest = (eventId: number) => {
    if (!user) {
      notify('Sign in to track events you want to attend.', 'error');
      return;
    }
    const previouslyInterested = interestedIds.includes(eventId);
    interestMutation.mutate({ eventId, userId: user.id, previouslyInterested });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          aria-label="Search events"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Search events (natural language supported)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
          variant="secondary"
        >
          Refresh
        </Button>
      </div>

      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load events. Please try again in a moment.
        </div>
      )}

      {loadError && !isError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unable to reach the events service. Showing any cached results.
        </div>
      )}

      {search.trim() && interpretedQuery && !isLoading && (
        <Card className="p-4">
          <div className="text-sm text-gray-700">
            <div className="font-semibold text-gray-900">AI interpreted:</div>
            <p>{interpretedQuery}</p>
          </div>
          {filters && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              {filters.date_range?.start && (
                <span className="rounded-full border px-2 py-0.5">
                  From {new Date(filters.date_range.start).toLocaleDateString()}
                  {filters.date_range.end ? ` to ${new Date(filters.date_range.end).toLocaleDateString()}` : ''}
                </span>
              )}
              {filters.location && <span className="rounded-full border px-2 py-0.5">Location: {filters.location}</span>}
              {filters.category && <span className="rounded-full border px-2 py-0.5">Category: {filters.category}</span>}
              {filters.keywords?.map((keyword) => (
                <span key={keyword} className="rounded-full border px-2 py-0.5">#{keyword}</span>
              ))}
            </div>
          )}
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="h-40 bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {events.map((item) => {
            const poster = item.image_url || FALLBACK_POSTER;
            return (
              <button
                key={item.id}
                onClick={() => setOpenId(item.id)}
                className="group text-left focus:outline-none"
                aria-label={`Open details for ${item.title}`}
              >
                <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
                  <div className="relative h-64 md:h-72">
                    <img
                      src={poster}
                      alt="Event poster"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="line-clamp-1 text-lg font-semibold text-white drop-shadow">{item.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-white/90">
                        {formatDateRange(item.start_time, item.end_time)} · {item.location ?? 'TBD'}
                      </div>
                      {!!item.tags?.length && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] rounded-full bg-white/80 px-2 py-0.5 text-gray-800 backdrop-blur"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && events.length === 0 && !isError && !loadError && (
        <div className="py-10 text-center text-gray-600">No upcoming events match your search.</div>
      )}

      <Modal open={!!selected} onClose={() => setOpenId(null)} title={selected ? selected.title : ''}>
        {selected && (
          <div className="space-y-4">
            {(selected.image_url || selected.lat) && (
              <div className="overflow-hidden rounded-md border">
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt="Event poster"
                    className="h-56 w-full object-cover"
                  />
                ) : selected.lat && selected.lng ? (
                  import.meta.env.VITE_GOOGLE_MAPS_KEY ? (
                    <Map lat={selected.lat} lng={selected.lng} />
                  ) : (
                    <iframe
                      title="Event location map (OpenStreetMap fallback)"
                      src={makeOsmEmbed(selected.lat, selected.lng)}
                      className="h-56 w-full"
                      loading="lazy"
                    />
                  )
                ) : null}
              </div>
            )}

            <div className="space-y-1 text-sm text-gray-700">
              <div>
                <span className="font-medium">When:</span> {formatDateRange(selected.start_time, selected.end_time)}
              </div>
              <div>
                <span className="font-medium">Where:</span> {selected.location ?? 'TBD'}
              </div>
              {selected.description && <p className="pt-2 text-gray-600">{selected.description}</p>}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  const blob = toIcs(selected);
                  const url = window.URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = `${selected.title.replace(/\s+/g, '-')}.ics`;
                  anchor.click();
                  window.URL.revokeObjectURL(url);
                  notify('Calendar file downloaded.', 'success');
                }}
              >
                Download iCal
              </Button>
              <Button type="button" variant="secondary" onClick={() => share(selected, notify)}>
                Share
              </Button>
              <Button
                type="button"
                variant="ghost"
                loading={interestMutation.isPending}
                onClick={() => handleToggleInterest(selected.id)}
              >
                {interestedIds.includes(selected.id) ? 'Remove Interested' : 'Mark Interested'}
                {interestQuery.data && !interestQuery.isLoading ? ` (${interestQuery.data.interested_count})` : ''}
              </Button>
            </div>

            {interestQuery.data && (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {interestQuery.data.interested_count === 0
                  ? 'Be the first to mark interest!'
                  : `${interestQuery.data.interested_count} student${interestQuery.data.interested_count === 1 ? '' : 's'} interested.`}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
