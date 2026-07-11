/**
 * Prueba end-to-end del grupo 5 (modo kiosco): registro de dispositivo,
 * validación de token, verificación de PIN con bloqueo por intentos
 * fallidos, y el bucket privado de selfies con URLs firmadas.
 *
 * Uso: node scripts/test-kiosco-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// Node no resuelve imports sin extensión ("./pin") fuera de un bundler,
// así que estas dos funciones se copian tal cual de lib/kiosco.ts y
// lib/pin.ts para esta prueba — no son una reimplementación paralela,
// es exactamente el mismo código fuente.
const hashPin = (companyId, pin) => createHash("sha256").update(`${companyId}:${pin}`).digest("hex");

async function validarTokenDispositivo(admin, token) {
  const { data } = await admin
    .from("kiosk_devices")
    .select("id, company_id, work_center_id, revoked_at")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return { deviceId: data.id, companyId: data.company_id, workCenterId: data.work_center_id };
}

async function verificarPinConBloqueo(admin, employeeId, companyId, pinIngresado, pinHashEsperado, umbralIntentos, minutosBloqueo) {
  const { data: lockout } = await admin
    .from("pin_lockouts")
    .select("intentos_fallidos, bloqueado_hasta")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (lockout?.bloqueado_hasta && new Date(lockout.bloqueado_hasta) > new Date()) {
    return { ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
  }

  if (!pinHashEsperado || hashPin(companyId, pinIngresado) !== pinHashEsperado) {
    const nuevosIntentos = (lockout?.intentos_fallidos ?? 0) + 1;
    const alcanzaUmbral = nuevosIntentos >= umbralIntentos;
    await admin.from("pin_lockouts").upsert({
      employee_id: employeeId,
      intentos_fallidos: alcanzaUmbral ? 0 : nuevosIntentos,
      bloqueado_hasta: alcanzaUmbral ? new Date(Date.now() + minutosBloqueo * 60_000).toISOString() : null,
    });
    return { ok: false, error: alcanzaUmbral ? "Demasiados intentos. Espera unos minutos e intenta de nuevo." : "PIN incorrecto." };
  }

  await admin.from("pin_lockouts").upsert({ employee_id: employeeId, intentos_fallidos: 0, bloqueado_hasta: null });
  return { ok: true };
}

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
const emailAdmin = `kiosco-admin-${stamp}@mailinator.com`;
const emailOtro = `kiosco-otro-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let userAdminId, userOtroId, companyId, workCenterId, empleadoId, kioscoId, kioscoToken;

try {
  const { data: uAdmin } = await admin.auth.admin.createUser({ email: emailAdmin, password, email_confirm: true });
  userAdminId = uAdmin.user.id;
  const clienteAdmin = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteAdmin.auth.signInWithPassword({ email: emailAdmin, password });

  const { data: idEmpresa } = await clienteAdmin.rpc("create_company_with_owner", { company_name: "Empresa Kiosco" });
  companyId = idEmpresa;

  const { data: centro } = await clienteAdmin
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;

  const pinCorrecto = "4321";
  const { data: emp } = await clienteAdmin
    .from("employees")
    .insert({
      company_id: companyId,
      work_center_id: workCenterId,
      full_name: "Empleado Kiosco",
      pin_hash: hashPin(companyId, pinCorrecto),
    })
    .select()
    .single();
  empleadoId = emp.id;

  // 1. Admin registra un kiosco — mismo patrón que registrarKiosco()
  kioscoToken = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(kioscoToken).digest("hex");
  const { data: kiosco, error: eKiosco } = await clienteAdmin
    .from("kiosk_devices")
    .insert({ company_id: companyId, work_center_id: workCenterId, name: "Tablet Prueba", token_hash: tokenHash })
    .select()
    .single();
  check("Admin registra un kiosco", !eKiosco, eKiosco?.message);
  kioscoId = kiosco?.id;

  // 2. validarTokenDispositivo: token válido resuelve al dispositivo correcto
  const dispositivo = await validarTokenDispositivo(admin, kioscoToken);
  check(
    "El token del kiosco valida y resuelve la empresa/centro correctos",
    dispositivo?.companyId === companyId && dispositivo?.workCenterId === workCenterId,
  );

  // 3. Token inventado no valida
  const dispositivoFalso = await validarTokenDispositivo(admin, "token-que-no-existe");
  check("Un token inventado no valida", dispositivoFalso === null);

  // 4. PIN incorrecto es rechazado, sin revelar el correcto
  const rIncorrecto = await verificarPinConBloqueo(admin, empleadoId, companyId, "0000", emp.pin_hash, 5, 5);
  check("PIN incorrecto es rechazado", rIncorrecto.ok === false);

  // 5. PIN correcto funciona
  const rCorrecto = await verificarPinConBloqueo(admin, empleadoId, companyId, pinCorrecto, emp.pin_hash, 5, 5);
  check("PIN correcto es aceptado", rCorrecto.ok === true);

  // 6. Tras 5 intentos fallidos consecutivos, queda bloqueado aunque el PIN sea correcto
  for (let i = 0; i < 5; i++) {
    await verificarPinConBloqueo(admin, empleadoId, companyId, "9999", emp.pin_hash, 5, 5);
  }
  const rBloqueado = await verificarPinConBloqueo(admin, empleadoId, companyId, pinCorrecto, emp.pin_hash, 5, 5);
  check(
    "Tras 5 intentos fallidos, el PIN correcto también es rechazado (bloqueado)",
    rBloqueado.ok === false && rBloqueado.error?.includes("Demasiados intentos"),
  );

  // Desbloqueo manual (simula que pasó el tiempo) y confirmar que vuelve a andar
  await admin.from("pin_lockouts").update({ bloqueado_hasta: null, intentos_fallidos: 0 }).eq("employee_id", empleadoId);
  const rTrasDesbloqueo = await verificarPinConBloqueo(admin, empleadoId, companyId, pinCorrecto, emp.pin_hash, 5, 5);
  check("Tras el desbloqueo, el PIN correcto vuelve a funcionar", rTrasDesbloqueo.ok === true);

  // 7. Revocar el kiosco: el token deja de validar
  await clienteAdmin.from("kiosk_devices").update({ revoked_at: new Date().toISOString() }).eq("id", kioscoId);
  const dispositivoRevocado = await validarTokenDispositivo(admin, kioscoToken);
  check("Un kiosco revocado ya no valida", dispositivoRevocado === null);

  // 8. Storage de selfies: subir con service role, leer con admin de la empresa
  const rutaSelfie = `${companyId}/prueba.jpg`;
  const bufferFalso = Buffer.from("contenido-de-prueba");
  const { error: eSubida } = await admin.storage.from("selfies").upload(rutaSelfie, bufferFalso, {
    contentType: "image/jpeg",
  });
  check("Subir una selfie con service role funciona", !eSubida, eSubida?.message);

  const { data: urlFirmada, error: eFirma } = await clienteAdmin.storage
    .from("selfies")
    .createSignedUrl(rutaSelfie, 60);
  check("El admin de la empresa puede generar una URL firmada", !eFirma && !!urlFirmada?.signedUrl, eFirma?.message);

  // 9. Un admin de OTRA empresa no puede generar URL firmada para esta selfie
  const { data: uOtro } = await admin.auth.admin.createUser({ email: emailOtro, password, email_confirm: true });
  userOtroId = uOtro.user.id;
  const clienteOtro = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteOtro.auth.signInWithPassword({ email: emailOtro, password });
  await clienteOtro.rpc("create_company_with_owner", { company_name: "Otra Empresa Kiosco" });

  const { error: eFirmaAjena } = await clienteOtro.storage.from("selfies").createSignedUrl(rutaSelfie, 60);
  check("Un admin de otra empresa NO puede generar URL firmada para esta selfie", !!eFirmaAjena);

  await admin.storage.from("selfies").remove([rutaSelfie]);
} finally {
  if (companyId) {
    await admin.from("kiosk_devices").delete().eq("company_id", companyId);
    await admin.from("pin_lockouts").delete().eq("employee_id", empleadoId ?? "");
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  // limpia también la empresa del admin ajeno
  const { data: otroMembership } = await admin.from("company_members").select("company_id").eq("user_id", userOtroId ?? "").maybeSingle();
  if (otroMembership) {
    await admin.from("company_members").delete().eq("company_id", otroMembership.company_id);
    await admin.from("companies").delete().eq("id", otroMembership.company_id);
  }
  for (const id of [userAdminId, userOtroId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de kiosco pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
