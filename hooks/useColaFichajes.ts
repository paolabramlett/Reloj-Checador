"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  contarPendientes,
  encolarFichaje,
  eliminarDeCola,
  listarPendientes,
  marcarIntentoFallido,
  type FichajeEnCola,
} from "@/lib/cola-fichajes";

const REINTENTO_BASE_MS = 2000;
const REINTENTO_MAX_MS = 30000;

interface RespuestaFichar {
  estado: string;
}

// El guard de "ya hay un drenaje en curso" y el callback de éxito viven en
// refs, no en el estado de React: `drenar` se registra UNA vez en el
// listener de `online` al montar, y si dependiera de state en un closure
// capturado en ese momento, quedaría desactualizado para siempre (el
// clásico bug de closure obsoleto con un useEffect de dependencias vacías).
export function useColaFichajes(onSincronizado?: (id: string, estado: string) => void) {
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);
  const fallosConsecutivos = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSincronizadoRef = useRef(onSincronizado);
  onSincronizadoRef.current = onSincronizado;

  const actualizarContador = useCallback(async () => {
    setPendientes(await contarPendientes());
  }, []);

  const drenar = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);

    try {
      const items = await listarPendientes();
      let huboFallo = false;

      for (const item of items) {
        try {
          const respuesta = await fetch("/api/fichar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item.id,
              event_type: item.eventType,
              device_ts: item.deviceTs,
              sync_ts: new Date().toISOString(),
              lat: item.lat,
              lng: item.lng,
            }),
          });

          if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

          const datos: RespuestaFichar = await respuesta.json();
          await eliminarDeCola(item.id);
          onSincronizadoRef.current?.(item.id, datos.estado);
        } catch (error) {
          huboFallo = true;
          await marcarIntentoFallido(item.id, error instanceof Error ? error.message : "error de red");
        }
      }

      await actualizarContador();
      fallosConsecutivos.current = huboFallo ? fallosConsecutivos.current + 1 : 0;

      if (huboFallo) {
        const espera = Math.min(REINTENTO_MAX_MS, REINTENTO_BASE_MS * 2 ** fallosConsecutivos.current);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(drenar, espera);
      }
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualizarContador]);

  useEffect(() => {
    actualizarContador();
    drenar(); // por si quedó algo pendiente de una sesión anterior
    window.addEventListener("online", drenar);
    return () => {
      window.removeEventListener("online", drenar);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const encolarYSincronizar = useCallback(
    async (fichaje: {
      id: string;
      eventType: FichajeEnCola["eventType"];
      deviceTs: string;
      lat: number;
      lng: number;
    }): Promise<boolean> => {
      await encolarFichaje(fichaje);
      await actualizarContador();
      await drenar();
      const siguePendiente = (await listarPendientes()).some((item) => item.id === fichaje.id);
      return !siguePendiente;
    },
    [actualizarContador, drenar],
  );

  return { pendientes, sincronizando, encolarYSincronizar };
}
