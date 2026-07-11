/**
 * Prueba end-to-end del grupo 6 (onboarding y consentimiento): documentos
 * vigentes, aceptación en modo personal, re-aceptación automática al
 * cambiar de versión (conservando la constancia vieja), y aislamiento
 * entre empresas.
 *
 * Uso: node scripts/test-consentimiento-flow.mjs  (lee .env.local)
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
const email = `consentimiento-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userId, companyId, empleadoId, docSystemV1Id, docSystemV2Id, docPrivacyId;

try {
  // 0. Documentos sembrados por la migración: deben existir
  const { data: documentos } = await admin.from("consent_documents").select("id, type, version");
  check("La migración sembró los 2 documentos versión 1", documentos?.length === 2);
  docSystemV1Id = documentos.find((d) => d.type === "system_agreement")?.id;
  docPrivacyId = documentos.find((d) => d.type === "privacy_notice")?.id;

  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = u.user.id;
  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", { company_name: "Empresa Consentimiento" });
  companyId = idEmpresa;
  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  const { data: emp } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: centro.id, full_name: "Empleado Consentimiento", auth_user_id: userId })
    .select()
    .single();
  empleadoId = emp.id;

  // 1. Al principio, no tiene ninguna constancia
  const { data: aceptacionesAntes } = await cliente.from("consent_records").select("id").eq("employee_id", empleadoId);
  check("Antes de aceptar, no tiene ninguna constancia", (aceptacionesAntes ?? []).length === 0);

  // 2. Aceptar ambos documentos vigentes (modo personal) — misma forma que aceptarConsentimiento()
  const { error: eAceptar } = await cliente.from("consent_records").insert([
    { company_id: companyId, employee_id: empleadoId, document_id: docSystemV1Id, source: "personal_phone" },
    { company_id: companyId, employee_id: empleadoId, document_id: docPrivacyId, source: "personal_phone" },
  ]);
  check("Acepta ambos documentos vigentes", !eAceptar, eAceptar?.message);

  const { data: aceptacionesDespues } = await cliente.from("consent_records").select("document_id").eq("employee_id", empleadoId);
  check("Ahora tiene 2 constancias", (aceptacionesDespues ?? []).length === 2);

  // 3. No puede aceptar el MISMO documento dos veces (unique employee_id+document_id)
  const { error: eDuplicado } = await cliente
    .from("consent_records")
    .insert({ company_id: companyId, employee_id: empleadoId, document_id: docSystemV1Id, source: "personal_phone" });
  check("Aceptar el mismo documento dos veces es rechazado (constraint unique)", eDuplicado?.code === "23505");

  // 4. Simula un cambio de versión del acuerdo del sistema (v2) — mismo
  //    mecanismo que usaría una futura actualización de texto
  const { data: docV2 } = await admin
    .from("consent_documents")
    .insert({ type: "system_agreement", version: 2, body: "Texto actualizado del acuerdo, v2." })
    .select()
    .single();
  docSystemV2Id = docV2.id;

  // 5. La constancia vieja (v1) se conserva intacta
  const { data: constanciaV1 } = await admin
    .from("consent_records")
    .select("id")
    .eq("employee_id", empleadoId)
    .eq("document_id", docSystemV1Id)
    .maybeSingle();
  check("La constancia de la versión 1 se conserva tras publicar la v2", !!constanciaV1);

  // 6. El empleado ahora "le falta aceptar" la v2 (no tiene un consent_record para docSystemV2Id)
  const { data: tieneV2 } = await admin
    .from("consent_records")
    .select("id")
    .eq("employee_id", empleadoId)
    .eq("document_id", docSystemV2Id)
    .maybeSingle();
  check("Todavía no aceptó la v2 (debe re-aparecer como pendiente)", !tieneV2);

  // 7. Acepta la v2 — ahora tiene 3 constancias en total (v1 + privacidad + v2)
  await cliente.from("consent_records").insert({ company_id: companyId, employee_id: empleadoId, document_id: docSystemV2Id, source: "personal_phone" });
  const { data: aceptacionesFinal } = await cliente.from("consent_records").select("document_id").eq("employee_id", empleadoId);
  check("Tras aceptar la v2, tiene 3 constancias (conserva la v1)", (aceptacionesFinal ?? []).length === 3);

  // 8. Un empleado de otra empresa no ve las constancias de este
  const { data: uOtro } = await admin.auth.admin.createUser({ email: `otro-${stamp}@mailinator.com`, password, email_confirm: true });
  const clienteOtro = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteOtro.auth.signInWithPassword({ email: `otro-${stamp}@mailinator.com`, password });
  await clienteOtro.rpc("create_company_with_owner", { company_name: "Otra Empresa Consentimiento" });
  const { data: constanciasAjenas } = await clienteOtro.from("consent_records").select("id").eq("employee_id", empleadoId);
  check("Un admin de otra empresa no ve las constancias de este empleado", (constanciasAjenas ?? []).length === 0);

  const { data: otroMembership } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", uOtro.user.id)
    .maybeSingle();
  if (otroMembership) {
    await admin.from("company_members").delete().eq("company_id", otroMembership.company_id);
    await admin.from("companies").delete().eq("id", otroMembership.company_id);
  }
  await admin.auth.admin.deleteUser(uOtro.user.id);
} finally {
  // Orden importa: consent_records referencia consent_documents por FK
  // (sin ON DELETE CASCADE, a propósito — son constancias legales). Si se
  // borra el documento antes que sus constancias, el DELETE falla en
  // silencio (no revisamos el error acá) y el documento de prueba queda
  // huérfano en una base que no tiene scoping por empresa.
  if (companyId) {
    await admin.from("consent_records").delete().eq("company_id", companyId);
  }
  if (docSystemV2Id) await admin.from("consent_documents").delete().eq("id", docSystemV2Id);
  if (companyId) {
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de consentimiento pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
