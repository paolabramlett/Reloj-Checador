import type { SupabaseClient } from "@supabase/supabase-js";

export interface EstadoFacturacion {
  subscription_status: "trialing" | "active" | "past_due" | "canceled";
  trial_ends_at: string;
}

export async function obtenerAccesoAdmin(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("companies")
    .select("subscription_status, trial_ends_at")
    .eq("id", companyId)
    .single();
  return data ? tieneAccesoAdmin(data) : false;
}

const LIMITE_RANGO: Record<string, number> = {
  hasta_10: 10,
};

/**
 * Tableros y reportes exigen suscripción vigente o trial (spec billing,
 * "Bloqueo suave"). El fichaje y su ingesta NUNCA pasan por acá — ese
 * guard no se aplica ni a /api/fichar ni a /api/kiosco/*.
 */
export function tieneAccesoAdmin(empresa: EstadoFacturacion): boolean {
  if (empresa.subscription_status === "active") return true;
  if (empresa.subscription_status === "trialing") {
    return new Date(empresa.trial_ends_at) > new Date();
  }
  return false;
}

export function diasDeTrialRestantes(trialEndsAt: string): number {
  const restante = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(restante / (24 * 60 * 60 * 1000)));
}

export function limiteDelRango(rango: string): number {
  return LIMITE_RANGO[rango] ?? 10;
}
