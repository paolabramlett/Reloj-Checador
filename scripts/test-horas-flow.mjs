/**
 * Prueba end-to-end del grupo 7 (tablero de horas): límites legales por
 * año (con clamp para años futuros), cómputo de horas semanales desde
 * los eventos crudos, exclusión de anomalías, y turno todavía abierto
 * contando hasta el momento de la consulta.
 *
 * Uso: node scripts/test-horas-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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

// 1. Límites legales: exactos + clamp para años sin fila propia
const { data: l2026 } = await admin.rpc("legal_weekly_hours", { p_year: 2026 });
const { data: l2027 } = await admin.rpc("legal_weekly_hours", { p_year: 2027 });
const { data: l2030 } = await admin.rpc("legal_weekly_hours", { p_year: 2030 });
const { data: l2035 } = await admin.rpc("legal_weekly_hours", { p_year: 2035 });
check("2026 → 48h", Number(l2026) === 48);
check("2027 → 46h", Number(l2027) === 46);
check("2030 → 40h", Number(l2030) === 40);
check("2035 (sin fila propia) hace clamp a 40h", Number(l2035) === 40);

const stamp = Date.now();
const email = `horas-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userId, companyId, workCenterId, empleadoId;

try {
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = u.user.id;
  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", { company_name: "Empresa Horas" });
  companyId = idEmpresa;
  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;
  const { data: emp } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado Horas" })
    .select()
    .single();
  empleadoId = emp.id;

  // Lunes de "ahora" (mismo cálculo que inicioSemanaActual en JS, pero en SQL)
  const ahora = new Date();
  const dia = ahora.getUTCDay();
  const diff = (dia === 0 ? -6 : 1) - dia;
  const lunes = new Date(ahora);
  lunes.setUTCDate(ahora.getUTCDate() + diff);
  lunes.setUTCHours(0, 0, 0, 0);
  const inicioSemana = lunes.toISOString().slice(0, 10);

  const insertarEvento = (eventType, serverTs, flags = {}) =>
    admin.from("clock_events").insert({
      id: randomUUID(),
      company_id: companyId,
      employee_id: empleadoId,
      work_center_id: workCenterId,
      event_type: eventType,
      source: "personal_phone",
      device_ts: serverTs,
      server_ts: serverTs,
      lat: 19.4,
      lng: -99.1,
      ...flags,
    });

  // Turno cerrado: 09:00 a 13:00 con 30 min de descanso (10:00-10:30) → 3.5h
  const base = new Date(lunes);
  base.setUTCHours(9, 0, 0, 0);
  const h = (horas) => new Date(base.getTime() + horas * 3600_000).toISOString();

  await insertarEvento("clock_in", h(0)); // 09:00
  await insertarEvento("break_start", h(1)); // 10:00
  await insertarEvento("break_end", h(1.5)); // 10:30
  await insertarEvento("clock_out", h(4)); // 13:00

  const { data: horasCalculadas } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empleadoId,
    p_week_start: inicioSemana,
  });
  check("Turno de 4h con 30min de descanso computa 3.5h", Number(horasCalculadas) === 3.5, `dio ${horasCalculadas}`);

  // Segundo turno el mismo día, pero con una entrada duplicada (anomalía)
  // que NO debe sumar al cómputo automático
  await insertarEvento("clock_in", h(5), { flag_sequence_anomaly: true }); // anómalo, no debe contar
  await insertarEvento("clock_in", h(6)); // 15:00 real
  await insertarEvento("clock_out", h(7)); // 16:00 → +1h

  const { data: horasConAnomalia } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empleadoId,
    p_week_start: inicioSemana,
  });
  check(
    "El evento marcado como anomalía se excluye; suma 3.5h + 1h = 4.5h",
    Number(horasConAnomalia) === 4.5,
    `dio ${horasConAnomalia}`,
  );

  // Turno todavía abierto: entra ahora mismo, sin salida — debe contar
  // hasta el momento de la consulta, no cero.
  const { data: emp2 } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado Turno Abierto" })
    .select()
    .single();
  const haceDiezMinutos = new Date(Date.now() - 10 * 60_000).toISOString();
  await admin.from("clock_events").insert({
    id: randomUUID(),
    company_id: companyId,
    employee_id: emp2.id,
    work_center_id: workCenterId,
    event_type: "clock_in",
    source: "personal_phone",
    device_ts: haceDiezMinutos,
    server_ts: haceDiezMinutos,
    lat: 19.4,
    lng: -99.1,
  });
  const { data: horasAbierto } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: emp2.id,
    p_week_start: inicioSemana,
  });
  const horasAbiertoNum = Number(horasAbierto);
  check(
    "Turno todavía abierto (entró hace 10 min) cuenta ~0.17h, no 0",
    horasAbiertoNum > 0.1 && horasAbiertoNum < 0.3,
    `dio ${horasAbierto}`,
  );
} finally {
  if (companyId) {
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(failures === 0 ? "\nTodas las pruebas del tablero de horas pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
