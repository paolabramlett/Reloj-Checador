# Plan de facturación "hasta 25 empleados" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un segundo rango de facturación ("hasta 25 empleados", $349 MXN/mes o $3,490 MXN/año) con enforcement técnico real (bloqueo duro al llegar al tope, sin tope durante el trial), reemplazando el aviso cosmético que existe hoy.

**Architecture:** La columna `companies.employee_range` ya existe (default `'hasta_10'`, protegida por trigger contra escritura desde sesión de usuario) — se amplía su `check` constraint para aceptar también `'hasta_25'`. El webhook de Stripe (que hoy solo actualiza `subscription_status`) se extiende para también determinar y guardar `employee_range` según el price ID de la suscripción. `lib/facturacion.ts` gana un helper de "límite efectivo" (null durante trial, el tope del rango en cualquier otro estado) que consumen tanto el alta/reactivación de empleados (bloqueo duro) como el banner informativo del panel. La página de Facturación pasa de mostrar un plan a mostrar los dos rangos siempre.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Supabase (Postgres + RLS), Stripe (Checkout + Billing Portal + Webhooks), TypeScript.

---

### Task 1: Migración SQL — ampliar `employee_range` para aceptar `'hasta_25'`

**Files:**
- Create: `supabase/migrations/20260714110000_ampliar_employee_range.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260714110000_ampliar_employee_range.sql`:

```sql
-- Amplía el rango de facturación disponible para incluir "hasta_25"
-- (spec: docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md).
-- La columna employee_range ya existía desde la migración de
-- facturación original, pensada justo para este momento (ver comentario
-- en 20260711120000_facturacion.sql: "la columna ya existe para cuando
-- haya más de uno").
--
-- "drop constraint if exists" + recrear hace esta migración segura de
-- re-correr: si ya se aplicó a mano contra la base compartida durante
-- el desarrollo, un segundo "supabase db push" en CI no falla.
alter table public.companies drop constraint if exists companies_employee_range_check;
alter table public.companies
  add constraint companies_employee_range_check
  check (employee_range in ('hasta_10', 'hasta_25'));
```

- [ ] **Step 2: Aplicar la migración contra la base compartida (dev=prod) y verificar**

No hay sesión de `supabase login` disponible en este entorno, así que se aplica igual que las migraciones anteriores de este proyecto: con una conexión directa vía `pg`, usando `SUPABASE_DB_URL` de `.env.local`.

```bash
npm install --no-save pg
```

Crear un script temporal `check-migracion.mjs` (se borra al final de este paso, no se comitea):

```js
import pg from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await client.connect();

const sql = readFileSync(
  new URL("./supabase/migrations/20260714110000_ampliar_employee_range.sql", import.meta.url),
  "utf8",
);
await client.query(sql);
console.log("Migración aplicada.");

const res = await client.query(`
  select pg_get_constraintdef(oid) as def
  from pg_constraint
  where conrelid = 'public.companies'::regclass and conname = 'companies_employee_range_check'
`);
console.log("Constraint actual:", res.rows[0]?.def);

await client.end();
```

Run: `node check-migracion.mjs`
Expected: imprime "Migración aplicada." y luego `Constraint actual: CHECK ((employee_range = ANY (ARRAY['hasta_10'::text, 'hasta_25'::text])))` (el orden exacto del texto puede variar levemente, lo importante es que incluya ambos valores).

- [ ] **Step 3: Limpiar**

