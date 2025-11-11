import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Map from '../components/Map';
import { placeService, Place } from '../services/places';

type ViewMode = 'all' | 'top';

export default function Places() {
  const [mode, setMode] = useState<ViewMode>('all');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['places', mode],
    queryFn: async () => {
      if (mode === 'top') {
        const res = await placeService.top(6);
        return res.data;
      }
      const res = await placeService.list();
      return res.data;
    },
  });

  const places = useMemo(() => (data || []).map(normalizePlace), [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === 'all' ? 'primary' : 'secondary'} onClick={() => setMode('all')}>
          All spots
        </Button>
        <Button variant={mode === 'top' ? 'primary' : 'secondary'} onClick={() => setMode('top')}>
          Top rated
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-56 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-red-600">Unable to load places right now.</div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {places.map((place) => (
            <Card key={place.id} className="overflow-hidden">
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="md:w-1/2 space-y-2">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 flex items-center justify-between gap-2">
                      <span>{place.name}</span>
                      <span className="text-sm text-amber-600">{place.rating.toFixed(1)} ⭐</span>
                    </div>
                    {place.location && (
                      <div className="text-sm text-gray-500">{place.location}</div>
                    )}
                  </div>
                  {place.description && (
                    <p className="text-sm text-gray-700 line-clamp-3">{place.description}</p>
                  )}
                  {!!place.tags?.length && (
                    <div className="flex flex-wrap gap-1">
                      {place.tags.slice(0, 6).map((tag) => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {place.latitude && place.longitude && (
                      <Button
                        variant="secondary"
                        onClick={() => openMap(place)}
                        aria-label={`Open ${place.name} in maps`}
                      >
                        View on map
                      </Button>
                    )}
                    <span className="text-xs text-gray-500 self-center">
                      {place.review_count} review{place.review_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="md:w-1/2 h-48 rounded-lg overflow-hidden border">
                  {place.latitude && place.longitude ? (
                    <Map lat={place.latitude} lng={place.longitude} className="h-48" />
                  ) : (
                    <div className="h-full w-full bg-gray-100 grid place-items-center text-sm text-gray-500">
                      Location coming soon
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizePlace(place: Place): Place & { tags: string[] } {
  let normalizedTags: string[] = [];
  if (Array.isArray(place.tags)) {
    normalizedTags = place.tags;
  } else if (typeof place.tags === 'string') {
    normalizedTags = place.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return {
    ...place,
    tags: normalizedTags,
  };
}

function openMap(place: Place) {
  if (place.latitude && place.longitude) {
    const query = encodeURIComponent(`${place.name} ${place.location || ''}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}(${query})`;
    window.open(url, '_blank', 'noopener');
  }
}
