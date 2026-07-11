// Lunes de la semana que contiene `referencia`, como YYYY-MM-DD.
export function inicioSemanaActual(referencia: Date = new Date()): string {
  const dia = referencia.getUTCDay(); // 0=domingo, 1=lunes...
  const diff = (dia === 0 ? -6 : 1) - dia;
  const lunes = new Date(referencia);
  lunes.setUTCDate(referencia.getUTCDate() + diff);
  lunes.setUTCHours(0, 0, 0, 0);
  return lunes.toISOString().slice(0, 10);
}

export type NivelAlerta = "normal" | "proximidad" | "exceso";

export function calcularNivelAlerta(horas: number, limite: number): NivelAlerta {
  if (horas >= limite) return "exceso";
  if (horas >= limite * 0.9) return "proximidad";
  return "normal";
}
