/**
 * Borra la empresa de prueba creada por el smoke test de producción
 * (tarea 10.5) y todo lo que cuelga de ella: fichajes, anotaciones,
 * consentimientos, invitaciones, kioscos, empleados, centro de trabajo,
 * la empresa misma, las cuentas de auth (dueño y empleado) y las
 * selfies subidas al storage privado.
 *
 * Uso: node scripts/smoke-test-limpiar.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const NOMBRE_EMPRESA = "SMOKE TEST - Negocio de Prueba";

const { data: empresa, error: errorEmpresa } = await admin
  .from("companies")
  .select("id")
  .eq("name", NOMBRE_EMPRESA)
  .maybeSingle();

if (errorEmpresa || !empresa) {
  console.log("No se encontró la empresa de prueba. Nada que borrar.");
  process.exit(0);
}

const companyId = empresa.id;
console.log(`Empresa encontrada: ${companyId}`);

const { data: empleados } = await admin.from("employees").select("id, auth_user_id").eq("company_id", companyId);
const employeeIds = (empleados ?? []).map((e) => e.id);
const authUserIds = (empleados ?? []).map((e) => e.auth_user_id).filter(Boolean);

// Selfies en storage: listar y borrar el prefijo de la empresa.
const { data: archivos } = await admin.storage.from("selfies").list(companyId);
if (archivos && archivos.length > 0) {
  const rutas = archivos.map((a) => `${companyId}/${a.name}`);
  const { error: errorStorage } = await admin.storage.from("selfies").remove(rutas);
  console.log(`Selfies borradas: ${rutas.length}`, errorStorage ? errorStorage.message : "");
}

async function borrar(tabla, columna, valor) {
  const { error, count } = await admin.from(tabla).delete({ count: "exact" }).eq(columna, valor);
  console.log(`${tabla}: ${error ? "ERROR " + error.message : `${count ?? 0} filas borradas`}`);
}

await borrar("clock_event_annotations", "company_id", companyId);
await borrar("clock_events", "company_id", companyId);
if (employeeIds.length > 0) {
  for (const id of employeeIds) {
    await borrar("pin_lockouts", "employee_id", id);
  }
}
await borrar("consent_records", "company_id", companyId);
if (employeeIds.length > 0) {
  for (const id of employeeIds) {
    await borrar("employee_invitations", "employee_id", id);
  }
}
await borrar("kiosk_devices", "company_id", companyId);
await borrar("employees", "company_id", companyId);
await borrar("work_centers", "company_id", companyId);
await borrar("company_members", "company_id", companyId);
await borrar("companies", "id", companyId);

for (const userId of authUserIds) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  console.log(`auth.users empleado ${userId}: ${error ? "ERROR " + error.message : "borrado"}`);
}

// El dueño se busca por email, no quedó guardado su id en este script.
const { data: listaUsuarios } = await admin.auth.admin.listUsers();
const dueno = listaUsuarios.users.find((u) => u.email?.startsWith("smoke-test-owner-"));
if (dueno) {
  const { error } = await admin.auth.admin.deleteUser(dueno.id);
  console.log(`auth.users dueño ${dueno.id}: ${error ? "ERROR " + error.message : "borrado"}`);
}

console.log("Limpieza completa.");
