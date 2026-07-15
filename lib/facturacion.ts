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

/**
 * Cuenta empleados activos de una empresa y compara contra su tope
 * efectivo (spec: docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md,
 * decisión 6). Único lugar donde vive esta lógica — tanto el bloqueo
 * duro al dar de alta/reactivar un empleado (`app/panel/empleados/actions.ts`)
 * como el aviso informativo del panel (`app/panel/page.tsx`) llaman a
 * esta misma función, para que nunca puedan discrepar entre sí sobre
 * si una empresa ya llegó a su tope.
 */
export async function limiteDeEmpleadosAlcanzado(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ alcanzado: boolean; limite: number | null }> {
  const { data: empresa } = await supabase
    .from("companies")
    .select("subscription_status, employee_range")
    .eq("id", companyId)
    .single();

  if (!empresa) return { alcanzado: false, limite: null };

  const limite = limiteEfectivoDeEmpleados(empresa);
  if (limite === null) return { alcanzado: false, limite: null };

  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active");

  return { alcanzado: (count ?? 0) >= limite, limite };
}

/**
 * Traduce el price ID de una suscripción de Stripe al rango de
 * facturación correspondiente — lo usa el webhook para mantener
 * companies.employee_range sincronizado con lo que realmente se pagó.
 * null si el price ID no coincide con ninguno conocido (evento de
 * prueba, producto viejo, una de las variables STRIPE_PRICE_* todavía
 * sin configurar, etc.) — en ese caso el webhook no toca employee_range.
 * Lee process.env en cada llamada, no en una constante a nivel de
 * módulo: así un env var ausente (undefined) nunca puede coincidir por
 * accidente con un priceId vacío, y quien importe este archivo no
 * depende de en qué momento exacto se pobló process.env.
 */
export function rangoDesdePriceId(priceId: string): string | null {
  const priceIdsPorRango: Record<string, (string | undefined)[]> = {
    hasta_10: [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL],
    hasta_25: [process.env.STRIPE_PRICE_MONTHLY_25, process.env.STRIPE_PRICE_ANNUAL_25],
  };
  for (const [rango, priceIds] of Object.entries(priceIdsPorRango)) {
    if (priceIds.includes(priceId)) return rango;
  }
  return null;
}
