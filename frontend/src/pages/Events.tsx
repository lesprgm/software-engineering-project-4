import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ToastProvider';
import Map from '../components/Map';

type Event = {
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

  const { data, isLoading } = useQuery({
    queryKey: ['events', query],
    queryFn: async () => (await api.get('/events', { params: { q: query } })).data as Event[],
  });

  const selected = useMemo(() => data?.find((e) => e.id === openId) || null, [openId, data]);

  function makeOsmEmbed(lat: number, lng: number) {
    const d = 0.005; // bounding box delta
    const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  }

  function toIcs(ev: Event) {
    const dtStart = new Date(ev.date);
    const dtEnd = new Date(dtStart.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusConnect//EN',
      'BEGIN:VEVENT',
      `UID:${ev.id}@campus-connect`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dtStart)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${ev.title}`,
      `LOCATION:${ev.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  }

  async function share(ev: Event) {
    const text = `${ev.title}\n${new Date(ev.date).toLocaleString()} @ ${ev.location}` + (ev.description ? `\n\n${ev.description}` : '');
    const shareData: ShareData = { title: ev.title, text, url: window.location.origin + '/events' };
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
      // cancelled
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
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button onClick={() => qc.invalidateQueries({ queryKey: ['events', query] })}>Search</Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border bg-white shadow-sm animate-pulse">
              <div className="h-40 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!!data?.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((ev) => (
            <button
              key={ev.id}
              onClick={() => setOpenId(ev.id)}
              className="text-left group focus:outline-none"
              aria-label={`Open details for ${ev.title}`}
            >
              <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
                <div className="relative h-64 md:h-72">
                  <img
                    src={ev.imageUrl || 'https://via.placeholder.com/800x400?text=Event'}
                    alt="Event poster"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-white font-semibold text-lg drop-shadow line-clamp-1">{ev.title}</div>
                    <div className="text-white/90 text-xs mt-0.5 line-clamp-1">
                      {new Date(ev.date).toLocaleString()} â€¢ {ev.location}
                    </div>
                    {!!ev.tags?.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ev.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-gray-800 backdrop-blur">
                            {t}
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
      )}
      {!isLoading && !data?.length && (
        <div className="text-center text-gray-600 py-10">
          No events match your search.
        </div>
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
              {selected.description && (
                <p className="mt-2">{selected.description}</p>
              )}
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
                    loading="lazy"
                  />
                )}
              </div>
            )}

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href={(() => {
                  const start = new Date(selected.date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                  const end = new Date(new Date(selected.date).getTime() + 60*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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
                className="inline-flex items-center justify-center rounded-md min-w-[14rem] px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
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

