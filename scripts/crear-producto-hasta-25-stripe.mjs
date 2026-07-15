/**
 * Crea el producto y los dos precios (mensual + anual) del plan "hasta
 * 25 empleados" en Stripe, y configura el portal de cliente para
 * permitir cambiar entre los rangos hasta_10 y hasta_25. Se corre UNA
 * vez; los Price IDs resultantes se guardan en .env.local.
 *
 * Uso: node scripts/crear-producto-hasta-25-stripe.mjs
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
  name: "Chekly — hasta 25 empleados",
  description: "Registro de asistencia conforme a la LFT. Tarifa plana hasta 25 empleados.",
});

const precioMensual = await stripe.prices.create({
  product: producto.id,
  currency: "mxn",
  unit_amount: 34900, // $349.00 MXN
  recurring: { interval: "month" },
  nickname: "Mensual — hasta 25 empleados",
});

const precioAnual = await stripe.prices.create({
  product: producto.id,
  currency: "mxn",
  unit_amount: 349000, // $3,490.00 MXN = 10 meses (2 meses gratis)
  recurring: { interval: "year" },
  nickname: "Anual — hasta 25 empleados (2 meses gratis)",
});

console.log("Producto creado:", producto.id);
console.log("Precio mensual:", precioMensual.id, "($349 MXN/mes)");
console.log("Precio anual:", precioAnual.id, "($3,490 MXN/año — 2 meses gratis)");

// Reemplaza la línea si la variable ya existe (una segunda corrida
// accidental actualiza en vez de duplicar), o la agrega al final si es
// la primera vez que corre este script.
function fijarVariableEnv(contenido, nombre, valor) {
  const regex = new RegExp(`^${nombre}=.*$`, "m");
  if (regex.test(contenido)) return contenido.replace(regex, `${nombre}=${valor}`);
  return `${contenido.trimEnd()}\n${nombre}=${valor}\n`;
}

const envPath = new URL("../.env.local", import.meta.url);
let contenidoEnv = readFileSync(envPath, "utf8");
contenidoEnv = fijarVariableEnv(contenidoEnv, "STRIPE_PRICE_MONTHLY_25", precioMensual.id);
contenidoEnv = fijarVariableEnv(contenidoEnv, "STRIPE_PRICE_ANNUAL_25", precioAnual.id);
writeFileSync(envPath, contenidoEnv);
console.log("\n.env.local actualizado con los nuevos Price IDs.");

// Configura el portal de cliente ("Gestionar suscripción") para que un
// cliente pueda subir o bajar entre hasta_10 y hasta_25 sin soporte
// manual. Actualiza la configuración default si ya existe una (lo
// usual, Stripe crea una la primera vez que se usa el portal desde el
// dashboard); si no hay ninguna, crea una y la marca default.
if (!env.STRIPE_PRICE_MONTHLY || !env.STRIPE_PRICE_ANNUAL) {
  console.log(
    "\nAviso: no encontré STRIPE_PRICE_MONTHLY/STRIPE_PRICE_ANNUAL en .env.local — no configuré el portal. Revísalo a mano en el dashboard de Stripe.",
  );
} else {
  const precioMensual10 = await stripe.prices.retrieve(env.STRIPE_PRICE_MONTHLY);
  const producto10Id =
    typeof precioMensual10.product === "string" ? precioMensual10.product : precioMensual10.product.id;

  const datosPortal = {
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [
          { product: producto10Id, prices: [env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_ANNUAL] },
          { product: producto.id, prices: [precioMensual.id, precioAnual.id] },
        ],
      },
    },
  };

  const configuraciones = await stripe.billingPortal.configurations.list({ limit: 100 });
  const configDefault = configuraciones.data.find((c) => c.is_default) ?? configuraciones.data[0];

  if (configDefault) {
    await stripe.billingPortal.configurations.update(configDefault.id, datosPortal);
    console.log("Configuración del portal actualizada:", configDefault.id);
  } else {
    // Stripe exige payment_method_update.enabled si subscription_update.enabled
    // va en true en una configuración nueva (no aplica al actualizar una que
    // ya existe, por eso solo se agrega en esta rama).
    const nueva = await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Chekly" },
      features: {
        ...datosPortal.features,
        payment_method_update: { enabled: true },
      },
    });
    console.log("Configuración del portal creada:", nueva.id, "— márcala como default en el dashboard de Stripe si hace falta.");
  }
}
