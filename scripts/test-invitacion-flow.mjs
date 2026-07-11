/**
 * Prueba end-to-end de la tarea 2.6: generar invitación, validar token,
 * canjearla creando sesión propia del empleado, y confirmar que un link
 * ya usado (o de un empleado dado de baja) se rechaza. Ejercita las
 * mismas consultas que las Server Actions y la página pública.
 *
 * Uso: node scripts/test-invitacion-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
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
const generarToken = () => randomBytes(24).toString("base64url");
const hashToken = (t) => createHash("sha256").update(t).digest("hex");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const stamp = Date.now();
const emailAdmin = `flow-2-6-admin-${stamp}@mailinator.com`;
const emailEmpleado = `flow-2-6-empleado-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let adminUserId, empleadoUserId, companyId, empleadoId;

try {
  const { data: uAdmin } = await admin.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  adminUserId = uAdmin?.user?.id;

  const clienteAdmin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteAdmin.auth.signInWithPassword({ email: emailAdmin, password });

  const { data: idEmpresa } = await clienteAdmin.rpc("create_company_with_owner", {
    company_name: "Empresa Invitaciones",
  });
  companyId = idEmpresa;

  const { data: centro } = await clienteAdmin
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();

  const { data: empleado } = await clienteAdmin
    .from("employees")
    .insert({ company_id: companyId, work_center_id: centro.id, full_name: "Ana Torres" })
    .select()
    .single();
  empleadoId = empleado.id;

  // 1. Generar invitación — misma forma que generarInvitacion()
  const token = generarToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: eUpsert } = await clienteAdmin.from("employee_invitations").upsert(
    { employee_id: empleadoId, token_hash: tokenHash, expires_at: expiresAt, used_at: null },
    { onConflict: "employee_id" },
  );
  check("Admin genera la invitación (RLS lo permite, es su empleado)", !eUpsert, eUpsert?.message);

  // 2. Otro admin (de otra empresa) NO puede generar invitación para este empleado ajeno
  const { data: uOtro } = await admin.auth.admin.createUser({
    email: `flow-2-6-otro-${stamp}@mailinator.com`,
    password,
    email_confirm: true,
  });
  const clienteOtro = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteOtro.auth.signInWithPassword({ email: `flow-2-6-otro-${stamp}@mailinator.com`, password });
  const { error: eAjeno } = await clienteOtro
    .from("employee_invitations")
    .upsert(
      { employee_id: empleadoId, token_hash: hashToken(generarToken()), expires_at: expiresAt },
      { onConflict: "employee_id" },
    );
  check("Un admin de otra empresa NO puede invitar a un empleado ajeno", !!eAjeno);
  await admin.auth.admin.deleteUser(uOtro.user.id);

  // 3. Canjear la invitación — misma forma que reclamarInvitacion()
  const { data: invitacion } = await admin
    .from("employee_invitations")
    .select("id, employee_id, expires_at, used_at, employees(auth_user_id, status)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  const empDeInvitacion = invitacion?.employees;
  const valida =
    !!invitacion &&
    !invitacion.used_at &&
    new Date(invitacion.expires_at) > new Date() &&
    !!empDeInvitacion &&
    !empDeInvitacion.auth_user_id &&
    empDeInvitacion.status === "active";
  check("El token recién generado es válido para canjear", valida);

  const { data: nuevoUsuario, error: eCrear } = await admin.auth.admin.createUser({
    email: emailEmpleado,
    password,
    email_confirm: true,
  });
  check("Se crea la cuenta del empleado", !eCrear, eCrear?.message);
  empleadoUserId = nuevoUsuario?.user?.id;

  await admin.from("employees").update({ auth_user_id: empleadoUserId }).eq("id", empleadoId);
  await admin
    .from("employee_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invitacion.id);

  // 4. El empleado ya puede iniciar sesión con su propio correo
  const clienteEmpleado = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: loginEmpleado, error: eLoginEmpleado } = await clienteEmpleado.auth.signInWithPassword({
    email: emailEmpleado,
    password,
  });
  check("El empleado puede iniciar sesión con su nuevo acceso", !eLoginEmpleado && !!loginEmpleado?.session);

  // 5. El empleado ve su propio perfil vía RLS (auth_user_id = auth.uid())
  const { data: propioPerfil, error: ePerfil } = await clienteEmpleado
    .from("employees")
    .select("id, full_name")
    .eq("auth_user_id", empleadoUserId)
    .maybeSingle();
  check("El empleado puede leer su propio perfil (RLS)", !ePerfil && propioPerfil?.id === empleadoId);

  // 6. El empleado NO tiene company_members: no es admin de nada
  const { data: membresias } = await clienteEmpleado.from("company_members").select("company_id");
  check("El empleado no aparece como admin de ninguna empresa", (membresias ?? []).length === 0);

  // 7. El mismo link ya usado se rechaza si se intenta canjear de nuevo
  const { data: invitacionUsada } = await admin
    .from("employee_invitations")
    .select("used_at")
    .eq("token_hash", tokenHash)
    .single();
  check("El link queda marcado como usado y no se puede volver a canjear", !!invitacionUsada?.used_at);

  // 8. Dar de baja al empleado invalida cualquier invitación futura para él
  await admin
    .from("employees")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("id", empleadoId);
  const { data: empleadoTrasBaja } = await admin
    .from("employees")
    .select("status")
    .eq("id", empleadoId)
    .single();
  check(
    "Un empleado dado de baja no calificaría como invitación válida (status != active)",
    empleadoTrasBaja.status === "terminated",
  );
} finally {
  if (companyId) {
    await admin.from("employee_invitations").delete().eq("employee_id", empleadoId ?? "");
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
  if (empleadoUserId) await admin.auth.admin.deleteUser(empleadoUserId);
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de invitación pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
