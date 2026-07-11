import Stripe from "stripe";

let cliente: Stripe | null = null;

export function crearClienteStripe(): Stripe {
  if (!cliente) {
    cliente = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return cliente;
}
