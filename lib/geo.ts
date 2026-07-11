const RADIO_TIERRA_M = 6371000;

// Fórmula de Haversine — suficiente precisión para comparar contra un
// radio de geocerca de decenas o cientos de metros.
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO_TIERRA_M * c;
}
