import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import MapEmbed from '../components/Map';
import { FALLBACK_PLACES } from '../data/fallbackPlaces';
import { placeService, Place } from '../services/places';
import { useBreadcrumb } from '../hooks/useBreadcrumb';

type ViewMode = 'all' | 'top';

export default function Places() {
  const [mode, setMode] = useState<ViewMode>('all');
  useBreadcrumb('Places', { parent: '/' });
  const { data, isLoading } = useQuery({
    queryKey: ['places', mode],
    queryFn: async () => {
      if (mode === 'top') {
        const res = await placeService.top(6);
        return res.data;
      }
      const res = await placeService.list();
      return res.data;
    },
    retry: 1,
  });

  const remotePlaces = useMemo(() => (data || []).map(normalizePlace), [data]);
  const fallbackPlaces = useMemo(() => {
    const source =
      mode === 'top'
        ? [...FALLBACK_PLACES].sort((a, b) => b.rating - a.rating).slice(0, 6)
        : FALLBACK_PLACES;
    return source.map(normalizePlace);
  }, [mode]);

  const hasRemoteData = remotePlaces.length > 0;
  const showingFallback = !hasRemoteData && !isLoading;
  const places = hasRemoteData ? remotePlaces : fallbackPlaces;

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

      {showingFallback && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing campus-favorite spots while we reconnect to the live places service.
        </div>
      )}

      {places.some((place) => place.latitude && place.longitude) && (
        <Card className="p-0 overflow-hidden">
          <div className="h-80 w-full relative">
            <MapContainer center={[places[0].latitude ?? 0, places[0].longitude ?? 0]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {clusterPlaces(places).map((cluster) => (
                <CircleMarker
                  key={`${cluster.lat}-${cluster.lng}`}
                  center={[cluster.lat, cluster.lng]}
                  radius={8 + cluster.count * 2}
                  className="map-cluster"
                  pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.2 }}
                >
                  <Tooltip>
                    <div className="text-sm font-medium text-gray-900">{cluster.names.join(', ')}</div>
                    <div className="text-xs text-gray-600">{cluster.count} spot{cluster.count > 1 ? 's' : ''}</div>
                    <div className="text-xs text-rose-500">{Array.from(cluster.tags).slice(0, 3).join(', ')}</div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Card>
      )}

      {!isLoading && (
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
                    <MapEmbed lat={place.latitude} lng={place.longitude} className="h-48" />
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

function clusterPlaces(places: Place[]) {
  const map = new Map<string, { lat: number; lng: number; count: number; tags: Set<string>; names: string[] }>();
  places.forEach((place) => {
    if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return;
    const key = `${place.latitude.toFixed(2)}-${place.longitude.toFixed(2)}`;
    const entry = map.get(key) ?? {
      lat: place.latitude,
      lng: place.longitude,
      count: 0,
      tags: new Set<string>(),
      names: [],
    };
    entry.count += 1;
    entry.names.push(place.name);
    const tags = Array.isArray(place.tags)
      ? place.tags
      : typeof place.tags === 'string'
        ? place.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];
    tags.forEach((tag) => entry.tags.add(tag));
    map.set(key, entry);
  });
  return Array.from(map.values());
}
