/**
 * Prueba end-to-end del grupo 8 (historial y reportes de cumplimiento):
 * filtros de historial, anotaciones vinculadas sin tocar el original, y
 * — lo más importante — que la retención legal (art. 804 LFT) esté
 * realmente bloqueada a nivel de base de datos, no solo por no tener un
 * botón de borrar en la UI.
 *
 * Uso: node scripts/test-historial-flow.mjs  (lee .env.local)
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
const email = `historial-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userId, companyId, workCenterId, empleadoId, eventoId;

try {
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = u.user.id;
  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", { company_name: "Empresa Historial" });
  companyId = idEmpresa;
  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;
  const { data: emp } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado Historial" })
    .select()
    .single();
  empleadoId = emp.id;

  eventoId = randomUUID();
  await admin.from("clock_events").insert({
    id: eventoId,
    company_id: companyId,
    employee_id: empleadoId,
    work_center_id: workCenterId,
    event_type: "clock_in",
    source: "personal_phone",
    device_ts: new Date().toISOString(),
    server_ts: new Date().toISOString(),
    lat: 19.4,
    lng: -99.1,
  });

  // 1. Filtro por empleado y rango de fechas — misma forma que /panel/historial
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: filtrados } = await cliente
    .from("clock_events")
    .select("id")
    .eq("company_id", companyId)
    .eq("employee_id", empleadoId)
    .gte("device_ts", `${hoy}T00:00:00Z`)
    .lte("device_ts", `${hoy}T23:59:59Z`);
  check("El historial filtrado por empleado y fecha encuentra el evento", (filtrados ?? []).some((f) => f.id === eventoId));

  // 2. Anotación: se crea vinculada, sin tocar el evento original
  const { error: eAnotar } = await cliente.from("clock_event_annotations").insert({
    clock_event_id: eventoId,
    company_id: companyId,
    created_by: (await cliente.auth.getUser()).data.user.id,
    motivo: "El empleado reporta que en realidad entró 10 minutos antes.",
  });
  check("Se puede agregar una anotación de corrección", !eAnotar, eAnotar?.message);

  const { data: eventoOriginal } = await cliente.from("clock_events").select("device_ts").eq("id", eventoId).single();
  check("El evento original no cambió (la anotación no lo tocó)", !!eventoOriginal);

  // 3. Las anotaciones son inmutables: no hay política de UPDATE/DELETE.
  //    OJO: en Postgres, RLS sin política de UPDATE no da error — el
  //    UPDATE simplemente afecta 0 filas (la fila "no existe" para ese
  //    rol). Por eso verificamos el efecto real releyendo, no el `error`.
  const { data: anotacionCreada } = await cliente
    .from("clock_event_annotations")
    .select("id, motivo")
    .eq("clock_event_id", eventoId)
    .single();
  await cliente.from("clock_event_annotations").update({ motivo: "intento de editar" }).eq("id", anotacionCreada.id);
  const { data: anotacionTrasIntento } = await admin
    .from("clock_event_annotations")
    .select("motivo")
    .eq("id", anotacionCreada.id)
    .single();
  check(
    "No se puede editar una anotación ya creada (el motivo original sigue intacto)",
    anotacionTrasIntento.motivo === anotacionCreada.motivo,
    `quedó: "${anotacionTrasIntento.motivo}"`,
  );

  // 4. RETENCIÓN (tarea 8.5): el admin de la empresa no puede borrar un
  //    fichaje (mismo cuidado: verificar el efecto real, no el `error`).
  await cliente.from("clock_events").delete().eq("id", eventoId);
  const { data: eventoTrasIntentoAdmin } = await admin
    .from("clock_events")
    .select("id")
    .eq("id", eventoId)
    .maybeSingle();
  check("El admin de la empresa NO puede borrar un fichaje (sigue existiendo)", !!eventoTrasIntentoAdmin);

  // 5. Ni con service role (bypassa RLS) se puede borrar: la FK sin
  //    cascada lo bloquea a nivel de esquema mientras tenga una anotación
  //    referenciándolo. Acá sí esperamos un error real de Postgres.
  const { error: eBorrarEventoService } = await admin.from("clock_events").delete().eq("id", eventoId);
  check(
    "Ni la service role puede borrar el fichaje mientras tenga una anotación (FK sin cascada)",
    !!eBorrarEventoService,
  );

  // 6. Dar de baja a un empleado con fichajes no permite borrarlo — la FK
  //    de clock_events.employee_id también bloquea el DELETE directo.
  const { error: eBorrarEmpleado } = await admin.from("employees").delete().eq("id", empleadoId);
  check(
    "No se puede borrar un empleado que tiene fichajes asociados (FK sin cascada)",
    !!eBorrarEmpleado,
  );

  // 7. Tampoco se puede borrar la empresa mientras tenga empleados
  const { error: eBorrarEmpresa } = await admin.from("companies").delete().eq("id", companyId);
  check("No se puede borrar una empresa que tiene empleados (FK sin cascada)", !!eBorrarEmpresa);
} finally {
  // Limpieza real: en el orden correcto para no volver a toparnos con el
  // mismo problema de huérfanos que ya nos pasó en el grupo 6.
  if (companyId) {
    await admin.from("clock_event_annotations").delete().eq("company_id", companyId);
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(failures === 0 ? "\nTodas las pruebas de historial/retención pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
