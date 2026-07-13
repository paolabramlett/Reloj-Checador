import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { distanciaMetros } from "@/lib/geo";
import {
  calcularFlagsDeTiempo,
  estadoDesdeUltimoEvento,
  estadoSiguiente,
  transicionEsValida,
  TIPOS_EVENTO_VALIDOS,
  type TipoEvento,
} from "@/lib/fichaje";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: empleado } = await supabase
    .from("employees")
    .select("id, company_id, work_center_id, status, work_centers(lat, lng, geofence_radius_m)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!empleado) {
    return NextResponse.json({ error: "No encontramos tu perfil de empleado." }, { status: 403 });
  }
  if (empleado.status !== "active") {
    return NextResponse.json({ error: "Tu cuenta está dada de baja." }, { status: 403 });
  }

  const centro = empleado.work_centers as unknown as {
    lat: number;
    lng: number;
    geofence_radius_m: number;
  };

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { id, event_type: eventType, device_ts: deviceTsRaw, sync_ts: syncTsRaw, lat, lng } = body;

  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!TIPOS_EVENTO_VALIDOS.includes(eventType as TipoEvento)) {
    return NextResponse.json({ error: "Tipo de fichaje inválido." }, { status: 400 });
  }
  const deviceTs = new Date(deviceTsRaw);
  if (Number.isNaN(deviceTs.getTime())) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  // sync_ts es el reloj del dispositivo AHORA, al momento de este envío —
  // distinto de device_ts cuando el fichaje esperó en la cola offline.
  // Si un cliente viejo no lo manda, asumimos que envía en el momento.
  const syncTs = syncTsRaw ? new Date(syncTsRaw) : new Date();
  if (Number.isNaN(syncTs.getTime())) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "No pudimos obtener tu ubicación." }, { status: 400 });
  }

  // Idempotencia: un reintento con el mismo id (offline-sync, grupo 4, o
  // simplemente una doble red) devuelve lo que ya se guardó, sin duplicar
  // ni recalcular nada.
  const { data: existente } = await supabase
    .from("clock_events")
    .select("event_type, device_ts")
    .eq("id", id)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({
      id,
      eventType: existente.event_type,
      deviceTs: existente.device_ts,
      estado: estadoSiguiente(existente.event_type as TipoEvento),
    });
  }

  // device_ts (cuándo pasó de verdad), no server_ts (cuándo llegó): dos
  // fichajes casi simultáneos pueden llegar al servidor en desorden, y
  // ordenar por server_ts hacía que el estado "anterior" fuera el
  // equivocado — marcando como anomalía una secuencia que en realidad
  // era válida.
  const { data: ultimoEvento } = await supabase
    .from("clock_events")
    .select("event_type")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  const esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);

  const { data: config } = await supabase
    .from("system_settings")
    .select("clock_skew_threshold_seconds, late_sync_threshold_seconds")
    .single();

  const serverTs = new Date();
  const { flagLateSync, flagClockSkew } = calcularFlagsDeTiempo(deviceTs, serverTs, syncTs, {
    lateSyncSegundos: config?.late_sync_threshold_seconds ?? 300,
    clockSkewSegundos: config?.clock_skew_threshold_seconds ?? 300,
  });
  const flagOutOfFence = distanciaMetros(lat, lng, centro.lat, centro.lng) > centro.geofence_radius_m;

  const { error: errorInsert } = await supabase.from("clock_events").insert({
    id,
    company_id: empleado.company_id,
    employee_id: empleado.id,
    work_center_id: empleado.work_center_id,
    event_type: eventType,
    source: "personal_phone",
    device_ts: deviceTs.toISOString(),
    server_ts: serverTs.toISOString(),
    lat,
    lng,
    flag_out_of_fence: flagOutOfFence,
    flag_clock_skew: flagClockSkew,
    flag_late_sync: flagLateSync,
    flag_sequence_anomaly: esAnomalia,
  });

  if (errorInsert) {
    return NextResponse.json({ error: "No pudimos registrar tu fichaje. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({
    id,
    eventType,
    deviceTs: deviceTs.toISOString(),
    estado: estadoSiguiente(eventType as TipoEvento),
  });
}
