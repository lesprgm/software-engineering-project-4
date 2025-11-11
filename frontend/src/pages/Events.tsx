import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ToastProvider';
import Map from '../components/Map';
import { aiApi, EventNlpResponse, EventRecord } from '../services/ai';

type UiEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  tags?: string[];
  imageUrl?: string;
  lat?: number;
  lng?: number;
  description?: string;
};

export default function Events() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { notify } = useToast();

  const { data, isLoading } = useQuery<EventNlpResponse>({
    queryKey: ['events', query],
    queryFn: async () => {
      const trimmed = query.trim();
      try {
        if (!trimmed) {
          const response = await api.get<EventRecord[]>('/events/');
          return buildFallbackResponse({
            events: response.data,
            interpreted_query: 'All upcoming events',
          });
        }
        const response = await aiApi.searchEvents(trimmed);
        return response.data;
      } catch (error) {
        console.error('Unable to load events', error);
        return buildFallbackResponse({
          query: trimmed,
          interpreted_query: 'Unable to load events.',
          error: true,
        });
      }
    },
    retry: false,
  });

  const events = useMemo<UiEvent[]>(() => (data?.events || []).map(adaptEventRecord), [data]);
  const selected = useMemo(() => events.find((event) => event.id === openId) || null, [openId, events]);
  const filters = data?.filters;
  const loadError = data?.error === true;

  function makeOsmEmbed(lat: number, lng: number) {
    const delta = 0.005; // small bounding box around the marker
    const bbox = `${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  }

  async function share(event: UiEvent) {
    const text = `${event.title}\n${new Date(event.date).toLocaleString()} @ ${event.location}` +
      (event.description ? `\n\n${event.description}` : '');
    const shareData: ShareData = { title: event.title, text, url: `${window.location.origin}/events` };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        notify('Share dialog opened', 'success');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        notify('Event copied to clipboard', 'success');
      } else {
        notify('Sharing not supported on this device', 'error');
      }
    } catch {
      // user cancelled the share dialog
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          aria-label="Search events"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Search events (natural language supported)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button onClick={() => qc.invalidateQueries({ queryKey: ['events', query] })}>Search</Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border bg-white shadow-sm animate-pulse">
              <div className="h-40 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unable to reach the events service. Showing any cached results.
        </div>
      )}

      {!!events.length && (
        <>
          {query.trim() && data && (
            <Card className="p-4">
              <div className="text-sm text-gray-700">
                <div className="font-semibold text-gray-900">AI interpreted:</div>
                <p>{data.interpreted_query}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                {filters?.date_range?.start && (
                  <span className="rounded-full border px-2 py-0.5">
                    From {new Date(filters.date_range.start).toLocaleDateString()}
                    {filters.date_range.end ? ` to ${new Date(filters.date_range.end).toLocaleDateString()}` : ''}
                  </span>
                )}
                {filters?.location && <span className="rounded-full border px-2 py-0.5">Location: {filters.location}</span>}
                {filters?.category && <span className="rounded-full border px-2 py-0.5">Category: {filters.category}</span>}
                {filters?.keywords?.map((keyword) => (
                  <span key={keyword} className="rounded-full border px-2 py-0.5">#{keyword}</span>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => setOpenId(event.id)}
                className="text-left group focus:outline-none"
                aria-label={`Open details for ${event.title}`}
              >
                <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
                  <div className="relative h-64 md:h-72">
                    <img
                      src={event.imageUrl || 'https://via.placeholder.com/800x400?text=Event'}
                      alt="Event poster"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="text-white font-semibold text-lg drop-shadow line-clamp-1">{event.title}</div>
                      <div className="text-white/90 text-xs mt-0.5 line-clamp-1">
                        {new Date(event.date).toLocaleString()} • {event.location}
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
            ))}
          </div>
        </>
      )}

      {!isLoading && !events.length && !loadError && (
        <div className="text-center text-gray-600 py-10">No events match your search.</div>
      )}

      <Modal open={!!selected} onClose={() => setOpenId(null)} title={selected ? selected.title : ''}>
        {selected && (
          <div className="space-y-3">
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="Event poster" className="h-56 w-full object-cover rounded-md" />
            )}
            <div className="text-sm text-gray-700">
              <div><span className="font-medium">When:</span> {new Date(selected.date).toLocaleString()}</div>
              <div><span className="font-medium">Where:</span> {selected.location}</div>
              {!!selected.tags?.length && (
                <div className="mt-1 text-xs text-gray-500">{selected.tags.join(', ')}</div>
              )}
              {selected.description && <p className="mt-2">{selected.description}</p>}
            </div>

            {selected.lat && selected.lng && (
              <div className="aspect-video w-full overflow-hidden rounded-md border">
                {import.meta.env.VITE_GOOGLE_MAPS_KEY ? (
                  <Map lat={selected.lat} lng={selected.lng} />
                ) : (
                  <iframe
                    title="Event location map (OpenStreetMap fallback)"
                    src={makeOsmEmbed(selected.lat, selected.lng)}
                    className="w-full h-full"
                  />
                )}
              </div>
            )}

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href={(() => {
                  const start = new Date(selected.date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                  const end = new Date(new Date(selected.date).getTime() + 60 * 60 * 1000)
                    .toISOString()
                    .replace(/[-:]/g, '')
                    .split('.')[0] + 'Z';
                  const params = new URLSearchParams({
                    action: 'TEMPLATE',
                    text: selected.title,
                    dates: `${start}/${end}`,
                    location: selected.location,
                    details: selected.description || '',
                  });
                  return `https://www.google.com/calendar/render?${params.toString()}`;
                })()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md min-w-[14rem] px-4 py-2 text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
              >
                Add to Google Calendar
              </a>
              <button
                type="button"
                onClick={() => share(selected)}
                className="inline-flex items-center justify-center rounded-md min-w-[14rem] px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200"
                aria-label="Share event"
              >
                Share
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function adaptEventRecord(record: EventRecord): UiEvent {
  return {
    id: String(record.id),
    title: record.title,
    date: record.start_time || record.end_time || new Date().toISOString(),
    location: record.location,
    tags: record.tags || [],
    imageUrl: record.imageUrl || undefined,
    description: record.description || undefined,
    lat: typeof record.lat === 'number' ? record.lat : undefined,
    lng: typeof record.lng === 'number' ? record.lng : undefined,
  };
}

function buildFallbackResponse(overrides?: Partial<EventNlpResponse & { error?: boolean }>): EventNlpResponse & { error?: boolean } {
  return {
    query: '',
    filters: { keywords: [] },
    events: [],
    cached: false,
    interpreted_query: '',
    generated_at: new Date().toISOString(),
    ...overrides,
  };
}
