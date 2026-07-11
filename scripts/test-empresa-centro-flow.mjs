/**
 * Prueba end-to-end de la tarea 2.4: crear empresa (RPC), agregar un
 * centro de trabajo, listarlo, editarlo. Ejercita las mismas consultas
 * que usan las Server Actions y la página del panel.
 *
 * Uso: node scripts/test-empresa-centro-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
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
const email = `flow-2-4-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userId, companyId, centroId;

try {
  const { data: u, error: eU } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check("Alta de usuario (fixture)", !eU, eU?.message);
  userId = u?.user?.id;

  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password });
  check("Login del fixture", !eLogin, eLogin?.message);

  // 1. Crear empresa — mismo RPC que usa crearEmpresa()
  const { data: idEmpresa, error: eRpc } = await cliente.rpc("create_company_with_owner", {
    company_name: "Taquería de Prueba",
  });
  check("Crear empresa vía RPC", !eRpc, eRpc?.message);
  companyId = idEmpresa;

  // 2. Insertar centro de trabajo — misma forma que crearCentroTrabajo()
  const { data: centro, error: eInsert } = await cliente
    .from("work_centers")
    .insert({
      company_id: companyId,
      name: "Sucursal Centro",
      lat: 19.4326,
      lng: -99.1332,
      geofence_radius_m: 150,
    })
    .select()
    .single();
  check("Crear centro de trabajo", !eInsert, eInsert?.message);
  centroId = centro?.id;
  check("Radio por defecto guardado correctamente", centro?.geofence_radius_m === 150);

  // 3. Listar — misma consulta que la página del panel
  const { data: listado, error: eListado } = await cliente
    .from("work_centers")
    .select("id, name, geofence_radius_m")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  check("Listar centros de trabajo de la empresa", !eListado && listado?.length === 1, eListado?.message);

  // 4. Editar — misma forma que actualizarCentroTrabajo()
  const { error: eUpdate } = await cliente
    .from("work_centers")
    .update({ name: "Sucursal Centro (renombrada)", geofence_radius_m: 200 })
    .eq("id", centroId);
  check("Editar centro de trabajo", !eUpdate, eUpdate?.message);

  const { data: actualizado } = await cliente
    .from("work_centers")
    .select("name, geofence_radius_m")
    .eq("id", centroId)
    .single();
  check(
    "Los cambios quedaron guardados",
    actualizado?.name === "Sucursal Centro (renombrada)" && actualizado?.geofence_radius_m === 200,
  );

  // 5. Límites de la columna: radio fuera de rango debe rechazarse (constraint de la 2.1)
  const { error: eFueraDeRango } = await cliente.from("work_centers").insert({
    company_id: companyId,
    name: "Radio inválido",
    lat: 0,
    lng: 0,
    geofence_radius_m: 6000,
  });
  check("Radio fuera de 10-5000m es rechazado por la base", !!eFueraDeRango);
} finally {
  if (companyId) {
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de empresa/centro pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