```bash
rm check-migracion.mjs
npm uninstall pg
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714110000_ampliar_employee_range.sql
git commit -m "$(cat <<'EOF'
Ampliar employee_range para aceptar el rango hasta_25

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Límites y helpers en `lib/facturacion.ts`

**Files:**
- Modify: `lib/facturacion.ts`
- Create: `scripts/test-facturacion-rangos-flow.mjs`

- [ ] **Step 1: Escribir el test primero (falla porque los helpers todavía no existen)**

Crear `scripts/test-facturacion-rangos-flow.mjs`:

```js
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
```

- [ ] **Step 2: Correr el test y confirmar que falla por los imports faltantes**

Run: `node scripts/test-facturacion-rangos-flow.mjs`
Expected: falla al cargar el módulo, con un error tipo `SyntaxError` o `does not provide an export named 'limiteEfectivoDeEmpleados'` (todavía no existen esos exports en `lib/facturacion.ts`).

- [ ] **Step 3: Implementar los cambios en `lib/facturacion.ts`**

Reemplazar el contenido completo de `lib/facturacion.ts` por:

```ts
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
```

- [ ] **Step 4: Correr el test de nuevo**

Run: `node scripts/test-facturacion-rangos-flow.mjs`
Expected: `Todas las pruebas de facturación por rangos pasan.` con exit code 0. (Si la Task 1 no se aplicó todavía contra la base compartida, la sección "Prueba de esquema" falla — confirmar que la Task 1 ya corrió).

- [ ] **Step 5: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/facturacion.ts scripts/test-facturacion-rangos-flow.mjs
git commit -m "$(cat <<'EOF'
Agregar límite del rango hasta_25 y helpers de enforcement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Bloqueo duro al agregar o reactivar empleados

**Files:**
- Modify: `app/panel/empleados/actions.ts`
- Modify: `app/panel/empleados/[id]/page.tsx`

- [ ] **Step 1: Modificar `app/panel/empleados/actions.ts`**

Reemplazar el contenido completo por:

```ts
"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { hashPin, PIN_REGEX } from "@/lib/pin";
import { limiteEfectivoDeEmpleados } from "@/lib/facturacion";

type CamposEmpleado =
  | { ok: false; error: string }
  | { ok: true; nombre: string; workCenterId: string; pin: string | null };

function leerCampos(formData: FormData): CamposEmpleado {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const workCenterId = String(formData.get("work_center_id") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!nombre) return { ok: false, error: "Escribe el nombre del empleado." };
  if (!workCenterId) return { ok: false, error: "Elige a qué centro de trabajo pertenece." };
  if (pin && !PIN_REGEX.test(pin)) {
    return { ok: false, error: "El PIN debe ser de 4 dígitos." };
  }

  return { ok: true, nombre, workCenterId, pin: pin || null };
}

// Los códigos 23505 (PIN duplicado en la empresa) y 23503 (centro de
// trabajo de otra empresa, imposible de todos modos por RLS) son los
// únicos que puede disparar esta tabla; cualquier otro es un error genérico.
function mensajeDeErrorDb(error: { code?: string }): string {
  if (error.code === "23505") return "Ese PIN ya lo tiene otro empleado. Elige otro.";
  return "No pudimos guardar. Intenta de nuevo.";
}

type ClienteServidor = Awaited<ReturnType<typeof crearClienteServidor>>;

// Cuenta empleados activos y compara contra el tope efectivo del rango
// contratado (spec: docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md,
// decisión 6 — bloqueo duro sobre altas nuevas, nunca sobre el fichaje).
async function limiteAlcanzado(
  supabase: ClienteServidor,
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

export async function crearEmpleado(_prevState: unknown, formData: FormData) {
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const supabase = await crearClienteServidor();

  const { alcanzado, limite } = await limiteAlcanzado(supabase, empresa.id);
  if (alcanzado) {
    return {
      error: `Llegaste al límite de tu plan (${limite} empleados). Sube de plan en Facturación para agregar más.`,
    };
  }

  const { error } = await supabase.from("employees").insert({
    company_id: empresa.id,
    work_center_id: campos.workCenterId,
    full_name: campos.nombre,
    pin_hash: campos.pin ? hashPin(empresa.id, campos.pin) : null,
  });

  if (error) return { error: mensajeDeErrorDb(error) };

  redirect("/panel/empleados");
}

export async function actualizarEmpleado(_prevState: unknown, formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };
  if (!empleadoId) return { error: "Falta identificar al empleado." };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const cambios: Record<string, unknown> = {
    full_name: campos.nombre,
    work_center_id: campos.workCenterId,
  };
  // Blanco = no tocar el PIN existente; "quitar PIN" es una acción aparte.
  if (campos.pin) cambios.pin_hash = hashPin(empresa.id, campos.pin);

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("employees").update(cambios).eq("id", empleadoId);

  if (error) return { error: mensajeDeErrorDb(error) };

  redirect("/panel/empleados");
}

