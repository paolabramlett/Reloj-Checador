/**
 * Crea el producto y los dos precios (mensual + anual) del plan "hasta 10
 * empleados" en Stripe. Se corre UNA vez; los Price IDs resultantes se
 * guardan en .env.local para que el checkout los use.
 *
 * Uso: node scripts/crear-productos-stripe.mjs
 */
import Stripe from "stripe";
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const producto = await stripe.products.create({
  name: "Reloj Checador — hasta 10 empleados",
  description: "Registro de asistencia conforme a la LFT. Tarifa plana hasta 10 empleados.",
});

const precioMensual = await stripe.prices.create({
  product: producto.id,
  currency: "mxn",
  unit_amount: 17900, // $179.00 MXN
  recurring: { interval: "month" },
  nickname: "Mensual — hasta 10 empleados",
});

const precioAnual = await stripe.prices.create({
  product: producto.id,
  currency: "mxn",
  unit_amount: 179000, // $1,790.00 MXN = 10 meses (2 meses gratis)
  recurring: { interval: "year" },
  nickname: "Anual — hasta 10 empleados (2 meses gratis)",
});

console.log("Producto creado:", producto.id);
console.log("Precio mensual:", precioMensual.id, "($179 MXN/mes)");
console.log("Precio anual:", precioAnual.id, "($1,790 MXN/año — 2 meses gratis)");

const envPath = new URL("../.env.local", import.meta.url);
let contenido = readFileSync(envPath, "utf8");
contenido = contenido.replace(/STRIPE_PRICE_MONTHLY=.*/, `STRIPE_PRICE_MONTHLY=${precioMensual.id}`);
contenido = contenido.replace(/STRIPE_PRICE_ANNUAL=.*/, `STRIPE_PRICE_ANNUAL=${precioAnual.id}`);
writeFileSync(envPath, contenido);
console.log("\n.env.local actualizado con los Price IDs.");
