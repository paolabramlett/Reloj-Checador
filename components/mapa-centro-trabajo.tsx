"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Next.js empaqueta los assets de Leaflet con hashes de webpack que rompen
// las rutas por defecto del ícono; apuntamos al CDN en vez de copiar assets.
const iconoMarcador = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Centro de México por defecto (CDMX) hasta que el navegador dé la
// ubicación real o el administrador toque el mapa.
const CENTRO_MEXICO: [number, number] = [19.4326, -99.1332];

interface MapaCentroTrabajoProps {
  lat: number | null;
  lng: number | null;
  radioM: number;
  onCambiarUbicacion: (lat: number, lng: number) => void;
}

function CapturarClicks({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(evento) {
      onClick(evento.latlng.lat, evento.latlng.lng);
    },
  });
  return null;
}

export function MapaCentroTrabajo({ lat, lng, radioM, onCambiarUbicacion }: MapaCentroTrabajoProps) {
  const [centroInicial] = useState<[number, number]>(
    lat != null && lng != null ? [lat, lng] : CENTRO_MEXICO,
  );

  useEffect(() => {
    // Si todavía no hay ubicación elegida, ofrecemos la del navegador como
    // punto de partida — el administrador la confirma tocando el mapa.
    if (lat != null || lng != null) return;
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        onCambiarUbicacion(posicion.coords.latitude, posicion.coords.longitude);
      },
      () => {
        // Sin permiso o sin señal: el administrador ubica el centro tocando el mapa.
      },
      { timeout: 8000 },
    );
    // Solo al montar: no queremos pisar una ubicación que el usuario ya movió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="h-72 w-full overflow-hidden rounded-md border border-border">
        <MapContainer center={centroInicial} zoom={16} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CapturarClicks onClick={onCambiarUbicacion} />
          {lat != null && lng != null && (
            <>
              <Marker position={[lat, lng]} icon={iconoMarcador} />
              <Circle
                center={[lat, lng]}
                radius={radioM}
                pathOptions={{ color: "#166534", fillOpacity: 0.1 }}
              />
            </>
          )}
        </MapContainer>
      </div>
      <p className="text-sm text-muted">
        Toca el mapa para marcar dónde está tu negocio. El círculo verde muestra desde dónde se va
        a poder fichar.
      </p>
    </div>
  );
}
