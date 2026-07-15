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
  hasta_25: 25,
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

/**
 * Tope real de empleados activos que puede tener una empresa ahora
 * mismo: null = sin tope (spec, decisión 5 — durante el trial se puede
 * probar con el equipo real completo, sin importar el tamaño). Fuera
 * del trial (activo, atrasado o cancelado) aplica el tope del rango
 * contratado — el tope de empleados no se levanta solo porque el pago
 * esté atrasado.
 */
export function limiteEfectivoDeEmpleados(empresa: {
  subscription_status: string;
  employee_range: string;
}): number | null {
  if (empresa.subscription_status === "trialing") return null;
  return limiteDelRango(empresa.employee_range);
}

const PRICE_IDS_POR_RANGO: Record<string, string[]> = {
  hasta_10: [process.env.STRIPE_PRICE_MONTHLY ?? "", process.env.STRIPE_PRICE_ANNUAL ?? ""],
  hasta_25: [process.env.STRIPE_PRICE_MONTHLY_25 ?? "", process.env.STRIPE_PRICE_ANNUAL_25 ?? ""],
};

/**
 * Traduce el price ID de una suscripción de Stripe al rango de
 * facturación correspondiente — lo usa el webhook para mantener
 * companies.employee_range sincronizado con lo que realmente se pagó.
 * null si el price ID no coincide con ninguno conocido (evento de
 * prueba, producto viejo, etc.) — en ese caso el webhook no toca
 * employee_range.
 */
export function rangoDesdePriceId(priceId: string): string | null {
  for (const [rango, priceIds] of Object.entries(PRICE_IDS_POR_RANGO)) {
    if (priceIds.includes(priceId)) return rango;
  }
  return null;
}
