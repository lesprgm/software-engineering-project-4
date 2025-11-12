import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import MapEmbed from '../components/Map';
import { useToast } from '../components/ToastProvider';
import { downloadCalendarFile } from '../lib/calendar';
import { aiApi, EventFilters } from '../services/ai';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../store/notifications';
import Skeleton from '../components/ui/Skeleton';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { getRuntimeEnv } from '../lib/env';

const env = getRuntimeEnv();
const FALLBACK_POSTER = `${env.BASE_URL ?? '/'}events/placeholder.svg`;

const STATIC_EVENT_BLUEPRINTS = [
  {
    title: 'Sunset Rooftop Mixer',
    description: 'Low-key beats, mocktails, and a Polaroid wall for new friends.',
    location: 'Innovation Hub Rooftop',
    category: 'social',
    offsetHours: 4,
    durationHours: 2,
    tags: ['sunset', 'networking'],
  },
  {
    title: 'Basement Beats & Boba',
    description: 'Student DJs trade sets while boba pop-ups keep cups full.',
    location: 'Union Underground',
    category: 'music',
    offsetHours: 22,
    durationHours: 3,
    tags: ['music', 'boba'],
  },
  {
    title: 'Maker Lab Open Studio',
    description: 'Try resin art, 3D printing demos, and communal playlist swaps.',
    location: 'Maker Lab A120',
    category: 'creative',
    offsetHours: 36,
    durationHours: 2,
    tags: ['crafts', 'design'],
  },
  {
    title: 'Trail & Chill Walk',
    description: 'Slow-paced loop around the lake with mindfulness prompts and cocoa.',
    location: 'Lakeside Trailhead',
    category: 'outdoors',
    offsetHours: 60,
    durationHours: 1.5,
    tags: ['outdoors', 'wellness'],
  },
] as const;

function buildStaticEvents(): UiEvent[] {
  const now = Date.now();
  return STATIC_EVENT_BLUEPRINTS.map((template, index) => {
    const start = new Date(now + template.offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + template.durationHours * 60 * 60 * 1000);
    return {
      id: 5000 + index,
      title: template.title,
      description: template.description,
      location: template.location,
      category: template.category,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      tags: template.tags.slice(),
      image_url: null,
      lat: null,
      lng: null,
      interest_count: 12 + index * 3,
      viewer_interest: index === 0,
    };
  });
}

type UiEvent = {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  start_time: string;
  end_time?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  interest_count?: number;
  viewer_interest?: boolean;
};

type EventsQueryState = {
  events: UiEvent[];
  interpretedQuery?: string;
  filters?: EventFilters | null;
  cached?: boolean;
  error?: boolean;
};

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

function formatTimeRange(startIso: string, endIso?: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
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
    url: `${window.location.origin}/events`,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      notify('Share dialog opened.', 'success');
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      notify('Event copied to clipboard.', 'success');
    } else {
      notify('Sharing not supported on this device.', 'error');
    }
  } catch {
    // user dismissed dialog or share downlevel
  }
}

function normalizeEvent(record: any): UiEvent {
  return {
    id: Number(record.id),
    title: record.title ?? 'Untitled event',
    description: record.description ?? null,
    location: record.location ?? null,
    category: record.category ?? null,
    start_time: record.start_time ?? new Date().toISOString(),
    end_time: record.end_time ?? null,
    tags: record.tags ?? [],
    image_url: record.image_url ?? record.imageUrl ?? null,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    interest_count: record.interest_count ?? 0,
    viewer_interest: record.viewer_interest ?? false,
  };
}

