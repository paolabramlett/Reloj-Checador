/**
 * Prueba end-to-end de la corrección de fichajes faltantes/mal cerrados:
 * tabla clock_event_corrections (RLS + append-only), duracionExcedeUmbral
 * (lib/fichaje.ts), weekly_hours_for_employee usando una corrección
 * vigente, y tramos_pendientes_revision detectando ambos casos (turno
 * abierto, cierre marcado como anomalía).
 *
 * Uso: node scripts/test-correcciones-fichajes.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { duracionExcedeUmbral } from "../lib/fichaje.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

// 1. duracionExcedeUmbral — función pura, sin DB.
check("Duración menor al umbral no excede", !duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-13T17:00:00Z"), 16));
check("Duración mayor al umbral sí excede", duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-14T02:00:00Z"), 16));
check("Duración exactamente igual al umbral NO excede (frontera)", !duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-14T01:00:00Z"), 16));

const stamp = Date.now();
const email = `correcciones-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let ownerId, empleadoUserId, companyId, workCenterId, empleadoId;

try {
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  ownerId = u.user.id;
  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", { company_name: "Empresa Correcciones" });
  companyId = idEmpresa;
  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;

  const empleadoEmail = `correcciones-empleado-${stamp}@mailinator.com`;
  const { data: eu } = await admin.auth.admin.createUser({ email: empleadoEmail, password, email_confirm: true });
  empleadoUserId = eu.user.id;
  const { data: emp } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado Correcciones", auth_user_id: empleadoUserId })
    .select()
    .single();
  empleadoId = emp.id;

  const insertarEvento = (eventType, deviceTs, flags = {}) =>
    admin.from("clock_events").insert({
      id: randomUUID(),
      company_id: companyId,
      employee_id: empleadoId,
      work_center_id: workCenterId,
      event_type: eventType,
      source: "personal_phone",
      device_ts: deviceTs,
      server_ts: deviceTs,
      lat: 19.4,
      lng: -99.1,
      ...flags,
    }).select().single();

  // 2. Umbral configurable con default 16.
  const { data: settings } = await admin.from("system_settings").select("open_shift_threshold_hours").single();
  check("open_shift_threshold_hours existe con default 16", Number(settings?.open_shift_threshold_hours) === 16, `dio ${settings?.open_shift_threshold_hours}`);

  // 3. Caso "turno abierto": clock_in de hace 20h, sin cierre.
  const hace20h = new Date(Date.now() - 20 * 3600_000).toISOString();
  const { data: clockInAbierto } = await insertarEvento("clock_in", hace20h);
  check("Se insertó el clock_in abierto", !!clockInAbierto?.id);

  const { data: pendientesAbierto } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaAbierta = (pendientesAbierto ?? []).find((p) => p.opens_event_id === clockInAbierto.id);
  check("tramos_pendientes_revision detecta el turno abierto de 20h", !!filaAbierta, JSON.stringify(pendientesAbierto));
  check("El motivo reportado es 'abierto'", filaAbierta?.motivo === "abierto", filaAbierta?.motivo);

  // 4. Sin corrección, el turno abierto NO cuenta en horas de esa semana.
  const lunes = (() => {
    const ahora = new Date();
    const dia = ahora.getUTCDay();
    const diff = (dia === 0 ? -6 : 1) - dia;
    const l = new Date(ahora);
    l.setUTCDate(ahora.getUTCDate() + diff);
    l.setUTCHours(0, 0, 0, 0);
    return l;
  })();
  const inicioSemana = lunes.toISOString().slice(0, 10);

  // 5. El admin corrige: agrega clock_event_corrections con la hora real.
  const horaCorregida = new Date(new Date(hace20h).getTime() + 8 * 3600_000).toISOString(); // 8h después del clock_in
  const { data: correccion, error: errorCorreccion } = await cliente
    .from("clock_event_corrections")
    .insert({
      company_id: companyId,
      employee_id: empleadoId,
      opens_event_id: clockInAbierto.id,
      corrected_closing_ts: horaCorregida,
      reason: "El empleado olvidó marcar salida; según su reporte, trabajó 8 horas.",
      created_by: ownerId,
    })
    .select()
    .single();
  check("El admin (owner) puede insertar una corrección", !errorCorreccion && !!correccion, errorCorreccion?.message);

  // 6. Con la corrección, sí cuenta en el cómputo de horas.
  const { data: horasConCorreccion } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empleadoId,
    p_week_start: inicioSemana,
  });
  check("Con corrección vigente, el turno cuenta 8h", Number(horasConCorreccion) === 8, `dio ${horasConCorreccion}`);

  // 7. Ya con corrección, tramos_pendientes_revision deja de listarlo.
  const { data: pendientesTrasCorregir } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const siguePendiente = (pendientesTrasCorregir ?? []).some((p) => p.opens_event_id === clockInAbierto.id);
  check("Tras corregir, ya no aparece en pendientes", !siguePendiente);

  // 8. RLS: un empleado normal NO puede insertar correcciones.
  const clienteEmpleado = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteEmpleado.auth.signInWithPassword({ email: empleadoEmail, password });
  const { data: otroClockIn } = await insertarEvento("clock_in", new Date(Date.now() - 18 * 3600_000).toISOString());
  const { error: errorRLSEmpleado } = await clienteEmpleado.from("clock_event_corrections").insert({
    company_id: companyId,
    employee_id: empleadoId,
    opens_event_id: otroClockIn.id,
    corrected_closing_ts: new Date().toISOString(),
    reason: "intento no autorizado",
    created_by: empleadoUserId,
  });
  check("Un empleado normal NO puede insertar una corrección (RLS)", !!errorRLSEmpleado);

  // 9. El empleado SÍ puede leer las correcciones de su propio historial.
  const { data: lectura, error: errorLectura } = await clienteEmpleado
    .from("clock_event_corrections")
    .select("id")
    .eq("opens_event_id", clockInAbierto.id);
  check("El empleado puede leer una corrección sobre su propio fichaje", !errorLectura && (lectura ?? []).length === 1, errorLectura?.message);

  // 10. Caso "cierre marcado como anomalía": clock_in hace 20h + clock_out
  // flageado (simula lo que el auto-flag de las Tasks 3/4 va a producir).
  const { data: clockInAnomalia } = await insertarEvento("clock_in", new Date(Date.now() - 20 * 3600_000 - 3600_000).toISOString());
  await insertarEvento("clock_out", new Date(Date.now() - 3600_000).toISOString(), { flag_sequence_anomaly: true });

  const { data: pendientesAnomalia } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaAnomalia = (pendientesAnomalia ?? []).find((p) => p.opens_event_id === clockInAnomalia.id);
  check("tramos_pendientes_revision detecta el cierre marcado como anomalía", !!filaAnomalia, JSON.stringify(pendientesAnomalia));
  check("El motivo reportado es 'anomalia'", filaAnomalia?.motivo === "anomalia", filaAnomalia?.motivo);
} finally {
  if (companyId) {
    await admin.from("clock_event_corrections").delete().eq("company_id", companyId);
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  if (empleadoUserId) await admin.auth.admin.deleteUser(empleadoUserId);
}

console.log(failures === 0 ? "\nTodas las pruebas de corrección de fichajes pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
