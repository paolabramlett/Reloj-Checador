/**
 * Prueba end-to-end de la tarea 2.5: alta de empleado con PIN, PIN
 * duplicado rechazado, edición, baja (conserva el registro) y
 * reactivación. Ejercita las mismas consultas que las Server Actions.
 *
 * Uso: node scripts/test-empleados-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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
const hashPin = (companyId, pin) => createHash("sha256").update(`${companyId}:${pin}`).digest("hex");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const stamp = Date.now();
const email = `flow-2-5-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userId, companyId, workCenterId, empleado1Id, empleado2Id;

try {
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = u?.user?.id;

  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", {
    company_name: "Empresa Empleados",
  });
  companyId = idEmpresa;

  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;

  // 1. Alta de empleado con PIN — misma forma que crearEmpleado()
  const { data: empleado1, error: eAlta } = await cliente
    .from("employees")
    .insert({
      company_id: companyId,
      work_center_id: workCenterId,
      full_name: "Juan Pérez",
      pin_hash: hashPin(companyId, "1234"),
    })
    .select()
    .single();
  check("Alta de empleado con PIN", !eAlta, eAlta?.message);
  empleado1Id = empleado1?.id;
  check("Status inicial es 'active'", empleado1?.status === "active");

  // 2. Segundo empleado con el MISMO PIN en la misma empresa → debe rechazarse
  const { error: ePinDuplicado } = await cliente.from("employees").insert({
    company_id: companyId,
    work_center_id: workCenterId,
    full_name: "María López",
    pin_hash: hashPin(companyId, "1234"),
  });
  check("PIN duplicado en la misma empresa es rechazado", ePinDuplicado?.code === "23505");

  // 3. Mismo PIN pero en OTRA empresa (hash distinto por company_id) → debe aceptarse
  const { data: idEmpresa2 } = await cliente.rpc("create_company_with_owner", {
    company_name: "Otra Empresa",
  });
  const { data: centro2 } = await cliente
    .from("work_centers")
    .insert({ company_id: idEmpresa2, name: "Sucursal", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  const { error: eOtraEmpresa } = await cliente.from("employees").insert({
    company_id: idEmpresa2,
    work_center_id: centro2.id,
    full_name: "Empleado de otra empresa",
    pin_hash: hashPin(idEmpresa2, "1234"),
  });
  check("El mismo PIN numérico en otra empresa sí se permite", !eOtraEmpresa, eOtraEmpresa?.message);
  await admin.from("employees").delete().eq("company_id", idEmpresa2);
  await admin.from("work_centers").delete().eq("company_id", idEmpresa2);
  await admin.from("company_members").delete().eq("company_id", idEmpresa2);
  await admin.from("companies").delete().eq("id", idEmpresa2);

  // 4. Editar nombre — misma forma que actualizarEmpleado()
  const { error: eEditar } = await cliente
    .from("employees")
    .update({ full_name: "Juan Pérez García" })
    .eq("id", empleado1Id);
  check("Editar nombre del empleado", !eEditar, eEditar?.message);

  // 5. Quitar PIN
  const { error: eQuitarPin } = await cliente
    .from("employees")
    .update({ pin_hash: null })
    .eq("id", empleado1Id);
  check("Quitar PIN", !eQuitarPin, eQuitarPin?.message);

  // 6. Dar de baja — nunca se borra, solo cambia de estado
  const { error: eBaja } = await cliente
    .from("employees")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("id", empleado1Id);
  check("Dar de baja", !eBaja, eBaja?.message);

  const { data: trasBaja } = await cliente
    .from("employees")
    .select("status, terminated_at, full_name")
    .eq("id", empleado1Id)
    .single();
  check("El registro se conserva tras la baja (no se borra)", trasBaja?.full_name === "Juan Pérez García");
  check("Queda marcado 'terminated' con fecha", trasBaja?.status === "terminated" && !!trasBaja?.terminated_at);

  // 7. Reactivar
  const { error: eReactivar } = await cliente
    .from("employees")
    .update({ status: "active", terminated_at: null })
    .eq("id", empleado1Id);
  check("Reactivar empleado", !eReactivar, eReactivar?.message);

  const { data: trasReactivar } = await cliente
    .from("employees")
    .select("status, terminated_at")
    .eq("id", empleado1Id)
    .single();
  check(
    "Queda 'active' sin fecha de baja",
    trasReactivar?.status === "active" && trasReactivar?.terminated_at === null,
  );
} finally {
  if (companyId) {
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de empleados pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
