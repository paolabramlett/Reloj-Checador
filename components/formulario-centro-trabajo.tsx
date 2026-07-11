"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";

// Leaflet toca `window` al importarse: debe cargar solo en el navegador.
const MapaCentroTrabajo = dynamic(
  () => import("@/components/mapa-centro-trabajo").then((m) => m.MapaCentroTrabajo),
  { ssr: false, loading: () => <div className="h-72 w-full rounded-md bg-surface" /> },
);

type EstadoAccion = { error: string | null };

interface FormularioCentroTrabajoProps {
  accion: (estado: EstadoAccion, formData: FormData) => Promise<EstadoAccion>;
  valoresIniciales?: { centroId: string; nombre: string; lat: number; lng: number; radioM: number };
  titulo: string;
}

export function FormularioCentroTrabajo({
  accion,
  valoresIniciales,
  titulo,
}: FormularioCentroTrabajoProps) {
  const [estado, ejecutarAccion, enProceso] = useActionState(accion, { error: null });
  const [lat, setLat] = useState<number | null>(valoresIniciales?.lat ?? null);
  const [lng, setLng] = useState<number | null>(valoresIniciales?.lng ?? null);
  const [radioM, setRadioM] = useState(valoresIniciales?.radioM ?? 100);

  return (
    <form action={ejecutarAccion} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{titulo}</h1>

      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      {valoresIniciales && (
        <input type="hidden" name="centro_id" value={valoresIniciales.centroId} />
      )}
      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />

      <Campo
        etiqueta="Nombre del centro de trabajo"
        name="nombre"
        defaultValue={valoresIniciales?.nombre}
        placeholder="Sucursal Centro"
        required
      />

      <MapaCentroTrabajo
        lat={lat}
        lng={lng}
        radioM={radioM}
        onCambiarUbicacion={(nuevoLat, nuevoLng) => {
          setLat(nuevoLat);
          setLng(nuevoLng);
        }}
      />

      <Campo
        etiqueta="Radio para poder fichar (metros)"
        name="radio_m"
        type="number"
        min={10}
        max={5000}
        value={radioM}
        onChange={(evento) => setRadioM(Number(evento.target.value))}
        ayuda="Los empleados solo van a poder fichar desde dentro de este radio."
      />

      <Boton type="submit" cargando={enProceso}>
        Guardar
      </Boton>
    </form>
  );
}
