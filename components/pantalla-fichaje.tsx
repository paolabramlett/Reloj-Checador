"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { distanciaMetros } from "@/lib/geo";
import {
  estadoSiguiente,
  ETIQUETA_ESTADO,
  ETIQUETA_EVENTO,
  type EstadoFichaje,
  type TipoEvento,
} from "@/lib/fichaje";
import { useColaFichajes } from "@/hooks/useColaFichajes";

interface PantallaFichajeProps {
  estadoInicial: EstadoFichaje;
  centro: { lat: number; lng: number; geofenceRadiusM: number };
}

function obtenerUbicacion(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este teléfono no puede compartir su ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export function PantallaFichaje({ estadoInicial, centro }: PantallaFichajeProps) {
  const [estado, setEstado] = useState(estadoInicial);
  const [cargando, setCargando] = useState<TipoEvento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const { pendientes, encolarYSincronizar } = useColaFichajes();

  async function fichar(tipo: TipoEvento) {
    setError(null);
    setConfirmacion(null);
    setCargando(tipo);

    try {
      const posicion = await obtenerUbicacion();
      const { latitude: lat, longitude: lng } = posicion.coords;

      const distancia = distanciaMetros(lat, lng, centro.lat, centro.lng);
      if (distancia > centro.geofenceRadiusM) {
        setError("Tienes que estar en tu lugar de trabajo para fichar.");
        return;
      }

      const deviceTs = new Date();
      const hora = deviceTs.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

      // Estado optimista: el toque queda reflejado ya mismo, haya o no
      // conexión — la cola offline se encarga de que llegue al servidor.
      setEstado(estadoSiguiente(tipo));

      const sincronizado = await encolarYSincronizar({
        id: crypto.randomUUID(),
        eventType: tipo,
        deviceTs: deviceTs.toISOString(),
        lat,
        lng,
      });

      setConfirmacion(
        sincronizado
          ? `${ETIQUETA_EVENTO[tipo]} registrada a las ${hora}.`
          : `${ETIQUETA_EVENTO[tipo]} guardada. Se va a enviar apenas haya conexión.`,
      );
    } catch {
      setError("No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.");
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-muted">Tu estado</p>
        <p className="text-2xl font-semibold text-ink">{ETIQUETA_ESTADO[estado]}</p>
      </div>

      {pendientes > 0 && (
        <p className="text-center text-sm text-muted">
          {pendientes === 1
            ? "1 fichaje pendiente de sincronizar."
            : `${pendientes} fichajes pendientes de sincronizar.`}
        </p>
      )}

      {confirmacion && <Mensaje tono="exito">{confirmacion}</Mensaje>}
      {error && <Mensaje tono="error">{error}</Mensaje>}

      {estado === "out" && (
        <Boton onClick={() => fichar("clock_in")} cargando={cargando === "clock_in"}>
          Marcar entrada
        </Boton>
      )}

      {estado === "working" && (
        <div className="flex flex-col gap-3">
          <Boton onClick={() => fichar("clock_out")} cargando={cargando === "clock_out"}>
            Marcar salida
          </Boton>
          <Boton
            variante="secundario"
            onClick={() => fichar("break_start")}
            cargando={cargando === "break_start"}
          >
            Iniciar descanso
          </Boton>
        </div>
      )}

      {estado === "on_break" && (
        <Boton onClick={() => fichar("break_end")} cargando={cargando === "break_end"}>
          Terminar descanso
        </Boton>
      )}
    </div>
  );
}
