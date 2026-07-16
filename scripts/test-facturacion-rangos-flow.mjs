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
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SITIO_URL = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
let clienteStripeId;
try {
  const clienteStripe = await stripe.customers.create({ name: "Prueba Webhook Rango" });
  clienteStripeId = clienteStripe.id;

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
  // Sin esto, cada corrida deja un cliente huérfano en el modo de
  // prueba de Stripe — no afecta la facturación real, pero ensucia el
  // dashboard con el tiempo.
  if (clienteStripeId) await stripe.customers.del(clienteStripeId);
}

console.log("\n--- Prueba de integración: bloqueo real de crearEmpleado/reactivar vía HTTP ---");

// crearEmpleado y reactivar son Server Actions de Next.js, no rutas de
// API — no se invocan con un POST cualquiera. Pero un formulario ligado
// a una Server Action SIN JavaScript (progressive enhancement) sí es un
// <form> normal con campos ocultos $ACTION_* que Next.js ya renderiza
// en el HTML; reenviar esos campos en un POST multipart real invoca la
// acción de verdad, tal como lo haría un navegador. Los IDs de acción
// se leen frescos de la página en cada corrida (no están hardcodeados),
// así que esto no se rompe con cada rebuild.

function cookieDeSesion(session) {
  const cookieName = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const cookieValue = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  return `${cookieName}=${encodeURIComponent(cookieValue)}`;
}

