import api from '../lib/api';

export interface Place {
  id: number;
  name: string;
  description?: string | null;
  location?: string | null;
  rating: number;
  review_count: number;
  tags?: string[] | string | null;
  photo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const placeService = {
  list: () => api.get<Place[]>('/places/'),
  top: (limit = 5) => api.get<Place[]>('/places/top', { params: { limit } }),
  nearby: (lat: number, lng: number, radiusKm = 1.5) =>
    api.get<Place[]>('/places/nearby', { params: { lat, lng, radius_km: radiusKm } }),
};
