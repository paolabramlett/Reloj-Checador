/**
 * Prueba end-to-end del grupo 3 (fichaje en modo teléfono personal) a
 * nivel de base de datos: RLS de clock_events, idempotencia por PK, y
 * que un empleado dado de baja no pueda fichar. La lógica pura (geocerca,
 * máquina de estados) ya se probó por separado.
 *
 * Uso: node scripts/test-fichaje-flow.mjs  (lee .env.local)
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

const stamp = Date.now();
const emailA = `fichaje-a-${stamp}@mailinator.com`;
const emailB = `fichaje-b-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userAdminId, userAId, userBId, companyId, workCenterId, empleadoAId, empleadoBId;

try {
  const { data: uAdmin } = await admin.auth.admin.createUser({
    email: `fichaje-admin-${stamp}@mailinator.com`,
    password,
    email_confirm: true,
  });
  userAdminId = uAdmin.user.id;
  const clienteAdmin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteAdmin.auth.signInWithPassword({
    email: `fichaje-admin-${stamp}@mailinator.com`,
    password,
  });

  const { data: companyIdData } = await clienteAdmin.rpc("create_company_with_owner", {
    company_name: "Empresa Fichaje",
  });
  companyId = companyIdData;

  const { data: centro } = await clienteAdmin
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4326, lng: -99.1332, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;

  // Empleado A: el que ficha. Empleado B: existe para probar aislamiento.
  const { data: uA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
  const { data: uB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
  userAId = uA.user.id;
  userBId = uB.user.id;

  const { data: empA } = await clienteAdmin
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado A", auth_user_id: userAId })
    .select()
    .single();
  const { data: empB } = await clienteAdmin
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado B", auth_user_id: userBId })
    .select()
    .single();
  empleadoAId = empA.id;
  empleadoBId = empB.id;

  const clienteA = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteA.auth.signInWithPassword({ email: emailA, password });

  // 1. A ficha su propia entrada — debe permitirse
  const idEvento1 = randomUUID();
  const ahora = new Date().toISOString();
  const { error: eInsert1 } = await clienteA.from("clock_events").insert({
    id: idEvento1,
    company_id: companyId,
    employee_id: empleadoAId,
    work_center_id: workCenterId,
    event_type: "clock_in",
    source: "personal_phone",
    device_ts: ahora,
    lat: 19.4326,
    lng: -99.1332,
  });
  check("Empleado A puede insertar su propio fichaje", !eInsert1, eInsert1?.message);

  // 2. A intenta fichar EN NOMBRE de B — RLS debe rechazarlo
  const { error: eAjeno } = await clienteA.from("clock_events").insert({
    id: randomUUID(),
    company_id: companyId,
    employee_id: empleadoBId, // ¡el empleado de otro!
    work_center_id: workCenterId,
    event_type: "clock_in",
    source: "personal_phone",
    device_ts: ahora,
    lat: 19.4326,
    lng: -99.1332,
  });
  check("Empleado A NO puede fichar en nombre de Empleado B", !!eAjeno);

  // 3. Reintento con el MISMO id (idempotencia por PK) — debe fallar como
  //    duplicado, que es exactamente lo que el endpoint usa para detectar
  //    "ya se guardó, no insertar de nuevo"
  const { error: eDuplicado } = await clienteA.from("clock_events").insert({
    id: idEvento1,
    company_id: companyId,
    employee_id: empleadoAId,
    work_center_id: workCenterId,
    event_type: "clock_in",
    source: "personal_phone",
    device_ts: ahora,
    lat: 19.4326,
    lng: -99.1332,
  });
  check("Reintento con el mismo id choca por PK (idempotencia)", eDuplicado?.code === "23505");

  // 4. A puede leer su propio fichaje
  const { data: propio } = await clienteA.from("clock_events").select("id").eq("id", idEvento1);
  check("Empleado A puede leer su propio fichaje", propio?.length === 1);

  // 5. B NO puede leer el fichaje de A
  const clienteB = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteB.auth.signInWithPassword({ email: emailB, password });
  const { data: ajeno } = await clienteB.from("clock_events").select("id").eq("id", idEvento1);
  check("Empleado B NO puede leer el fichaje de Empleado A", (ajeno ?? []).length === 0);

  // 6. El admin de la empresa SÍ puede ver el fichaje de A
  const { data: comoAdmin } = await clienteAdmin.from("clock_events").select("id").eq("id", idEvento1);
  check("El admin de la empresa puede ver el fichaje", comoAdmin?.length === 1);

  // 7. Dar de baja a A y confirmar que RLS ya no le deja insertar
  await admin.from("employees").update({ status: "terminated", terminated_at: ahora }).eq("id", empleadoAId);
  const { error: eBaja } = await clienteA.from("clock_events").insert({
    id: randomUUID(),
    company_id: companyId,
    employee_id: empleadoAId,
    work_center_id: workCenterId,
    event_type: "break_start",
    source: "personal_phone",
    device_ts: new Date().toISOString(),
    lat: 19.4326,
    lng: -99.1332,
  });
  check("Un empleado dado de baja NO puede fichar (RLS)", !!eBaja);

  // 8. system_settings es legible (umbral de clock_skew)
  const { data: config, error: eConfig } = await clienteA
    .from("system_settings")
    .select("clock_skew_threshold_seconds")
    .single();
  check("El umbral de clock_skew es legible", !eConfig && config?.clock_skew_threshold_seconds === 300);
} finally {
  if (companyId) {
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  for (const id of [userAdminId, userAId, userBId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de fichaje pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
