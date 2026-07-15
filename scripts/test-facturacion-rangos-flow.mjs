/**
 * Regresión del plan de facturación "hasta 25 empleados" (spec:
 * docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md).
 * Corre contra la base compartida (dev=prod) vía service role. Limpia
 * todo lo que crea al terminar.
 *
 * Uso: node scripts/test-facturacion-rangos-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
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

console.log(failures === 0 ? "\nTodas las pruebas de facturación por rangos pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
