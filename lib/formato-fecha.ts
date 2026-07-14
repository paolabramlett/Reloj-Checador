// Formateo de fechas para pantallas y reportes renderizados en el
// servidor. Sin timeZone explícito, toLocaleString usa la zona del
// proceso donde corre — en Vercel eso es UTC, no la hora de México, así
// que las horas se verían corridas ~6h para cualquier lector en México.
const ZONA_MEXICO = "America/Mexico_City";

export function formatearFechaHora(fecha: string | Date): string {
  return new Date(fecha).toLocaleString("es-MX", { timeZone: ZONA_MEXICO });
}

export function formatearFechaHoraCorta(fecha: string | Date): string {
  return new Date(fecha).toLocaleString("es-MX", {
    timeZone: ZONA_MEXICO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatearFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-MX", { timeZone: ZONA_MEXICO });
}

// El input datetime-local del formulario de corrección entrega
// "YYYY-MM-DDTHH:mm" sin zona — se interpreta como hora de Zona Centro
// (UTC-6 fijo, México no tiene horario de verano desde 2022) y se
// convierte a un Date en UTC real para guardar en la base.
export function interpretarFechaHoraLocalComoUTC(valorDatetimeLocal: string): Date {
  return new Date(`${valorDatetimeLocal}:00-06:00`);
}
