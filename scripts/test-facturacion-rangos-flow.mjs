/**
 * Regresión del plan de facturación "hasta 25 empleados" (spec:
 * docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md).
 * Corre contra la base compartida (dev=prod) vía service role. Limpia
 * todo lo que crea al terminar.
 *
 * Uso: node scripts/test-facturacion-rangos-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { readFileSync } from "node:fs";
import {
  limiteDelRango,
  limiteEfectivoDeEmpleados,
  rangoDesdePriceId,
} from "../lib/facturacion.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

// rangoDesdePriceId lee process.env directo (no una constante de
// módulo), así que necesita que las variables de Stripe estén en
// process.env real, no solo en el objeto `env` de arriba.
Object.assign(process.env, env);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

console.log("--- Pruebas puras (sin red) ---");

check("limiteDelRango('hasta_10') === 10", limiteDelRango("hasta_10") === 10);
check("limiteDelRango('hasta_25') === 25", limiteDelRango("hasta_25") === 25);

check(
  "Sin tope durante el trial, sin importar el rango",
  limiteEfectivoDeEmpleados({ subscription_status: "trialing", employee_range: "hasta_10" }) === null &&
    limiteEfectivoDeEmpleados({ subscription_status: "trialing", employee_range: "hasta_25" }) === null,
);

check(
  "Tope de 10 cuando está activo en el rango hasta_10",
  limiteEfectivoDeEmpleados({ subscription_status: "active", employee_range: "hasta_10" }) === 10,
);

check(
  "Tope de 25 cuando está activo en el rango hasta_25",
  limiteEfectivoDeEmpleados({ subscription_status: "active", employee_range: "hasta_25" }) === 25,
);

check(
  "El tope sigue aplicando aunque el pago esté atrasado (past_due)",
  limiteEfectivoDeEmpleados({ subscription_status: "past_due", employee_range: "hasta_25" }) === 25,
);

check(
  "El tope sigue aplicando si la suscripción está cancelada",
  limiteEfectivoDeEmpleados({ subscription_status: "canceled", employee_range: "hasta_10" }) === 10,
);

check(
  "rangoDesdePriceId devuelve null para un price ID desconocido",
  rangoDesdePriceId("price_no_existe_123") === null,
);

check(
  "rangoDesdePriceId reconoce el price mensual actual (hasta_10)",
  rangoDesdePriceId(env.STRIPE_PRICE_MONTHLY) === "hasta_10",
);

check(
  "rangoDesdePriceId reconoce el price anual actual (hasta_10)",
  rangoDesdePriceId(env.STRIPE_PRICE_ANNUAL) === "hasta_10",
);

console.log("\n--- Prueba de esquema (requiere la Task 1 ya aplicada) ---");

let empresaPruebaId;
try {
  const { data: empresaPrueba, error: errEmpresa } = await admin
    .from("companies")
    .insert({ name: "Prueba Rango Hasta 25" })
    .select("id")
    .single();
  check("Se pudo crear la empresa de prueba", !errEmpresa && !!empresaPrueba, errEmpresa?.message);
  empresaPruebaId = empresaPrueba?.id;

  const { error: errUpdate } = await admin
    .from("companies")
    .update({ employee_range: "hasta_25" })
    .eq("id", empresaPruebaId);
  check("employee_range acepta 'hasta_25' tras la migración", !errUpdate, errUpdate?.message);

  const { error: errInvalido } = await admin
    .from("companies")
    .update({ employee_range: "hasta_100" })
    .eq("id", empresaPruebaId);
  check("employee_range SIGUE rechazando un valor no listado (hasta_100)", !!errInvalido);
} finally {
  if (empresaPruebaId) await admin.from("companies").delete().eq("id", empresaPruebaId);
}

console.log("\n--- Prueba del webhook (evento firmado real de Stripe, modo prueba) ---");

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
let empresaWebhookId;
try {
  const clienteStripe = await stripe.customers.create({ name: "Prueba Webhook Rango" });

  const { data: empresaWebhook, error: errEmpresaWebhook } = await admin
    .from("companies")
    .insert({ name: "Prueba Webhook Rango", stripe_customer_id: clienteStripe.id })
    .select("id")
    .single();
  check(
    "Se pudo crear la empresa de prueba del webhook",
    !errEmpresaWebhook && !!empresaWebhook,
    errEmpresaWebhook?.message,
  );
  empresaWebhookId = empresaWebhook?.id;

  // Evento simulado de Stripe con la forma real de un customer.subscription.updated
  // para el price mensual de hasta_25 — no requiere una suscripción real
  // en Stripe, solo un payload con la forma correcta y una firma válida.
  const payload = JSON.stringify({
    id: "evt_test_rango25",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_test_rango25",
        status: "active",
        customer: clienteStripe.id,
        items: { data: [{ price: { id: env.STRIPE_PRICE_MONTHLY_25 } }] },
      },
    },
  });

  const cabecera = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });

  const respuesta = await fetch(`${env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": cabecera },
    body: payload,
  });
  check("El webhook respondió 200", respuesta.status === 200, `status ${respuesta.status}`);

  const { data: empresaActualizada } = await admin
    .from("companies")
    .select("subscription_status, employee_range")
    .eq("id", empresaWebhookId)
    .single();
  check(
    "El webhook guardó employee_range = 'hasta_25' según el price de la suscripción",
    empresaActualizada?.employee_range === "hasta_25",
    `employee_range fue '${empresaActualizada?.employee_range}'`,
  );
  check(
    "El webhook guardó subscription_status = 'active'",
    empresaActualizada?.subscription_status === "active",
  );
} finally {
  if (empresaWebhookId) await admin.from("companies").delete().eq("id", empresaWebhookId);
}

console.log(failures === 0 ? "\nTodas las pruebas de facturación por rangos pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
