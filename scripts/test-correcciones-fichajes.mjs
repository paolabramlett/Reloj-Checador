/**
 * Prueba end-to-end de la corrección de fichajes faltantes/mal cerrados:
 * tabla clock_event_corrections (RLS + append-only), duracionExcedeUmbral
 * (lib/fichaje.ts), weekly_hours_for_employee usando una corrección
 * vigente, y tramos_pendientes_revision detectando ambos casos (turno
 * abierto, cierre marcado como anomalía).
 *
 * Los checks de regresión "clock_in real" (personal y kiosco) ejercitan
 * app/api/fichar/route.ts y app/api/kiosco/fichar/route.ts de verdad, vía
 * HTTP, así que requieren un `npm run dev` corriendo en
 * NEXT_PUBLIC_SITE_URL (por defecto http://localhost:3000).
 *
 * Uso: node scripts/test-correcciones-fichajes.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { duracionExcedeUmbral } from "../lib/fichaje.ts";

// Node no resuelve imports sin extensión ("./pin") fuera de un bundler, así
// que esta función se copia tal cual de lib/pin.ts para el check de
// regresión de kiosco — no es una reimplementación paralela, es
// exactamente el mismo código fuente.
const hashPin = (companyId, pin) => createHash("sha256").update(`${companyId}:${pin}`).digest("hex");

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
const SITE_URL = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
let ownerId, empleadoUserId, companyId, workCenterId, empleadoId, empleadoRegresionUserId;

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

  // Empleados aislados para escenarios que no deben interferir con los
  // eventos de empleadoId (comparten compañía pero no historial de fichajes).
  const insertarEventoPara = (empId, eventType, deviceTs, flags = {}) =>
    admin.from("clock_events").insert({
      id: randomUUID(),
      company_id: companyId,
      employee_id: empId,
      work_center_id: workCenterId,
      event_type: eventType,
      source: "personal_phone",
      device_ts: deviceTs,
      server_ts: deviceTs,
      lat: 19.4,
      lng: -99.1,
      ...flags,
    }).select().single();

  const crearEmpleado = async (nombre) => {
    const { data } = await cliente
      .from("employees")
      .insert({ company_id: companyId, work_center_id: workCenterId, full_name: nombre })
      .select()
      .single();
    return data.id;
  };

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
  // Empleado aislado: el paso 8 insertó, para empleadoId, un clock_in más
  // reciente (hace 18h) que el clockInAnomalia de aquí (hace 21h); si
  // compartieran empleado, la búsqueda LATERAL de "apertura más cercana"
  // del CTE anomalos encontraría ese clock_in de RLS en vez de este.
  const empAnomaliaId = await crearEmpleado("Anomalia Cierre");
  const { data: clockInAnomalia } = await insertarEventoPara(empAnomaliaId, "clock_in", new Date(Date.now() - 20 * 3600_000 - 3600_000).toISOString());
  await insertarEventoPara(empAnomaliaId, "clock_out", new Date(Date.now() - 3600_000).toISOString(), { flag_sequence_anomaly: true });

  const { data: pendientesAnomalia } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaAnomalia = (pendientesAnomalia ?? []).find((p) => p.opens_event_id === clockInAnomalia.id);
  check("tramos_pendientes_revision detecta el cierre marcado como anomalía", !!filaAnomalia, JSON.stringify(pendientesAnomalia));
  check("El motivo reportado es 'anomalia'", filaAnomalia?.motivo === "anomalia", filaAnomalia?.motivo);

  // 11. Bug 1 (rama "abiertos"): un clock_in válido seguido de un
  // segundo clock_in flageado (duplicado/transición inválida), sin
  // cierre. weekly_hours_for_employee solo llega a asignar
  // v_shift_start_id desde un clock_in NO flageado, así que
  // tramos_pendientes_revision debe señalar el PRIMER clock_in (el no
  // flageado) como opens_event_id — si señalara el segundo, una
  // corrección del admin sobre ese id nunca sería encontrada por
  // weekly_hours_for_employee.
  const empBug1AbiertoId = await crearEmpleado("Bug1 Abierto");
  const { data: e1 } = await insertarEventoPara(empBug1AbiertoId, "clock_in", new Date(Date.now() - 20 * 3600_000).toISOString());
  const { data: e2 } = await insertarEventoPara(empBug1AbiertoId, "clock_in", new Date(Date.now() - 19 * 3600_000).toISOString(), { flag_sequence_anomaly: true });

  const { data: pendientesBug1a } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaBug1Abierto = (pendientesBug1a ?? []).find((p) => p.employee_id === empBug1AbiertoId && p.motivo === "abierto");
  check(
    "Bug1 (abiertos): opens_event_id es el clock_in NO flageado, no el duplicado flageado",
    filaBug1Abierto?.opens_event_id === e1.id && filaBug1Abierto?.opens_event_id !== e2.id,
    JSON.stringify(filaBug1Abierto),
  );

  // 12. Bug 1 (rama "anomalos"): clock_in válido, clock_in duplicado
  // flageado inmediatamente después, y luego un clock_out flageado que
  // cierra. La búsqueda LATERAL del evento de apertura debe saltarse el
  // duplicado flageado y encontrar el clock_in original.
  const empBug1AnomaliaId = await crearEmpleado("Bug1 Anomalia");
  const t0Anomalia = Date.now() - 5 * 3600_000;
  const { data: e3 } = await insertarEventoPara(empBug1AnomaliaId, "clock_in", new Date(t0Anomalia).toISOString());
  await insertarEventoPara(empBug1AnomaliaId, "clock_in", new Date(t0Anomalia + 60_000).toISOString(), { flag_sequence_anomaly: true });
  await insertarEventoPara(empBug1AnomaliaId, "clock_out", new Date(t0Anomalia + 2 * 3600_000).toISOString(), { flag_sequence_anomaly: true });

  const { data: pendientesBug1b } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaBug1Anomalia = (pendientesBug1b ?? []).find((p) => p.employee_id === empBug1AnomaliaId && p.motivo === "anomalia");
  check(
    "Bug1 (anomalos): opens_event_id es el clock_in original NO flageado, no el duplicado flageado",
    filaBug1Anomalia?.opens_event_id === e3.id,
    JSON.stringify(filaBug1Anomalia),
  );

  // 13. Bug 2: un descanso no debe sobrevivir al cierre de su turno.
  // Secuencia dentro de la misma semana, para un empleado aislado:
  //   S1: clock_in 08:00 -> break_start(B1) 10:00 -> clock_out FLAGEADO
  //       10:05 (cierre inválido mientras el descanso seguía abierto).
  //       v_shift_start_id (S1) queda sin corrección => S1 se excluye
  //       por completo del cómputo (0h).
  //   Se corrige B1 (el descanso colgado) con corrected_closing_ts =
  //       10:30 — una corrección legítima que un admin podría cargar
  //       más tarde para ese descanso específico.
  //   S2: turno nuevo y limpio, sin relación con S1/B1:
  //       clock_in 14:00 -> break_end FLAGEADO 15:00 (espurio, sin
  //       break_start propio de S2 — es el evento que, si
  //       v_break_start_id no se hubiera reseteado al cerrar S1, iría a
  //       buscar la corrección de B1 y restaría sus 30 min de S2) ->
  //       clock_out limpio 16:00.
  //
  // Matemática esperada:
  //   S1: excluido (flageado, sin corrección) => 0h
  //   S2: 14:00 a 16:00 = 2h, menos v_break_accum.
  //     - Corregido: v_break_start_id se resetea al cerrar S1, así que
  //       el break_end flageado de las 15:00 no encuentra un descanso
  //       abierto que cerrar (no-op) => v_break_accum = 0 => S2 = 2h.
  //     - Sin corregir (bug): v_break_start_id seguía apuntando a B1,
  //       así que el break_end flageado de las 15:00 encuentra la
  //       corrección de B1 (10:00 -> 10:30 = 30 min) y la resta de S2
  //       => S2 = 1.5h (incorrecto).
  //   Total esperado de la semana = 0h + 2h = 2h.
  const empBug2Id = await crearEmpleado("Bug2 Semana");
  const t1S1 = new Date(lunes.getTime() + 8 * 3600_000).toISOString(); // lunes 08:00
  const t2B1 = new Date(lunes.getTime() + 10 * 3600_000).toISOString(); // lunes 10:00
  const t3ClockOutFlag = new Date(lunes.getTime() + 10 * 3600_000 + 5 * 60_000).toISOString(); // lunes 10:05
  const tCorreccionB1 = new Date(lunes.getTime() + 10 * 3600_000 + 30 * 60_000).toISOString(); // lunes 10:30
  const t4S2 = new Date(lunes.getTime() + 14 * 3600_000).toISOString(); // lunes 14:00
  const t5BreakEndEspurio = new Date(lunes.getTime() + 15 * 3600_000).toISOString(); // lunes 15:00
  const t6ClockOutS2 = new Date(lunes.getTime() + 16 * 3600_000).toISOString(); // lunes 16:00

  await insertarEventoPara(empBug2Id, "clock_in", t1S1);
  const { data: b1 } = await insertarEventoPara(empBug2Id, "break_start", t2B1);
  await insertarEventoPara(empBug2Id, "clock_out", t3ClockOutFlag, { flag_sequence_anomaly: true });

  const { error: errorCorreccionB1 } = await cliente.from("clock_event_corrections").insert({
    company_id: companyId,
    employee_id: empBug2Id,
    opens_event_id: b1.id,
    corrected_closing_ts: tCorreccionB1,
    reason: "Descanso colgado tras un cierre inválido; el empleado confirmó que duró 30 minutos.",
    created_by: ownerId,
  });
  check("Bug2: se pudo insertar la corrección del descanso colgado (B1)", !errorCorreccionB1, errorCorreccionB1?.message);

  await insertarEventoPara(empBug2Id, "clock_in", t4S2);
  await insertarEventoPara(empBug2Id, "break_end", t5BreakEndEspurio, { flag_sequence_anomaly: true });
  await insertarEventoPara(empBug2Id, "clock_out", t6ClockOutS2);

  const { data: horasBug2 } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empBug2Id,
    p_week_start: inicioSemana,
  });
  check(
    "Bug2: el descanso colgado de S1 no se filtra a S2 — la semana da exactamente 2h",
    Number(horasBug2) === 2,
    `dio ${horasBug2}`,
  );

  // 14. Fix (segunda ronda de review): un break_start registrado SIN
  // turno rastreado (v_shift_start_id null, p. ej. tras un clock_in
  // duplicado flageado) también debe limpiarse al primer clock_out que
  // llegue, aunque ese clock_out esté flageado y tampoco coincida con
  // ninguna de las dos ramas de seguimiento de turno. Antes, el reset de
  // v_break_start/v_break_start_id vivía DENTRO de esas dos ramas, así
  // que un clock_out que no calzara en ninguna (como el de aquí) lo
  // dejaba colgado para filtrarse a un turno posterior no relacionado —
  // igual que el Bug 2 original, pero alcanzable vía un descanso "sin
  // turno".
  // Secuencia dentro de la misma semana, para un empleado aislado:
  //   Sd: clock_in FLAGEADO (duplicado) 06:00 -> nunca fija
  //       v_shift_start_id -> break_start(Bd) 06:15 (sin turno
  //       rastreado) -> clock_out FLAGEADO 06:20 (v_shift_start_id es
  //       null, así que no calza en NINGUNA de las dos ramas de
  //       clock_out).
  //   Se corrige Bd (el descanso colgado) con corrected_closing_ts =
  //       06:45 (30 min) — una corrección legítima que un admin podría
  //       cargar después para ese descanso.
  //   S2: turno nuevo y limpio, sin relación con Sd/Bd:
  //       clock_in 09:00 -> break_end FLAGEADO 09:30 (espurio, sin
  //       break_start propio de S2 — es el evento que, si
  //       v_break_start_id no se hubiera reseteado al procesar el
  //       clock_out flageado de Sd, iría a buscar la corrección de Bd y
  //       restaría sus 30 min de S2) -> clock_out limpio 11:00.
  //
  // Matemática esperada:
  //   Sd: nunca se rastreó como turno (clock_in de apertura estaba
  //       flageado) => 0h, y el clock_out flageado tampoco suma nada
  //       porque v_shift_start_id es null.
  //   S2: 09:00 a 11:00 = 2h, menos v_break_accum.
  //     - Corregido: v_break_start_id se resetea de forma incondicional
  //       al procesar el clock_out de Sd, así que el break_end flageado
  //       de las 09:30 no encuentra un descanso abierto que cerrar
  //       (no-op) => v_break_accum = 0 => S2 = 2h.
  //     - Sin corregir (bug): v_break_start_id seguía apuntando a Bd,
  //       así que el break_end flageado de las 09:30 encuentra la
  //       corrección de Bd (06:15 -> 06:45 = 30 min) y la resta de S2
  //       => S2 = 1.5h (incorrecto).
  //   Total esperado de la semana = 0h + 2h = 2h.
  const empFix1Id = await crearEmpleado("Fix1 Descanso Sin Turno");
  const tSdClockInFlag = new Date(lunes.getTime() + 6 * 3600_000).toISOString(); // lunes 06:00
  const tBd = new Date(lunes.getTime() + 6 * 3600_000 + 15 * 60_000).toISOString(); // lunes 06:15
  const tSdClockOutFlag = new Date(lunes.getTime() + 6 * 3600_000 + 20 * 60_000).toISOString(); // lunes 06:20
  const tCorreccionBd = new Date(lunes.getTime() + 6 * 3600_000 + 45 * 60_000).toISOString(); // lunes 06:45
  const tS2In = new Date(lunes.getTime() + 9 * 3600_000).toISOString(); // lunes 09:00
  const tS2BreakEndEspurio = new Date(lunes.getTime() + 9 * 3600_000 + 30 * 60_000).toISOString(); // lunes 09:30
  const tS2ClockOut = new Date(lunes.getTime() + 11 * 3600_000).toISOString(); // lunes 11:00

  await insertarEventoPara(empFix1Id, "clock_in", tSdClockInFlag, { flag_sequence_anomaly: true });
  const { data: bd } = await insertarEventoPara(empFix1Id, "break_start", tBd);
  await insertarEventoPara(empFix1Id, "clock_out", tSdClockOutFlag, { flag_sequence_anomaly: true });

  const { error: errorCorreccionBd } = await cliente.from("clock_event_corrections").insert({
    company_id: companyId,
    employee_id: empFix1Id,
    opens_event_id: bd.id,
    corrected_closing_ts: tCorreccionBd,
    reason: "Descanso colgado sin turno rastreado; el empleado confirmó que duró 30 minutos.",
    created_by: ownerId,
  });
  check("Fix1: se pudo insertar la corrección del descanso sin turno (Bd)", !errorCorreccionBd, errorCorreccionBd?.message);

  await insertarEventoPara(empFix1Id, "clock_in", tS2In);
  await insertarEventoPara(empFix1Id, "break_end", tS2BreakEndEspurio, { flag_sequence_anomaly: true });
  await insertarEventoPara(empFix1Id, "clock_out", tS2ClockOut);

  const { data: horasFix1 } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empFix1Id,
    p_week_start: inicioSemana,
  });
  check(
    "Fix1: el descanso sin turno rastreado no se filtra a S2 — la semana da exactamente 2h",
    Number(horasFix1) === 2,
    `dio ${horasFix1}`,
  );

  // 15. Regresión: al cerrar un turno CON descanso, la duración del
  // auto-flag de "cierre tardío" (app/api/fichar/route.ts) se debe medir
  // desde el clock_in real que abrió el turno, no desde el break_end que
  // lo precede inmediatamente. Bug real que esto reproduce: el código
  // solo miraba `ultimoEvento` (el evento inmediatamente anterior), que
  // para break_end SÍ es el break_start correspondiente (correcto), pero
  // para clock_out con un descanso de por medio es el break_end, no el
  // clock_in de apertura — así que un turno de 39h con un descanso corto
  // justo antes de cerrar terminaba SIN marcarse como anomalía, porque
  // solo se medía la hora transcurrida desde que terminó el descanso.
  //
  // Escenario, vía HTTP real contra /api/fichar (no inserción directa,
  // porque el bug está en la lógica del endpoint):
  //   clock_in hace 39h (turno olvidado) -> break_start hace 2h ->
  //   break_end hace 1h (descanso corto, con pinta de normal) ->
  //   clock_out AHORA.
  // El turno completo dura ~39h y debe quedar flag_sequence_anomaly=true,
  // aunque el hueco desde break_end sea de apenas 1h.
  const emailRegresion = `correcciones-regresion-${stamp}@mailinator.com`;
  const { data: uRegresion } = await admin.auth.admin.createUser({
    email: emailRegresion,
    password,
    email_confirm: true,
  });
  empleadoRegresionUserId = uRegresion.user.id;
  const { data: empRegresion } = await cliente
    .from("employees")
    .insert({
      company_id: companyId,
      work_center_id: workCenterId,
      full_name: "Regresion ClockIn Real",
      auth_user_id: empleadoRegresionUserId,
    })
    .select()
    .single();
  const empRegresionId = empRegresion.id;

  const clienteRegresion = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: sesionRegresion, error: errorSesionRegresion } = await clienteRegresion.auth.signInWithPassword({
    email: emailRegresion,
    password,
  });
  check(
    "Regresión clock_in real: el empleado de prueba pudo iniciar sesión",
    !errorSesionRegresion && !!sesionRegresion?.session,
    errorSesionRegresion?.message,
  );

  const ahoraRegresion = Date.now();
  await insertarEventoPara(empRegresionId, "clock_in", new Date(ahoraRegresion - 39 * 3600_000).toISOString());
  await insertarEventoPara(empRegresionId, "break_start", new Date(ahoraRegresion - 2 * 3600_000).toISOString());
  await insertarEventoPara(empRegresionId, "break_end", new Date(ahoraRegresion - 1 * 3600_000).toISOString());

  // Construye la cookie de sesión que @supabase/ssr espera leer en
  // app/api/fichar/route.ts (crearClienteServidor -> createServerClient),
  // para poder hacer una llamada HTTP real y autenticada como este
  // empleado en vez de invocar la ruta directamente.
  const projectRef = new URL(URL_).hostname.split(".")[0];
  const nombreCookieSesion = `sb-${projectRef}-auth-token`;
  const valorCookieSesion =
    "base64-" + Buffer.from(JSON.stringify(sesionRegresion.session), "utf8").toString("base64url");

  const idClockOutRegresion = randomUUID();
  let respuestaFichar;
  try {
    respuestaFichar = await fetch(`${SITE_URL}/api/fichar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${nombreCookieSesion}=${valorCookieSesion}`,
      },
      body: JSON.stringify({
        id: idClockOutRegresion,
        event_type: "clock_out",
        device_ts: new Date(ahoraRegresion).toISOString(),
        sync_ts: new Date(ahoraRegresion).toISOString(),
        lat: 19.4,
        lng: -99.1,
      }),
    });
  } catch (e) {
    check(
      "Regresión clock_in real: POST /api/fichar respondió",
      false,
      `No se pudo conectar a ${SITE_URL} — ¿está corriendo 'npm run dev'? (${e.message})`,
    );
  }

  if (respuestaFichar) {
    const cuerpoFichar = await respuestaFichar.json().catch(() => null);
    check(
      "Regresión clock_in real: POST /api/fichar del clock_out respondió 200",
      respuestaFichar.status === 200,
      `status ${respuestaFichar.status} — ${JSON.stringify(cuerpoFichar)}`,
    );

    const { data: eventoClockOutRegresion } = await admin
      .from("clock_events")
      .select("flag_sequence_anomaly")
      .eq("id", idClockOutRegresion)
      .maybeSingle();
    check(
      "Regresión: turno de 39h con descanso corto justo antes de cerrar SÍ queda flageado (medido desde el clock_in real, no desde el break_end previo)",
      eventoClockOutRegresion?.flag_sequence_anomaly === true,
      JSON.stringify(eventoClockOutRegresion),
    );
  }

  // 16. Regresión (kiosco): el mismo bug del check anterior (medir la
  // duración desde el predecesor inmediato en vez del clock_in real que
  // abrió el turno) también se corrigió en
  // app/api/kiosco/fichar/route.ts (Task 4, mismo patrón que Task 3).
  // Se ejercita vía HTTP real contra /api/kiosco/fichar, que no usa
  // sesión de usuario — se autentica con token de dispositivo + PIN —
  // así que no hace falta cookie de sesión: alcanza con un empleado con
  // pin_hash y un kiosco registrado en esta empresa.
  //   clock_in hace 39h -> break_start hace 2h -> break_end hace 1h ->
  //   clock_out AHORA (vía /api/kiosco/fichar).
  // Igual que en el check anterior, el turno completo dura ~39h y debe
  // quedar flag_sequence_anomaly=true aunque el hueco desde break_end sea
  // de apenas 1h.
  const pinRegresionKiosco = "7654";
  const { data: empRegresionKiosco, error: errorEmpRegresionKiosco } = await admin
    .from("employees")
    .insert({
      company_id: companyId,
      work_center_id: workCenterId,
      full_name: "Regresion Kiosco ClockIn Real",
      pin_hash: hashPin(companyId, pinRegresionKiosco),
    })
    .select()
    .single();
  check("Regresión kiosco: se pudo crear el empleado de prueba", !errorEmpRegresionKiosco && !!empRegresionKiosco, errorEmpRegresionKiosco?.message);
  const empRegresionKioscoId = empRegresionKiosco.id;

  const tokenKioscoRegresion = randomBytes(24).toString("base64url");
  const { data: kioscoRegresion, error: errorKioscoRegresion } = await admin
    .from("kiosk_devices")
    .insert({
      company_id: companyId,
      work_center_id: workCenterId,
      name: "Kiosco Regresión",
      token_hash: createHash("sha256").update(tokenKioscoRegresion).digest("hex"),
    })
    .select()
    .single();
  check("Regresión kiosco: se pudo registrar el kiosco de prueba", !errorKioscoRegresion && !!kioscoRegresion, errorKioscoRegresion?.message);

  const ahoraRegresionKiosco = Date.now();
  await insertarEventoPara(empRegresionKioscoId, "clock_in", new Date(ahoraRegresionKiosco - 39 * 3600_000).toISOString());
  await insertarEventoPara(empRegresionKioscoId, "break_start", new Date(ahoraRegresionKiosco - 2 * 3600_000).toISOString());
  await insertarEventoPara(empRegresionKioscoId, "break_end", new Date(ahoraRegresionKiosco - 1 * 3600_000).toISOString());

  // 1x1 PNG transparente — el endpoint no valida el contenido de la
  // selfie, solo que empiece con "data:image/"; la sube tal cual.
  const selfieDePrueba =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  let respuestaFicharKiosco;
  try {
    respuestaFicharKiosco = await fetch(`${SITE_URL}/api/kiosco/fichar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenKioscoRegresion,
        employee_id: empRegresionKioscoId,
        pin: pinRegresionKiosco,
        event_type: "clock_out",
        selfie: selfieDePrueba,
      }),
    });
  } catch (e) {
    check(
      "Regresión kiosco: POST /api/kiosco/fichar respondió",
      false,
      `No se pudo conectar a ${SITE_URL} — ¿está corriendo 'npm run dev'? (${e.message})`,
    );
  }

  if (respuestaFicharKiosco) {
    const cuerpoFicharKiosco = await respuestaFicharKiosco.json().catch(() => null);
    check(
      "Regresión kiosco: POST /api/kiosco/fichar del clock_out respondió 200",
      respuestaFicharKiosco.status === 200,
      `status ${respuestaFicharKiosco.status} — ${JSON.stringify(cuerpoFicharKiosco)}`,
    );

    // El endpoint de kiosco no recibe ni devuelve el id del evento (genera
    // el suyo internamente), así que se busca el clock_out más reciente
    // de este empleado — es el único que se insertó para él en este check.
    const { data: eventoClockOutRegresionKiosco } = await admin
      .from("clock_events")
      .select("flag_sequence_anomaly")
      .eq("employee_id", empRegresionKioscoId)
      .eq("event_type", "clock_out")
      .order("device_ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    check(
      "Regresión kiosco: turno de 39h con descanso corto justo antes de cerrar SÍ queda flageado (medido desde el clock_in real, no desde el break_end previo)",
      eventoClockOutRegresionKiosco?.flag_sequence_anomaly === true,
      JSON.stringify(eventoClockOutRegresionKiosco),
    );
  }

  // 17. RLS cruzado entre empresas: una segunda empresa (con su propio
  // owner y empleado) no debe poder leer ni insertar correcciones de la
  // primera empresa.
  const stampB = `${stamp}-b`;
  const emailOwnerB = `correcciones-b-${stampB}@mailinator.com`;
  const { data: uB } = await admin.auth.admin.createUser({ email: emailOwnerB, password, email_confirm: true });
  const ownerBId = uB.user.id;
  try {
    const clienteB = createClient(URL_, ANON, { auth: { persistSession: false } });
    await clienteB.auth.signInWithPassword({ email: emailOwnerB, password });

    const { data: companyBId } = await clienteB.rpc("create_company_with_owner", { company_name: "Empresa Correcciones B" });
    const { data: centroB } = await clienteB
      .from("work_centers")
      .insert({ company_id: companyBId, name: "Matriz B", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
      .select()
      .single();

    const empleadoEmailB = `correcciones-empleado-b-${stampB}@mailinator.com`;
    const { data: euB } = await admin.auth.admin.createUser({ email: empleadoEmailB, password, email_confirm: true });
    const empleadoUserBId = euB.user.id;
    const { data: empB } = await clienteB
      .from("employees")
      .insert({ company_id: companyBId, work_center_id: centroB.id, full_name: "Empleado Correcciones B", auth_user_id: empleadoUserBId })
      .select()
      .single();

    try {
      // (a) Company B no puede LEER una corrección de la Company A.
      const { data: lecturaCruzada, error: errorLecturaCruzada } = await clienteB
        .from("clock_event_corrections")
        .select("id")
        .eq("id", correccion.id);
      check(
        "RLS cruzado: un owner de otra empresa NO puede leer una corrección ajena",
        !errorLecturaCruzada && (lecturaCruzada ?? []).length === 0,
        JSON.stringify({ errorLecturaCruzada, lecturaCruzada }),
      );

      // (b) Company B no puede INSERTAR una corrección que referencia un
      // opens_event_id de un clock_event de la Company A — el check
      // exists() de la política de insert exige que ese clock_event
      // tenga el mismo company_id/employee_id que la fila insertada, así
      // que aunque se declare company_id/employee_id de B, no encuentra
      // coincidencia y la política falla.
      const { error: errorInsertCruzado } = await clienteB.from("clock_event_corrections").insert({
        company_id: companyBId,
        employee_id: empB.id,
        opens_event_id: clockInAbierto.id,
        corrected_closing_ts: new Date().toISOString(),
        reason: "intento cruzado no autorizado",
        created_by: ownerBId,
      });
      check("RLS cruzado: un owner de otra empresa NO puede insertar una corrección referenciando un evento ajeno", !!errorInsertCruzado, errorInsertCruzado?.message);
    } finally {
      await admin.from("clock_event_corrections").delete().eq("company_id", companyBId);
      await admin.from("clock_events").delete().eq("company_id", companyBId);
      await admin.from("employees").delete().eq("company_id", companyBId);
      await admin.from("work_centers").delete().eq("company_id", companyBId);
      await admin.from("company_members").delete().eq("company_id", companyBId);
      await admin.from("companies").delete().eq("id", companyBId);
      await admin.auth.admin.deleteUser(empleadoUserBId);
    }
  } finally {
    await admin.auth.admin.deleteUser(ownerBId);
  }
} finally {
  if (companyId) {
    // La selfie que /api/kiosco/fichar sube durante el check de regresión
    // de kiosco queda con un nombre generado por el propio endpoint
    // (randomUUID interno, no expuesto en la respuesta) — se limpia
    // listando la carpeta de la empresa en el bucket en vez de por id.
    const { data: selfiesEnCarpeta } = await admin.storage.from("selfies").list(companyId);
    if (selfiesEnCarpeta?.length) {
      await admin.storage.from("selfies").remove(selfiesEnCarpeta.map((f) => `${companyId}/${f.name}`));
    }
    await admin.from("clock_event_corrections").delete().eq("company_id", companyId);
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("kiosk_devices").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  if (empleadoUserId) await admin.auth.admin.deleteUser(empleadoUserId);
  if (empleadoRegresionUserId) await admin.auth.admin.deleteUser(empleadoRegresionUserId);
}

console.log(failures === 0 ? "\nTodas las pruebas de corrección de fichajes pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
