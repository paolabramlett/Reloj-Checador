export interface FlagsEvento {
  flag_late_sync: boolean;
  flag_clock_skew: boolean;
  flag_out_of_fence: boolean;
  flag_sequence_anomaly: boolean;
}

export function marcasDelEvento(evento: FlagsEvento): string[] {
  const marcas: string[] = [];
  if (evento.flag_sequence_anomaly) marcas.push("Anomalía de secuencia");
  if (evento.flag_out_of_fence) marcas.push("Fuera de geocerca");
  if (evento.flag_clock_skew) marcas.push("Reloj desviado");
  if (evento.flag_late_sync) marcas.push("Sincronizado tarde");
  if (marcas.length === 0) marcas.push("En vivo");
  return marcas;
}

export const ETIQUETA_ORIGEN: Record<string, string> = {
  personal_phone: "Teléfono personal",
  kiosk: "Kiosco",
};
