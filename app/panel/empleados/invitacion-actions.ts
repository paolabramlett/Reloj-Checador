"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { generarTokenInvitacion, hashTokenInvitacion } from "@/lib/invitacion";

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DIAS_VALIDEZ = 7;

export async function generarInvitacion(_prevState: unknown, formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return { error: "Falta identificar al empleado.", link: null };

  const token = generarTokenInvitacion();
  const tokenHash = hashTokenInvitacion(token);
  const expiresAt = new Date(Date.now() + DIAS_VALIDEZ * 24 * 60 * 60 * 1000).toISOString();

  // RLS exige que el empleado sea de una empresa del usuario autenticado;
  // regenerar invalida cualquier link anterior (upsert por employee_id).
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("employee_invitations").upsert(
    { employee_id: empleadoId, token_hash: tokenHash, expires_at: expiresAt, used_at: null },
    { onConflict: "employee_id" },
  );

  if (error) return { error: "No pudimos generar la invitación. Intenta de nuevo.", link: null };

  return { error: null, link: `${SITIO_URL}/invitacion/${token}` };
}