export default function Events() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  useBreadcrumb('Events', { parent: '/' });
  const { user } = useAuthStore();
  const { addNotification } = useNotifications();
  const [interestTarget, setInterestTarget] = useState<number | null>(null);

  const eventsQuery = useQuery<EventsQueryState>({
    queryKey: ['events', search.trim(), user?.id ?? 'anonymous'],
    queryFn: async () => {
      const trimmed = search.trim();
      try {
        if (!trimmed) {
          const response = await api.get('/events', { params: { viewer_id: user?.id } });
          const events = Array.isArray(response.data) ? response.data.map((event: any) => normalizeEvent(event)) : [];
          return {
            events,
            interpretedQuery: 'All upcoming events',
            filters: null,
            cached: false,
          } satisfies EventsQueryState;
        }
        const { data } = await aiApi.searchEvents(trimmed, user?.id);
        return {
          events: data.events.map((event) => normalizeEvent(event)),
          interpretedQuery: data.interpreted_query,
          filters: data.filters,
          cached: data.cached,
        } satisfies EventsQueryState;
      } catch (error) {
        console.error('Unable to load events', error);
        const offlineEvents = buildStaticEvents();
        const filtered = trimmed
          ? offlineEvents.filter((event) => event.title.toLowerCase().includes(trimmed.toLowerCase()))
          : offlineEvents;
        return {
          events: filtered,
          interpretedQuery: trimmed
            ? `Offline mode: showing curated picks similar to “${trimmed}”.`
            : 'Showing campus-favorite spots while we reconnect to the live places service.',
          filters: null,
          error: true,
        } satisfies EventsQueryState;
      }
    },
    retry: false,
  });

  const events = eventsQuery.data?.events ?? [];
  const selected = useMemo(() => events.find((event) => event.id === openId) ?? null, [events, openId]);
  const timelineEvents = useMemo(
    () =>
      events
        .filter((event) => event.viewer_interest)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [events],
  );

  const interestMutation = useMutation({
    mutationFn: async (vars: { eventId: number; interested: boolean; title: string }) => {
      if (!user?.id) return;
      setInterestTarget(vars.eventId);
      await api.post(`/events/${vars.eventId}/interest`, { user_id: user.id, interested: vars.interested });
    },
    onSuccess: (_data, vars) => {
      addNotification({
        kind: 'event',
        title: vars.interested ? 'RSVP saved' : 'RSVP removed',
        body: `${vars.title} ${vars.interested ? 'was added to' : 'was removed from'} your plans.`,
      });
    },
    onSettled: () => {
      setInterestTarget(null);
      queryClient.invalidateQueries({ queryKey: ['events', search.trim(), user?.id ?? 'anonymous'] });
    },
  });

  const interpretedQuery = eventsQuery.data?.interpretedQuery;
  const filters = eventsQuery.data?.filters;
  const loadError = eventsQuery.data?.error ?? false;

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
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['events', search.trim(), user?.id ?? 'anonymous'] })}>
          Search
        </Button>
      </div>

      {eventsQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-4 space-y-4">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We’re offline right now, so you’re seeing curated campus favorites.
        </div>
      )}

      {!!events.length && (
        <>
          {search.trim() && interpretedQuery && (
            <Card className="p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">AI interpreted:</div>
              <p>{interpretedQuery}</p>
              {!!filters && (
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => (
              <Skeleton key={event.id} loaded={!eventsQuery.isFetching} className="block rounded-2xl" transitionKey={`event-${event.id}`}>
                <button
                  onClick={() => setOpenId(event.id)}
                  className="w-full text-left group focus:outline-none"
                  aria-label={`Open details for ${event.title}`}
                >
                  <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
                    <div className="relative h-64 md:h-72">
                      <img
                        src={event.image_url || FALLBACK_POSTER}
                        alt="Event poster"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="text-white font-semibold text-lg drop-shadow line-clamp-1">{event.title}</div>
                        <div className="text-white/90 text-xs mt-0.5 line-clamp-1">
                          {formatDateRange(event.start_time, event.end_time)} • {event.location ?? 'TBD'}
                        </div>
                        {!!event.tags?.length && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {event.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-gray-800 backdrop-blur">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </button>
              </Skeleton>
            ))}
          </div>
        </>
      )}

      {!eventsQuery.isLoading && !events.length && !loadError && (
        <div className="text-center text-gray-600 py-10">No events match your search.</div>
      )}

      {!!timelineEvents.length && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Your RSVP timeline</h3>
            <span className="text-xs text-gray-500 uppercase tracking-wide">{timelineEvents.length} saved</span>
          </div>
          <div className="timeline mt-4">
            {timelineEvents.map((event, idx) => (
              <div key={event.id} className="timeline-row">
                <div className="timeline-icon">
                  <span>{idx + 1}</span>
                </div>
                <div className="timeline-body">
                  <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(event.start_time).toLocaleDateString()} · {formatTimeRange(event.start_time, event.end_time)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{event.location ?? 'TBD'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setOpenId(null)} title={selected ? selected.title : ''}>
        {selected && (
          <div className="space-y-3">
            <img src={selected.image_url || FALLBACK_POSTER} alt="Event poster" className="h-56 w-full object-cover rounded-md" />
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="font-medium">When:</span> {formatDateRange(selected.start_time, selected.end_time)}</div>
              <div><span className="font-medium">Where:</span> {selected.location ?? 'TBD'}</div>
              {!!selected.tags?.length && (
                <div className="text-xs text-gray-500">{selected.tags.join(', ')}</div>
              )}
              {selected.description && <p className="pt-2">{selected.description}</p>}
            </div>

            {selected.lat && selected.lng && (
              <div className="aspect-video w-full overflow-hidden rounded-md border">
                {env.VITE_GOOGLE_MAPS_KEY ? (
                  <MapEmbed lat={selected.lat} lng={selected.lng} />
                ) : (
                  <iframe title="Event location map" src={makeOsmEmbed(selected.lat, selected.lng)} className="w-full h-full" />
                )}
              </div>
            )}

            <div className="pt-1 flex flex-wrap gap-2">
              {user?.id && (
                <Button
                  onClick={() =>
                    interestMutation.mutate({
                      eventId: selected.id,
                      interested: !selected.viewer_interest,
                      title: selected.title,
                    })
                  }
                  loading={interestMutation.isPending && interestTarget === selected.id}
                  variant={selected.viewer_interest ? 'primary' : 'secondary'}
                  className="interactive-btn"
                >
                  {selected.viewer_interest ? 'Interested' : 'Mark interested'}
                  {typeof selected.interest_count === 'number' && (
                    <span className="ml-2 text-xs text-white/80">{selected.interest_count} going</span>
                  )}
                </Button>
              )}
                <Button
                  onClick={() =>
                    downloadCalendarFile({
                      title: selected.title,
                      start: selected.start_time,
                      end: selected.end_time ?? undefined,
                      location: selected.location ?? undefined,
                      description: selected.description ?? undefined,
                      fileName: `${selected.title}-event`,
                    })
                  }
                >
                  Add to calendar
                </Button>
              <Button variant="secondary" onClick={() => share(selected, notify)}>
                Share
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