function decodeEntidades(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function construirCuerpoMultipart(campos) {
  const boundary = "----test" + Date.now() + Math.random().toString(36).slice(2);
  const partes = Object.entries(campos)
    .map(([nombre, valor]) => `--${boundary}\r\nContent-Disposition: form-data; name="${nombre}"\r\n\r\n${valor}\r\n`)
    .join("");
  return { boundary, cuerpo: partes + `--${boundary}--\r\n` };
}

// Para acciones ligadas con useActionState (ej. crearEmpleado): el
// formulario trae $ACTION_1:0 (referencia a la función + estado inicial
// ligado) y $ACTION_KEY.
async function invocarAccionConEstado(url, cookie, camposFormulario) {
  const paginaHtml = await (await fetch(url, { headers: { cookie } })).text();
  const idMatch = paginaHtml.match(/\$ACTION_1:0" value="([^"]*)"/);
  const keyMatch = paginaHtml.match(/\$ACTION_KEY" value="([^"]*)"/);
  if (!idMatch || !keyMatch) throw new Error(`No se encontraron los campos $ACTION en ${url}`);

  const { boundary, cuerpo } = construirCuerpoMultipart({
    "$ACTION_REF_1": "",
    "$ACTION_1:0": decodeEntidades(idMatch[1]),
    "$ACTION_1:1": '[{"error":null}]',
    "$ACTION_KEY": decodeEntidades(keyMatch[1]),
    ...camposFormulario,
  });

  return fetch(url, {
    method: "POST",
    headers: { cookie, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: cuerpo,
    redirect: "manual",
  });
}

// Para acciones simples sin useActionState (ej. reactivar): el nombre
// del campo oculto ES la referencia a la acción, sin estado ligado.
async function invocarAccionSimple(url, cookie, camposFormulario) {
  const paginaHtml = await (await fetch(url, { headers: { cookie } })).text();
  const idMatch = paginaHtml.match(/\$ACTION_ID_[a-f0-9]+/);
  if (!idMatch) throw new Error(`No se encontró el campo $ACTION_ID en ${url}`);

  const { boundary, cuerpo } = construirCuerpoMultipart({
    [idMatch[0]]: "",
    ...camposFormulario,
  });

  return fetch(url, {
    method: "POST",
    headers: { cookie, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: cuerpo,
    redirect: "manual",
  });
}

async function crearEmpresaConEmpleados({ subscriptionStatus, employeeRange, numActivos, conEmpleadoDeBaja }) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `test-limite-sa-${sufijo}@example.com`;
  const password = "TestLimiteSA123!";
  const { data: authOwner } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: empresa } = await admin
    .from("companies")
    .insert({ name: `Test Límite SA ${sufijo}`, subscription_status: subscriptionStatus, employee_range: employeeRange })
    .select("id")
    .single();
  await admin.from("company_members").insert({ company_id: empresa.id, user_id: authOwner.user.id, role: "owner" });
  const { data: centro } = await admin
    .from("work_centers")
    .insert({ company_id: empresa.id, name: "Centro", lat: 19.4326, lng: -99.1332, geofence_radius_m: 100 })
    .select("id")
    .single();

  for (let i = 0; i < numActivos; i++) {
    await admin.from("employees").insert({ company_id: empresa.id, work_center_id: centro.id, full_name: `Empleado ${i}` });
  }

  let empleadoDeBajaId = null;
  if (conEmpleadoDeBaja) {
    const { data: empBaja } = await admin
      .from("employees")
      .insert({
        company_id: empresa.id,
        work_center_id: centro.id,
        full_name: "Empleado De Baja",
        status: "terminated",
        terminated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    empleadoDeBajaId = empBaja.id;
  }

  const { data: sessionData, error: errSignIn } = await anon.auth.signInWithPassword({ email, password });
  if (errSignIn) throw errSignIn;

  return {
    empresaId: empresa.id,
    authOwnerId: authOwner.user.id,
    centroId: centro.id,
    empleadoDeBajaId,
    cookie: cookieDeSesion(sessionData.session),
  };
}

async function limpiarEmpresa({ empresaId, authOwnerId }) {
  await admin.from("employees").delete().eq("company_id", empresaId);
  await admin.from("work_centers").delete().eq("company_id", empresaId);
  await admin.from("company_members").delete().eq("company_id", empresaId);
  await admin.from("companies").delete().eq("id", empresaId);
  await admin.auth.admin.deleteUser(authOwnerId);
}

let ctxBloqueo;
try {
  ctxBloqueo = await crearEmpresaConEmpleados({
    subscriptionStatus: "active",
    employeeRange: "hasta_10",
    numActivos: 10,
    conEmpleadoDeBaja: true,
  });

  const urlNuevo = `${SITIO_URL}/panel/empleados/nuevo`;
  const respuestaAlta = await invocarAccionConEstado(urlNuevo, ctxBloqueo.cookie, {
    nombre: "Empleado Numero 11",
    work_center_id: ctxBloqueo.centroId,
    pin: "",
  });
  const cuerpoAlta = await respuestaAlta.text();
  check(
    "crearEmpleado real bloquea al empleado #11 (empresa activa en el tope)",
    respuestaAlta.status === 200 && cuerpoAlta.includes("Llegaste al límite de tu plan"),
    `status ${respuestaAlta.status}`,
  );

  const { count: activosTrasIntento } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctxBloqueo.empresaId)
    .eq("status", "active");
  check("El empleado #11 NO se insertó de verdad", activosTrasIntento === 10, `activos: ${activosTrasIntento}`);

  const urlEditar = `${SITIO_URL}/panel/empleados/${ctxBloqueo.empleadoDeBajaId}`;
  const respuestaReactivar = await invocarAccionSimple(urlEditar, ctxBloqueo.cookie, {
    empleado_id: ctxBloqueo.empleadoDeBajaId,
  });
  check(
    "reactivar real bloquea al llegar al tope, con el límite en la URL",
    respuestaReactivar.status === 303 &&
      (respuestaReactivar.headers.get("location") ?? "").includes("error=limite&limite=10"),
    `status ${respuestaReactivar.status}, location ${respuestaReactivar.headers.get("location")}`,
  );

  const { data: empleadoTrasReactivar } = await admin
    .from("employees")
    .select("status")
    .eq("id", ctxBloqueo.empleadoDeBajaId)
    .single();
  check(
    "El empleado NO quedó reactivado de verdad",
    empleadoTrasReactivar?.status === "terminated",
    `status: ${empleadoTrasReactivar?.status}`,
  );
} finally {
  if (ctxBloqueo) await limpiarEmpresa(ctxBloqueo);
}

let ctxTrial;
try {
  ctxTrial = await crearEmpresaConEmpleados({
    subscriptionStatus: "trialing",
    employeeRange: "hasta_10",
    numActivos: 12,
    conEmpleadoDeBaja: false,
  });

  const urlNuevo = `${SITIO_URL}/panel/empleados/nuevo`;
  const respuestaAlta = await invocarAccionConEstado(urlNuevo, ctxTrial.cookie, {
    nombre: "Empleado Numero 13",
    work_center_id: ctxTrial.centroId,
    pin: "",
  });
  check(
    "crearEmpleado real NO bloquea en trial, aunque ya superó el tope nominal del rango",
    respuestaAlta.status === 303 && respuestaAlta.headers.get("location") === "/panel/empleados",
    `status ${respuestaAlta.status}, location ${respuestaAlta.headers.get("location")}`,
  );

  const { count: activosTrial } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctxTrial.empresaId)
    .eq("status", "active");
  check("El empleado #13 SÍ se insertó de verdad en trial", activosTrial === 13, `activos: ${activosTrial}`);
} finally {
  if (ctxTrial) await limpiarEmpresa(ctxTrial);
}

console.log(failures === 0 ? "\nTodas las pruebas de facturación por rangos pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
