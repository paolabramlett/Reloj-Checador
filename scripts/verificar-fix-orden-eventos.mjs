/**
 * Prueba puntual del fix de orden de eventos (device_ts vs server_ts):
 * crea una empresa/centro/empleado de prueba y deja las credenciales
 * listas para simular, desde el navegador, el mismo caso real reportado
 * por Paola (fichajes que llegan al servidor en un orden distinto al
 * que pasaron).
 *
 * Uso: node scripts/verificar-fix-orden-eventos.mjs (lee .env.local)
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

const stamp = Date.now();
const email = `test-orden-${stamp}@mailinator.com`;
const password = "TestOrden123!";

const { data: usuario, error: errorUsuario } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (errorUsuario) throw errorUsuario;

const { data: empresa, error: errorEmpresa } = await admin
  .from("companies")
  .insert({ name: "TEST ORDEN - Verificacion" })
  .select("id")
  .single();
if (errorEmpresa) throw errorEmpresa;

await admin.from("company_members").insert({ company_id: empresa.id, user_id: usuario.user.id, role: "owner" });

const { data: centro, error: errorCentro } = await admin
  .from("work_centers")
  .insert({ company_id: empresa.id, name: "Centro Test", lat: 19.4326, lng: -99.1332, geofence_radius_m: 5000 })
  .select("id")
  .single();
if (errorCentro) throw errorCentro;

const { data: empleadoUsuario, error: errorEmpleadoUsuario } = await admin.auth.admin.createUser({
  email: `test-orden-empleado-${stamp}@mailinator.com`,
  password,
  email_confirm: true,
});
if (errorEmpleadoUsuario) throw errorEmpleadoUsuario;

const { data: empleado, error: errorEmpleado } = await admin
  .from("employees")
  .insert({
    company_id: empresa.id,
    work_center_id: centro.id,
    full_name: "Empleado Test Orden",
    auth_user_id: empleadoUsuario.user.id,
  })
  .select("id")
  .single();
if (errorEmpleado) throw errorEmpleado;

console.log(
  JSON.stringify(
    {
      companyId: empresa.id,
      employeeId: empleado.id,
      employeeEmail: `test-orden-empleado-${stamp}@mailinator.com`,
      password,
      lat: 19.4326,
      lng: -99.1332,
    },
    null,
    2,
  ),
);
