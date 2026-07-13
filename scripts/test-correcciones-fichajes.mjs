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
