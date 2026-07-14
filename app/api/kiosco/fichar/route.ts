import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTokenDispositivo, verificarPinConBloqueo } from "@/lib/kiosco";
import {
  duracionExcedeUmbral,
  estadoDesdeUltimoEvento,
  estadoSiguiente,
  transicionEsValida,
  TIPOS_EVENTO_VALIDOS,
  type TipoEvento,
} from "@/lib/fichaje";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const { token, employee_id: employeeId, pin, event_type: eventType, selfie } = body;

  if (
    typeof token !== "string" ||
    typeof employeeId !== "string" ||
    typeof pin !== "string" ||
    !TIPOS_EVENTO_VALIDOS.includes(eventType as TipoEvento) ||
    typeof selfie !== "string" ||
    !selfie.startsWith("data:image/")
  ) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  const dispositivo = await validarTokenDispositivo(admin, token);
  if (!dispositivo) {
    return NextResponse.json({ error: "Kiosco no válido." }, { status: 403 });
  }

  const { data: empleado } = await admin
    .from("employees")
    .select("id, pin_hash, status")
    .eq("id", employeeId)
    .eq("work_center_id", dispositivo.workCenterId)
    .eq("company_id", dispositivo.companyId)
    .maybeSingle();

  if (!empleado || empleado.status !== "active") {
    return NextResponse.json({ error: "Empleado no válido." }, { status: 403 });
  }

  const { data: config } = await admin
    .from("system_settings")
    .select("pin_lockout_attempts, pin_lockout_minutes, open_shift_threshold_hours")
    .single();

  // Se revalida el PIN acá también (no solo en /verificar-pin): nunca hay
  // que confiar en que el paso anterior fue honesto, y así el contador de
  // intentos fallidos queda correcto pase lo que pase entre medio.
  const resultado = await verificarPinConBloqueo(
    admin,
    empleado.id,
    dispositivo.companyId,
    pin,
    empleado.pin_hash,
    config?.pin_lockout_attempts ?? 5,
    config?.pin_lockout_minutes ?? 5,
  );

  if (!resultado.ok) return NextResponse.json(resultado, { status: 401 });

  // device_ts, no server_ts — ver la misma nota en api/fichar/route.ts.
  // Acá coinciden casi siempre (el kiosco no tiene reloj propio del
  // cliente), pero un empleado que también usa su teléfono personal
  // puede mezclar ambos orígenes.
  const { data: ultimoEvento } = await admin
    .from("clock_events")
    .select("event_type, device_ts")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  let esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);

  // El kiosco no recibe device_ts del cliente: tanto la detección de
  // anomalía como el evento que se guarda más abajo usan este mismo
  // "ahora", capturado antes de la subida de la selfie para que ambos
  // reflejen el mismo instante.
  const ahora = new Date();

  // Transición estructuralmente válida, pero el tramo resultante es
  // sospechosamente largo (spec: "Auto-flag de cierre tardío").
  if (!esAnomalia && ultimoEvento && (eventType === "clock_out" || eventType === "break_end")) {
    // Para break_end el predecesor inmediato siempre es el break_start que
    // abrió el descanso (garantizado por la máquina de estados). Para
    // clock_out con un descanso de por medio, en cambio, el predecesor
    // inmediato es el break_end, no el clock_in que abrió el turno — hay
    // que buscar ese clock_in aparte, igual que en api/fichar/route.ts.
    let aperturaTs = ultimoEvento.device_ts;
    if (eventType === "clock_out" && ultimoEvento.event_type === "break_end") {
      const { data: ultimoClockIn } = await admin
        .from("clock_events")
        .select("device_ts")
        .eq("employee_id", empleado.id)
        .eq("event_type", "clock_in")
        .order("device_ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimoClockIn) {
        aperturaTs = ultimoClockIn.device_ts;
      }
    }

    esAnomalia = duracionExcedeUmbral(new Date(aperturaTs), ahora, config?.open_shift_threshold_hours ?? 16);
  }

  const id = randomUUID();
  const rutaSelfie = `${dispositivo.companyId}/${id}.jpg`;
  const bufferSelfie = Buffer.from(selfie.split(",")[1] ?? "", "base64");

  const { error: errorSubida } = await admin.storage
    .from("selfies")
    .upload(rutaSelfie, bufferSelfie, { contentType: "image/jpeg" });

  if (errorSubida) {
    return NextResponse.json({ error: "No pudimos guardar la foto. Intenta de nuevo." }, { status: 500 });
  }

  const ahoraIso = ahora.toISOString();
  const { error: errorInsert } = await admin.from("clock_events").insert({
    id,
    company_id: dispositivo.companyId,
    employee_id: empleado.id,
    work_center_id: dispositivo.workCenterId,
    event_type: eventType,
    source: "kiosk",
    device_ts: ahoraIso,
    server_ts: ahoraIso,
    selfie_path: rutaSelfie,
    flag_sequence_anomaly: esAnomalia,
  });

  if (errorInsert) {
    return NextResponse.json({ error: "No pudimos registrar tu fichaje. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ estado: estadoSiguiente(eventType as TipoEvento) });
}
