export type TipoEvento = "clock_in" | "break_start" | "break_end" | "clock_out";
export type EstadoFichaje = "out" | "working" | "on_break";

// A qué estado lleva CADA tipo de evento cuando se registra.
const ESTADO_TRAS_EVENTO: Record<TipoEvento, EstadoFichaje> = {
  clock_in: "working",
  break_start: "on_break",
  break_end: "working",
  clock_out: "out",
};

// Qué eventos son válidos DESDE cada estado. Cualquier otro es anomalía
// (spec time-clock, "Secuencias inválidas marcadas como anomalía"): el
// evento igual se guarda, pero queda marcado para el administrador.
const TRANSICIONES_VALIDAS: Record<EstadoFichaje, TipoEvento[]> = {
  out: ["clock_in"],
  working: ["break_start", "clock_out"],
  on_break: ["break_end"],
};

export function estadoDesdeUltimoEvento(ultimoTipo: TipoEvento | null): EstadoFichaje {
  return ultimoTipo ? ESTADO_TRAS_EVENTO[ultimoTipo] : "out";
}

export function estadoSiguiente(tipo: TipoEvento): EstadoFichaje {
  return ESTADO_TRAS_EVENTO[tipo];
}

export function transicionEsValida(estadoActual: EstadoFichaje, nuevoTipo: TipoEvento): boolean {
  return TRANSICIONES_VALIDAS[estadoActual].includes(nuevoTipo);
}

export const TIPOS_EVENTO_VALIDOS: readonly TipoEvento[] = [
  "clock_in",
  "break_start",
  "break_end",
  "clock_out",
];

export const ETIQUETA_EVENTO: Record<TipoEvento, string> = {
  clock_in: "Entrada",
  break_start: "Inicio de descanso",
  break_end: "Fin de descanso",
  clock_out: "Salida",
};

export const ETIQUETA_ESTADO: Record<EstadoFichaje, string> = {
  out: "Fuera de turno",
  working: "Trabajando",
  on_break: "En descanso",
};

export interface UmbralesFichaje {
  lateSyncSegundos: number;
  clockSkewSegundos: number;
}

export interface FlagsDeTiempo {
  flagLateSync: boolean;
  flagClockSkew: boolean;
}

/**
 * late_sync mide cuánto tardó en llegar el fichaje ORIGINAL (device_ts,
 * el toque real) — grande cuando la cola offline lo retuvo. clock_skew
 * compara el reloj del dispositivo justo AHORA (sync_ts, tomado al momento
 * de este intento de envío) contra el del servidor — así un reloj mal
 * puesto se detecta sin confundirse con "estuvo mucho tiempo en cola".
 */
export function calcularFlagsDeTiempo(
  deviceTs: Date,
  serverTs: Date,
  syncTs: Date,
  umbrales: UmbralesFichaje,
): FlagsDeTiempo {
  const retrasoMs = serverTs.getTime() - deviceTs.getTime();
  const desviacionMs = Math.abs(serverTs.getTime() - syncTs.getTime());
  return {
    flagLateSync: retrasoMs > umbrales.lateSyncSegundos * 1000,
    flagClockSkew: desviacionMs > umbrales.clockSkewSegundos * 1000,
  };
}

/**
 * True si el tramo entre `apertura` y `cierre` supera `umbralHoras` — se
 * usa para auto-marcar flag_sequence_anomaly en un cierre estructural-
 * mente válido pero sospechosamente tardío (spec: "Auto-flag de cierre
 * tardío"), y para listar tramos abiertos en tramos_pendientes_revision.
 */
export function duracionExcedeUmbral(apertura: Date, cierre: Date, umbralHoras: number): boolean {
  const horasTranscurridas = (cierre.getTime() - apertura.getTime()) / 3_600_000;
  return horasTranscurridas > umbralHoras;
}
