"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { crearClienteStripe } from "@/lib/stripe";

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PRECIOS: Record<string, Record<"monthly" | "annual", string>> = {
  hasta_10: {
    monthly: process.env.STRIPE_PRICE_MONTHLY!,
    annual: process.env.STRIPE_PRICE_ANNUAL!,
  },
  hasta_25: {
    monthly: process.env.STRIPE_PRICE_MONTHLY_25!,
    annual: process.env.STRIPE_PRICE_ANNUAL_25!,
  },
};

async function obtenerOCrearClienteStripe(empresaId: string): Promise<string> {
  const admin = crearClienteAdmin();
  const { data: empresa } = await admin
    .from("companies")
    .select("stripe_customer_id, name")
    .eq("id", empresaId)
    .single();

  if (!empresa) throw new Error("Empresa no encontrada.");
  if (empresa.stripe_customer_id) return empresa.stripe_customer_id;

  const stripe = crearClienteStripe();
  const cliente = await stripe.customers.create({
    name: empresa.name,
    metadata: { company_id: empresaId },
  });

  // stripe_customer_id está protegido por trigger contra escritura desde
  // sesiones de usuario — este guardado usa la service role a propósito.
  await admin.from("companies").update({ stripe_customer_id: cliente.id }).eq("id", empresaId);
  return cliente.id;
}

export async function iniciarCheckout(formData: FormData) {
  const plan = String(formData.get("plan") ?? "monthly");
  const rango = String(formData.get("rango") ?? "hasta_10");
  // Esta acción se puede invocar con un POST crudo, sin pasar por los
  // botones reales — un rango o plan fuera de estos dos valores nunca
  // debería pasar de aquí, en vez de tronar al indexar PRECIOS más abajo
  // (posiblemente después de ya haber creado un cliente real en Stripe).
  if (!PRECIOS[rango] || !(plan === "monthly" || plan === "annual")) {
    redirect("/panel/facturacion?checkout=cancelado");
  }

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const stripeCustomerId = await obtenerOCrearClienteStripe(empresa.id);
  const stripe = crearClienteStripe();

  // OXXO y SPEI no se pueden usar en mode:"subscription" — son métodos de
  // pago de una sola vez, Stripe no puede recargarlos solo cada mes como
  // a una tarjeta. Quedan pendientes para una iteración futura (requieren
  // facturación manual período a período, no auto-renovación). Por ahora,
  // solo tarjeta.
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: PRECIOS[rango][plan], quantity: 1 }],
    payment_method_types: ["card"],
    locale: "es",
    success_url: `${SITIO_URL}/panel/facturacion?checkout=exito`,
    cancel_url: `${SITIO_URL}/panel/facturacion?checkout=cancelado`,
  });

  redirect(session.url!);
}

export async function abrirPortal() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", empresa.id)
    .single();

  if (!data?.stripe_customer_id) redirect("/panel/facturacion");

  const stripe = crearClienteStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${SITIO_URL}/panel/facturacion`,
    locale: "es",
  });

  redirect(session.url);
}
