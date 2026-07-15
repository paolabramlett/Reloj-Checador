import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { crearClienteStripe } from "@/lib/stripe";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { rangoDesdePriceId } from "@/lib/facturacion";

// Estados de Stripe -> los 4 valores que maneja companies.subscription_status.
function mapearEstado(estadoStripe: Stripe.Subscription.Status): "trialing" | "active" | "past_due" | "canceled" {
  if (estadoStripe === "trialing") return "trialing";
  if (estadoStripe === "active") return "active";
  if (estadoStripe === "canceled") return "canceled";
  // incomplete, incomplete_expired, unpaid, paused: todos se tratan como
  // "no está al día" para efectos del bloqueo suave.
  return "past_due";
}

async function actualizarPorSuscripcion(subscription: Stripe.Subscription) {
  const admin = crearClienteAdmin();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const cambios: Record<string, unknown> = {
    subscription_status: mapearEstado(subscription.status),
    stripe_subscription_id: subscription.id,
  };

  // Se asume un solo price por suscripción — cierto hoy porque
  // iniciarCheckout (app/panel/facturacion/actions.ts) arma sesiones de
  // Checkout con un único line_item; si algún día una suscripción llega
  // a tener más de uno, esto seguiría mirando solo el primero.
  const priceId = subscription.items.data[0]?.price?.id;
  const rango = priceId ? rangoDesdePriceId(priceId) : null;
  if (rango) {
    cambios.employee_range = rango;
  } else {
    // Si el price ID no coincide con ningún rango conocido (evento de
    // prueba, producto viejo, un price rotado en Stripe sin actualizar
    // los STRIPE_PRICE_* en el entorno, etc.), no tocamos employee_range
    // — se queda con lo que ya tenía. Se deja registro porque esto
    // podría ser un cliente real pagando por un rango que el código ya
    // no reconoce, no solo un evento de prueba inofensivo.
    console.warn(`Webhook de Stripe: price ID '${priceId}' no coincide con ningún rango conocido.`);
  }

  await admin.from("companies").update(cambios).eq("stripe_customer_id", customerId);
}

export async function POST(request: Request) {
  const firma = request.headers.get("stripe-signature");
  const cuerpo = await request.text();

  if (!firma) {
    return NextResponse.json({ error: "Falta la firma." }, { status: 400 });
  }

  const stripe = crearClienteStripe();
  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  switch (evento.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await actualizarPorSuscripcion(evento.data.object as Stripe.Subscription);
      break;
    default:
      // Otros eventos (pagos individuales, facturas, etc.) no cambian el
      // estado de la suscripción — se ignoran a propósito.
      break;
  }

  return NextResponse.json({ received: true });
}