export async function quitarPin(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const supabase = await crearClienteServidor();
  await supabase.from("employees").update({ pin_hash: null }).eq("id", empleadoId);
  redirect(`/panel/empleados/${empleadoId}`);
}

export async function darDeBaja(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const supabase = await crearClienteServidor();
  await supabase
    .from("employees")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("id", empleadoId);

  redirect("/panel/empleados");
}

export async function reactivar(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return;

  const supabase = await crearClienteServidor();

  const { alcanzado } = await limiteAlcanzado(supabase, empresa.id);
  if (alcanzado) {
    redirect(`/panel/empleados/${empleadoId}?error=limite`);
  }

  await supabase
    .from("employees")
    .update({ status: "active", terminated_at: null })
    .eq("id", empleadoId);

  redirect("/panel/empleados");
}
```

- [ ] **Step 2: Mostrar el error de `reactivar` en la página de detalle**

En `app/panel/empleados/[id]/page.tsx`, reemplazar:

```tsx
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { FormularioEmpleado } from "@/components/formulario-empleado";
import { AccionConfirmable } from "@/components/accion-confirmable";
import { GeneradorInvitacion } from "@/components/generador-invitacion";
import { actualizarEmpleado, darDeBaja, quitarPin, reactivar } from "../actions";

export default async function PaginaEditarEmpleado({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
```

con:

```tsx
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { FormularioEmpleado } from "@/components/formulario-empleado";
import { AccionConfirmable } from "@/components/accion-confirmable";
import { GeneradorInvitacion } from "@/components/generador-invitacion";
import { Mensaje } from "@/components/ui/mensaje";
import { actualizarEmpleado, darDeBaja, quitarPin, reactivar } from "../actions";

export default async function PaginaEditarEmpleado({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
```

Y, dentro del `return`, justo después de `<main ...>` (antes del bloque `{deBaja && (...)}`), agregar:

```tsx
      {error === "limite" && (
        <Mensaje tono="error">
          No pudimos reactivar: ya llegaste al límite de tu plan. Sube de plan en Facturación para
          agregar más empleados.
        </Mensaje>
      )}

```

- [ ] **Step 3: Verificación manual en el navegador**

Con el dev server corriendo (`npm run dev`):
1. Vía service role, crear una empresa de prueba con `subscription_status = 'active'` y `employee_range = 'hasta_10'`, y 10 empleados activos.
2. Loguear como el owner de esa empresa, ir a `/panel/empleados/nuevo`, intentar agregar un empleado #11.
3. Confirmar que se muestra el mensaje "Llegaste al límite de tu plan (10 empleados)..." y que NO se insertó el empleado.
4. Dar de baja a uno de los 10 (queda en 9 activos), confirmar que ahora SÍ se puede agregar uno nuevo.
5. Volver a llegar a 10 activos, dar de baja a uno más (9 activos) y luego intentar reactivar a un empleado YA dado de baja distinto (llevaría a 10, dentro del tope) — confirmar que sí funciona. Luego, estando en 10 activos otra vez, intentar reactivar a otro empleado dado de baja (llevaría a 11) — confirmar que redirige con `?error=limite` y se ve el mensaje.
6. Confirmar que una empresa con `subscription_status = 'trialing'` puede agregar más de 10 empleados sin bloqueo.
7. Borrar toda la data de prueba (empresa, empleados, work center, company_member, auth user) al terminar.

- [ ] **Step 4: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/panel/empleados/actions.ts app/panel/empleados/[id]/page.tsx
git commit -m "$(cat <<'EOF'
Bloquear alta y reactivación de empleados al llegar al tope del rango

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Actualizar el banner de `/panel`

**Files:**
- Modify: `app/panel/page.tsx`

- [ ] **Step 1: Usar el límite efectivo (respeta el trial) y disparar al llegar, no solo al exceder**

Reemplazar:

```tsx
import { limiteDelRango } from "@/lib/facturacion";
```

con:

```tsx
import { limiteEfectivoDeEmpleados } from "@/lib/facturacion";
```

Reemplazar:

```tsx
  const [{ data: centros }, { count: empleadosActivos }, { data: empresaConRango }] = await Promise.all([
    supabase
      .from("work_centers")
      .select("id, name, geofence_radius_m")
      .eq("company_id", empresaActiva.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", empresaActiva.id)
      .eq("status", "active"),
    supabase.from("companies").select("employee_range").eq("id", empresaActiva.id).single(),
  ]);

  const limiteRango = limiteDelRango(empresaConRango?.employee_range ?? "hasta_10");
  const excedeRango = (empleadosActivos ?? 0) > limiteRango;
```

con:

```tsx
  const [{ data: centros }, { count: empleadosActivos }, { data: empresaConRango }] = await Promise.all([
    supabase
      .from("work_centers")
      .select("id, name, geofence_radius_m")
      .eq("company_id", empresaActiva.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", empresaActiva.id)
      .eq("status", "active"),
    supabase
      .from("companies")
      .select("subscription_status, employee_range")
      .eq("id", empresaActiva.id)
      .single(),
  ]);

  // null = sin tope (trial) — durante el trial este aviso no aplica,
  // igual que el bloqueo real de altas no aplica (spec, decisión 5).
  const limiteRango = empresaConRango ? limiteEfectivoDeEmpleados(empresaConRango) : null;
  const excedeRango = limiteRango !== null && (empleadosActivos ?? 0) >= limiteRango;
```

Reemplazar:

```tsx
      {excedeRango && (
        <Mensaje tono="error">
          Tienes {empleadosActivos} empleados activos — tu plan actual es hasta {limiteRango}. Los
          nuevos altas siguen funcionando; contáctanos para ampliar tu rango.
        </Mensaje>
      )}
```

con:

```tsx
      {excedeRango && (
        <Mensaje tono="error">
          Llegaste a tu límite de {limiteRango} empleados activos. Para agregar más, sube tu plan
          en Facturación.
        </Mensaje>
      )}
```

- [ ] **Step 2: Verificación manual**

Con el dev server corriendo: una empresa de prueba `active`/`hasta_10` con exactamente 10 empleados activos debe mostrar el banner en `/panel` con el nuevo texto; una en trial con 15 empleados NO debe mostrar ningún banner.

- [ ] **Step 3: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/panel/page.tsx
git commit -m "$(cat <<'EOF'
Actualizar el aviso de límite de empleados: ya no es solo informativo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Producto y precios "hasta 25" en Stripe + portal de cliente

**Files:**
- Create: `scripts/crear-producto-hasta-25-stripe.mjs`

- [ ] **Step 1: Escribir el script**

Crear `scripts/crear-producto-hasta-25-stripe.mjs`:

```js
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

const envPath = new URL("../.env.local", import.meta.url);
const contenidoActual = readFileSync(envPath, "utf8");
const contenidoNuevo =
  contenidoActual.trimEnd() +
  `\nSTRIPE_PRICE_MONTHLY_25=${precioMensual.id}\nSTRIPE_PRICE_ANNUAL_25=${precioAnual.id}\n`;
writeFileSync(envPath, contenidoNuevo);
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
    const nueva = await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Chekly" },
      ...datosPortal,
    });
    console.log("Configuración del portal creada:", nueva.id, "— márcala como default en el dashboard de Stripe si hace falta.");
  }
}
```

- [ ] **Step 2: Confirmar que la cuenta de Stripe está en modo de prueba antes de correr**

Run: `node -e "const k=require('fs').readFileSync('.env.local','utf8').match(/STRIPE_SECRET_KEY=(\S+)/)[1]; console.log(k.startsWith('sk_test_') ? 'TEST MODE' : k.startsWith('sk_live_') ? 'LIVE MODE — cuidado' : 'DESCONOCIDO')"`
Expected: `TEST MODE`. Si dice `LIVE MODE`, avisar antes de continuar — crear un producto/precio real en modo live no cobra a nadie por sí solo, pero conviene confirmarlo con Paola antes de tocar la cuenta real.

- [ ] **Step 3: Correr el script**

Run: `node scripts/crear-producto-hasta-25-stripe.mjs`
Expected: imprime el ID del producto, ambos price IDs, confirma que `.env.local` se actualizó, y confirma que el portal quedó configurado (actualizado o creado).

- [ ] **Step 4: Verificación manual en el dashboard de Stripe (modo prueba)**

Entrar a el dashboard de Stripe (test mode) → Products, confirmar que "Chekly — hasta 25 empleados" existe con sus dos precios. Entrar a Settings → Billing → Customer portal, confirmar que la configuración activa permite "Update subscription" con ambos productos (hasta_10 y hasta_25) listados.

- [ ] **Step 5: Commit**

```bash
git add scripts/crear-producto-hasta-25-stripe.mjs
git commit -m "$(cat <<'EOF'
Agregar script para crear el producto Stripe del rango hasta_25

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(`.env.local` no se comitea — está en `.gitignore` — pero anotar en el siguiente paso del plan de despliegue que hay que replicar `STRIPE_PRICE_MONTHLY_25`/`STRIPE_PRICE_ANNUAL_25` en las variables de entorno de Vercel producción.)

---

### Task 6: El webhook guarda `employee_range` según el price contratado

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Modify: `scripts/test-facturacion-rangos-flow.mjs`

- [ ] **Step 1: Modificar el webhook**

Reemplazar:

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { crearClienteStripe } from "@/lib/stripe";
import { crearClienteAdmin } from "@/lib/supabase/admin";

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

  await admin
    .from("companies")
    .update({
      subscription_status: mapearEstado(subscription.status),
      stripe_subscription_id: subscription.id,
    })
    .eq("stripe_customer_id", customerId);
}
```

con:

```ts
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

  // Si el price ID no coincide con ningún rango conocido (evento de
  // prueba, producto viejo, etc.), no tocamos employee_range — se queda
  // con lo que ya tenía.
  const priceId = subscription.items.data[0]?.price.id;
  const rango = priceId ? rangoDesdePriceId(priceId) : null;
  if (rango) cambios.employee_range = rango;

  await admin.from("companies").update(cambios).eq("stripe_customer_id", customerId);
}
```

- [ ] **Step 2: Agregar una prueba del webhook con un evento real firmado (modo prueba de Stripe)**

Añadir al final de `scripts/test-facturacion-rangos-flow.mjs` (antes del `console.log(failures === 0 ? ...)` final), agregando el import de Stripe y del cliente admin arriba del archivo:

Al inicio del archivo, agregar el import:

```js
import Stripe from "stripe";
```

Y antes del `console.log(failures === 0 ...)` final, agregar:

```js
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
```

- [ ] **Step 3: Correr el test contra un dev server real**

Run (en una terminal): `npm run dev`
Run (en otra): `node scripts/test-facturacion-rangos-flow.mjs`
Expected: `Todas las pruebas de facturación por rangos pasan.`, incluidas las tres nuevas del webhook.

- [ ] **Step 4: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts scripts/test-facturacion-rangos-flow.mjs
git commit -m "$(cat <<'EOF'
El webhook de Stripe ahora guarda employee_range según el price contratado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Ambos rangos visibles en la página de Facturación

**Files:**
- Modify: `app/panel/facturacion/page.tsx`
- Modify: `app/panel/facturacion/actions.ts`

- [ ] **Step 1: Modificar `actions.ts` para elegir el price correcto según rango + plan**

Reemplazar:

```ts
const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const PRECIOS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
};
```

con:

```ts
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
```

Reemplazar:

```ts
export async function iniciarCheckout(formData: FormData) {
  const plan = String(formData.get("plan") ?? "monthly") as "monthly" | "annual";
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
    line_items: [{ price: PRECIOS[plan], quantity: 1 }],
    payment_method_types: ["card"],
    locale: "es",
    success_url: `${SITIO_URL}/panel/facturacion?checkout=exito`,
    cancel_url: `${SITIO_URL}/panel/facturacion?checkout=cancelado`,
  });

  redirect(session.url!);
}
```

con:

```ts
export async function iniciarCheckout(formData: FormData) {
  const plan = String(formData.get("plan") ?? "monthly") as "monthly" | "annual";
  const rango = String(formData.get("rango") ?? "hasta_10") as "hasta_10" | "hasta_25";
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
```

`abrirPortal` no cambia.

- [ ] **Step 2: Mostrar ambos rangos en la página**

Reemplazar el contenido completo de `app/panel/facturacion/page.tsx` por:

```tsx
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { diasDeTrialRestantes } from "@/lib/facturacion";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { iniciarCheckout, abrirPortal } from "./actions";

const ETIQUETA_ESTADO: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

const RANGOS = [
  {
    key: "hasta_10",
    etiqueta: "Hasta 10 empleados",
    mensual: "$179 MXN / mes",
    anual: "$1,790 MXN / año (2 meses gratis)",
  },
  {
    key: "hasta_25",
    etiqueta: "Hasta 25 empleados",
    mensual: "$349 MXN / mes",
    anual: "$3,490 MXN / año (2 meses gratis)",
  },
] as const;

export default async function PaginaFacturacion({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const empresaActiva = await obtenerEmpresaActiva();
  if (!empresaActiva) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data: empresa } = await supabase
    .from("companies")
    .select("subscription_status, trial_ends_at, stripe_customer_id")
    .eq("id", empresaActiva.id)
    .single();

  if (!empresa) redirect("/panel");

  const diasRestantes = diasDeTrialRestantes(empresa.trial_ends_at);
  const yaTieneSuscripcion = Boolean(empresa.stripe_customer_id);
  // Suscribirse siempre debe estar disponible, no solo cuando ya está
  // bloqueado — alguien en trial también puede querer pagar ahora.
  const puedeSuscribirse = empresa.subscription_status !== "active";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Facturación</h1>

      {checkout === "exito" && (
        <Mensaje tono="exito">
          ¡Listo! Puede tardar un momento en reflejarse mientras confirmamos el pago.
        </Mensaje>
      )}
      {checkout === "cancelado" && <Mensaje tono="error">No se completó el pago.</Mensaje>}

      <div className="flex flex-col gap-1 rounded-md border border-border px-4 py-3">
        <p className="text-sm text-muted">Estado</p>
        <p className="text-lg font-medium text-ink">{ETIQUETA_ESTADO[empresa.subscription_status]}</p>
        {empresa.subscription_status === "trialing" && (
          <p className="text-sm text-muted">
            {diasRestantes > 0
              ? `${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de prueba restantes.`
              : "Tu prueba terminó."}
          </p>
        )}
        {empresa.subscription_status === "past_due" && (
          <p className="text-sm text-danger">
            Tu pago no se completó. Los tableros y reportes están bloqueados hasta que se regularice.
          </p>
        )}
      </div>

      {puedeSuscribirse && (
        <div className="flex flex-col gap-6">
          {RANGOS.map((rango) => (
            <form key={rango.key} action={iniciarCheckout} className="flex flex-col gap-3">
              <input type="hidden" name="rango" value={rango.key} />
              <p className="text-sm text-ink">{rango.etiqueta}:</p>
              <Boton type="submit" name="plan" value="monthly">
                {rango.mensual}
              </Boton>
              <Boton type="submit" name="plan" value="annual" variante="secundario">
                {rango.anual}
              </Boton>
            </form>
          ))}
          <p className="text-xs text-muted">
            Por ahora, pago con tarjeta. OXXO y SPEI llegan pronto.
          </p>
        </div>
      )}

      {yaTieneSuscripcion && (
        <form action={abrirPortal}>
          <Boton type="submit" variante="secundario">
            Gestionar suscripción
          </Boton>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verificación manual en el navegador**

Con el dev server corriendo y las variables `STRIPE_PRICE_MONTHLY_25`/`STRIPE_PRICE_ANNUAL_25` ya en `.env.local` (Task 5): entrar a `/panel/facturacion` como un owner en trial, confirmar que se ven los DOS rangos, cada uno con sus dos botones de periodo. Elegir "hasta 25 empleados" mensual, confirmar que Stripe Checkout muestra $349 MXN/mes (no completar el pago real, cancelar y confirmar que redirige con `checkout=cancelado`).

- [ ] **Step 4: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/panel/facturacion/page.tsx app/panel/facturacion/actions.ts
git commit -m "$(cat <<'EOF'
Mostrar ambos rangos de facturación siempre en /panel/facturacion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Actualizar `openspec/changes/mvp-reloj-checador/specs/billing/spec.md`

**Files:**
- Modify: `openspec/changes/mvp-reloj-checador/specs/billing/spec.md`
- Modify: `openspec/changes/mvp-reloj-checador/design.md`

- [ ] **Step 1: Reemplazar el requirement de "Exceso de rango" para reflejar el bloqueo duro**

En `openspec/changes/mvp-reloj-checador/specs/billing/spec.md`, reemplazar:

```markdown
### Requirement: Exceso de rango solicita upgrade
Cuando los empleados activos de una empresa excedan su rango contratado, el sistema SHALL notificar al administrador y solicitar el upgrade de rango, con un margen de gracia; el alta de empleados MUST seguir funcionando durante ese margen para no interrumpir la operación.

#### Scenario: Crecimiento del equipo
- **WHEN** una empresa del rango "hasta 10" activa a su empleado número 11
- **THEN** el alta procede, el administrador ve el aviso de upgrade y el plazo de gracia para regularizar
```

con:

```markdown
### Requirement: Bloqueo duro al llegar al tope del rango
Cuando los empleados activos de una empresa lleguen al tope de su rango contratado, el sistema SHALL bloquear el alta (o reactivación) de un empleado nuevo, mostrando un mensaje claro para subir de rango; este bloqueo MUST NOT aplicar durante el periodo de prueba, y jamás aplica al fichaje ni a su ingesta.

(Decisión revertida el 2026-07-14 respecto a la versión original de este requirement — ver `docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md`, sección "Decisiones que esta spec revierte", para la justificación completa.)

#### Scenario: Empresa dentro del trial
- **WHEN** una empresa en periodo de prueba con 18 empleados agrega uno más
- **THEN** el alta procede sin ningún bloqueo, sin importar el tamaño

#### Scenario: Empresa suscrita al tope de su rango
- **WHEN** una empresa activa del rango "hasta 10", con 10 empleados activos, intenta agregar uno más
- **THEN** el alta se bloquea y ve un mensaje indicando que debe subir de rango en Facturación

#### Scenario: Empresa suscrita por debajo del tope
- **WHEN** una empresa activa del rango "hasta 10" con 4 empleados agrega 3 más (total 7)
- **THEN** el alta procede sin bloqueo ni aviso, porque sigue dentro de su rango
```

- [ ] **Step 2: Documentar el segundo rango en `design.md`**

En `openspec/changes/mvp-reloj-checador/design.md`, reemplazar la línea de "Open Questions":

```markdown
- Precios de los rangos superiores (hasta 25, hasta 50): se calibran con la lista de espera antes del lanzamiento.
```

con:

```markdown
- ~~Precios de los rangos superiores (hasta 25, hasta 50): se calibran con la lista de espera antes del lanzamiento.~~ Resuelto el 2026-07-14 para el rango "hasta 25" ($349 MXN/mes, $3,490/año) sin pasar por lista de espera — ver `docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md`. El rango "hasta 50" sigue sin definir.
```

- [ ] **Step 3: Commit**

```bash
git add openspec/changes/mvp-reloj-checador/specs/billing/spec.md openspec/changes/mvp-reloj-checador/design.md
git commit -m "$(cat <<'EOF'
Actualizar spec de billing: bloqueo duro reemplaza el aviso con margen de gracia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Build final, regresión completa, push y despliegue

**Files:** ninguno (solo verificación y despliegue)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build limpio, sin rutas con error.

- [ ] **Step 2: Correr toda la suite de regresión existente**

Run: `node scripts/test-fichaje-flow.mjs && node scripts/test-horas-flow.mjs && node scripts/test-kiosco-flow.mjs && node scripts/test-correcciones-fichajes.mjs && node scripts/test-facturacion-rangos-flow.mjs`
Expected: los cinco terminan con su mensaje de éxito y exit code 0.

- [ ] **Step 3: Variables de entorno en Vercel producción**

Run: `vercel env add STRIPE_PRICE_MONTHLY_25 production` (pegar el valor generado en la Task 5) y `vercel env add STRIPE_PRICE_ANNUAL_25 production`.
Expected: ambas variables confirmadas en `vercel env ls production`.

- [ ] **Step 4: Push**

Fusionar `feature/plan-25-empleados` a `main` y hacer `git push origin main` (la migración de la Task 1 ya se aplicó a mano contra la base compartida; el workflow de GitHub Actions `supabase-migrations.yml` puede re-ejecutar `supabase db push` sin fallar porque la migración es idempotente).

- [ ] **Step 5: Deploy a producción**

Run: `vercel deploy --prod --yes`
Expected: deployment listo, sin errores de build en Vercel.

- [ ] **Step 6: Smoke test en producción**

En el navegador, contra `https://reloj-checador-chi.vercel.app/panel/facturacion`: confirmar que se ven ambos rangos. Con una empresa/empleado de prueba que se borre al terminar: confirmar en `/panel/empleados/nuevo` que el bloqueo al llegar al tope funciona igual que en dev.

- [ ] **Step 7: Actualizar `openspec/changes/mvp-reloj-checador/tasks.md`**

Agregar una entrada bajo el grupo 9 (Facturación) documentando que se agregó el rango "hasta 25 empleados" con enforcement real, con referencia a la spec y este plan.

---

## Self-review

**Cobertura de la spec:**
- Alcance: solo el siguiente escalón → todo el plan cubre exclusivamente hasta_25, sin tocar rangos superiores ni multi-empresa.
- Tarifa plana con tope más alto, $349/$3,490 → Task 5 (Stripe), Task 7 (UI).
- Tope: 25 empleados → Task 2 (`LIMITE_RANGO`).
- Sin tope durante trial → Task 2 (`limiteEfectivoDeEmpleados`), verificado en Task 3.
- Bloqueo duro sobre altas y reactivaciones, fichaje nunca tocado → Task 3.
- Ambos rangos siempre visibles → Task 7.
- Decisiones revertidas documentadas en openspec → Task 8.
- Migración de esquema, webhook, script de Stripe → Tasks 1, 5, 6.
- Build final, regresión, despliegue → Task 9.

**Placeholders:** ninguno — cada paso de código trae el archivo completo o el diff exacto a aplicar.

**Consistencia de tipos:** `limiteEfectivoDeEmpleados`, `rangoDesdePriceId`, `limiteDelRango` se usan con esos mismos nombres y firmas en Task 2 (donde se definen), Task 3 (`crearEmpleado`/`reactivar`), Task 4 (banner), y Task 6 (webhook) — verificado consistente.

**Nota de alcance:** el downgrade de rango 25 → 10 se apoya por completo en el portal de Stripe (Task 5) y en el mismo enforcement de Task 3 — si al bajar de rango la empresa ya tiene más empleados activos que el nuevo tope, simplemente no podrá agregar más hasta dar de baja a alguien. No se construye ninguna lógica adicional para ese caso, tal como quedó explícito en la spec.
