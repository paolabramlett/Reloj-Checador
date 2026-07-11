import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPin } from "./pin";

export function generarTokenKiosco(): string {
  return randomBytes(24).toString("base64url");
}

export function hashTokenKiosco(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface ResultadoVerificacionPin {
  ok: boolean;
  error?: string;
}

interface DispositivoValidado {
  deviceId: string;
  companyId: string;
  workCenterId: string;
}

/** El kiosco no tiene sesión: esta función ES la autenticación del dispositivo. */
export async function validarTokenDispositivo(
  admin: SupabaseClient,
  token: string,
): Promise<DispositivoValidado | null> {
  const { data } = await admin
    .from("kiosk_devices")
    .select("id, company_id, work_center_id, revoked_at")
    .eq("token_hash", hashTokenKiosco(token))
    .maybeSingle();

  if (!data || data.revoked_at) return null;
  return { deviceId: data.id, companyId: data.company_id, workCenterId: data.work_center_id };
}

/**
 * Verifica el PIN de un empleado contra su hash, con bloqueo temporal
 * tras N intentos fallidos consecutivos (spec time-clock, "PIN incorrecto").
 * Usa el cliente de service role: el kiosco no tiene sesión propia, así
 * que no hay RLS que aplicar acá — esta función ES el control de acceso.
 */
export async function verificarPinConBloqueo(
  admin: SupabaseClient,
  employeeId: string,
  companyId: string,
  pinIngresado: string,
  pinHashEsperado: string | null,
  umbralIntentos: number,
  minutosBloqueo: number,
): Promise<ResultadoVerificacionPin> {
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
      bloqueado_hasta: alcanzaUmbral
        ? new Date(Date.now() + minutosBloqueo * 60_000).toISOString()
        : null,
    });
    return {
      ok: false,
      error: alcanzaUmbral
        ? "Demasiados intentos. Espera unos minutos e intenta de nuevo."
        : "PIN incorrecto.",
    };
  }

  await admin
    .from("pin_lockouts")
    .upsert({ employee_id: employeeId, intentos_fallidos: 0, bloqueado_hasta: null });
  return { ok: true };
}
