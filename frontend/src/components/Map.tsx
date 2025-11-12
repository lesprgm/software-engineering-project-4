import React from 'react';
import { clsx } from 'clsx';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

type Props = {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
};

export default function Map({ lat = 0, lng = 0, zoom = 15, className }: Partial<Props> = {}) {
  if (lat === undefined || lng === undefined) {
    return <div className={clsx('map-shell', className)} />;
  }
  return (
    <div className={clsx('map-shell', 'w-full h-full', className)}>
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[lat, lng]}>
          <Popup>Event location</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
