# Corrección de fichajes faltantes o mal cerrados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un admin pueda corregir un turno o descanso que se quedó abierto (o se cerró sospechosamente tarde) y que esa corrección sí cuente para el cómputo de horas semanales, sin tocar jamás el registro original de `clock_events`.

**Architecture:** Tabla nueva `clock_event_corrections` (append-only, igual patrón que `clock_event_annotations`), vinculada al evento que abre el tramo (`opens_event_id`). `weekly_hours_for_employee` la consulta cuando un tramo no tiene cierre válido. Un umbral configurable (`system_settings.open_shift_threshold_hours`, default 16) alimenta tres cosas: (1) una función SQL que arma la lista de "pendientes de revisión" para el admin, (2) el auto-marcado de `flag_sequence_anomaly` cuando alguien cierra un tramo demasiado tarde con un toque normal, (3) el umbral usado en (1).

**Tech Stack:** Next.js 15 App Router (Server Actions), Supabase (Postgres + RLS), scripts de regresión `.mjs` contra la base real (sin framework de test — es el patrón ya establecido en este repo).

---

## Mapa de archivos

**Nuevos:**
- `supabase/migrations/20260714100000_clock_event_corrections.sql` — tabla, RLS, columna de umbral, `weekly_hours_for_employee` actualizada, función `tramos_pendientes_revision`.
- `scripts/test-correcciones-fichajes.mjs` — regresión: RLS de la tabla nueva, `duracionExcedeUmbral`, cómputo de horas con corrección, `tramos_pendientes_revision`.
- `components/formulario-correccion.tsx` — formulario de corrección (mismo patrón que `formulario-anotacion.tsx`).
- `app/panel/horas/pendientes/page.tsx` — lista de tramos pendientes de revisión para el admin.
- `app/panel/horas/pendientes/actions.ts` — server action `crearCorreccion`.
- `app/mi-cuenta/historial/page.tsx` — historial propio del empleado (no existe hoy).

**Modificados:**
- `lib/fichaje.ts` — nueva función pura `duracionExcedeUmbral`.
- `lib/formato-fecha.ts` — nueva función `interpretarFechaHoraLocalComoUTC`.
- `app/api/fichar/route.ts` — auto-marcar anomalía si el cierre excede el umbral.
- `app/api/kiosco/fichar/route.ts` — mismo cambio.
- `app/panel/horas/page.tsx` — enlace a `/panel/horas/pendientes`.
- `app/panel/historial/page.tsx` — mostrar corrección vigente junto al evento que corrige.
- `app/mi-cuenta/page.tsx` — enlace al historial propio.

---

### Task 1: Migración SQL — tabla de correcciones, RLS, umbral, función de horas, función de pendientes

**Files:**
- Create: `supabase/migrations/20260714100000_clock_event_corrections.sql`
- Create: `scripts/test-correcciones-fichajes.mjs`

- [ ] **Step 1: Escribir el script de regresión (va a fallar porque nada de esto existe todavía)**

Crear `scripts/test-correcciones-fichajes.mjs`:

```js
/**
 * Prueba end-to-end de la corrección de fichajes faltantes/mal cerrados:
 * tabla clock_event_corrections (RLS + append-only), duracionExcedeUmbral
 * (lib/fichaje.ts), weekly_hours_for_employee usando una corrección
 * vigente, y tramos_pendientes_revision detectando ambos casos (turno
 * abierto, cierre marcado como anomalía).
 *
 * Uso: node scripts/test-correcciones-fichajes.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { duracionExcedeUmbral } from "../lib/fichaje.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

// 1. duracionExcedeUmbral — función pura, sin DB.
check("Duración menor al umbral no excede", !duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-13T17:00:00Z"), 16));
check("Duración mayor al umbral sí excede", duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-14T02:00:00Z"), 16));
check("Duración exactamente igual al umbral NO excede (frontera)", !duracionExcedeUmbral(new Date("2026-07-13T09:00:00Z"), new Date("2026-07-14T01:00:00Z"), 16));

const stamp = Date.now();
const email = `correcciones-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let ownerId, empleadoUserId, companyId, workCenterId, empleadoId;

try {
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  ownerId = u.user.id;
  const cliente = createClient(URL_, ANON, { auth: { persistSession: false } });
  await cliente.auth.signInWithPassword({ email, password });

  const { data: idEmpresa } = await cliente.rpc("create_company_with_owner", { company_name: "Empresa Correcciones" });
  companyId = idEmpresa;
  const { data: centro } = await cliente
    .from("work_centers")
    .insert({ company_id: companyId, name: "Matriz", lat: 19.4, lng: -99.1, geofence_radius_m: 100 })
    .select()
    .single();
  workCenterId = centro.id;

  const empleadoEmail = `correcciones-empleado-${stamp}@mailinator.com`;
  const { data: eu } = await admin.auth.admin.createUser({ email: empleadoEmail, password, email_confirm: true });
  empleadoUserId = eu.user.id;
  const { data: emp } = await cliente
    .from("employees")
    .insert({ company_id: companyId, work_center_id: workCenterId, full_name: "Empleado Correcciones", auth_user_id: empleadoUserId })
    .select()
    .single();
  empleadoId = emp.id;

  const insertarEvento = (eventType, deviceTs, flags = {}) =>
    admin.from("clock_events").insert({
      id: randomUUID(),
      company_id: companyId,
      employee_id: empleadoId,
      work_center_id: workCenterId,
      event_type: eventType,
      source: "personal_phone",
      device_ts: deviceTs,
      server_ts: deviceTs,
      lat: 19.4,
      lng: -99.1,
      ...flags,
    }).select().single();

  // 2. Umbral configurable con default 16.
  const { data: settings } = await admin.from("system_settings").select("open_shift_threshold_hours").single();
  check("open_shift_threshold_hours existe con default 16", Number(settings?.open_shift_threshold_hours) === 16, `dio ${settings?.open_shift_threshold_hours}`);

  // 3. Caso "turno abierto": clock_in de hace 20h, sin cierre.
  const hace20h = new Date(Date.now() - 20 * 3600_000).toISOString();
  const { data: clockInAbierto } = await insertarEvento("clock_in", hace20h);
  check("Se insertó el clock_in abierto", !!clockInAbierto?.id);

  const { data: pendientesAbierto } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaAbierta = (pendientesAbierto ?? []).find((p) => p.opens_event_id === clockInAbierto.id);
  check("tramos_pendientes_revision detecta el turno abierto de 20h", !!filaAbierta, JSON.stringify(pendientesAbierto));
  check("El motivo reportado es 'abierto'", filaAbierta?.motivo === "abierto", filaAbierta?.motivo);

  // 4. Sin corrección, el turno abierto NO cuenta en horas de esa semana.
  const lunes = (() => {
    const ahora = new Date();
    const dia = ahora.getUTCDay();
    const diff = (dia === 0 ? -6 : 1) - dia;
    const l = new Date(ahora);
    l.setUTCDate(ahora.getUTCDate() + diff);
    l.setUTCHours(0, 0, 0, 0);
    return l;
  })();
  const inicioSemana = lunes.toISOString().slice(0, 10);

  // 5. El admin corrige: agrega clock_event_corrections con la hora real.
  const horaCorregida = new Date(new Date(hace20h).getTime() + 8 * 3600_000).toISOString(); // 8h después del clock_in
  const { data: correccion, error: errorCorreccion } = await cliente
    .from("clock_event_corrections")
    .insert({
      company_id: companyId,
      employee_id: empleadoId,
      opens_event_id: clockInAbierto.id,
      corrected_closing_ts: horaCorregida,
      reason: "El empleado olvidó marcar salida; según su reporte, trabajó 8 horas.",
      created_by: ownerId,
    })
    .select()
    .single();
  check("El admin (owner) puede insertar una corrección", !errorCorreccion && !!correccion, errorCorreccion?.message);

  // 6. Con la corrección, sí cuenta en el cómputo de horas.
  const { data: horasConCorreccion } = await admin.rpc("weekly_hours_for_employee", {
    p_employee_id: empleadoId,
    p_week_start: inicioSemana,
  });
  check("Con corrección vigente, el turno cuenta 8h", Number(horasConCorreccion) === 8, `dio ${horasConCorreccion}`);

  // 7. Ya con corrección, tramos_pendientes_revision deja de listarlo.
  const { data: pendientesTrasCorregir } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const siguePendiente = (pendientesTrasCorregir ?? []).some((p) => p.opens_event_id === clockInAbierto.id);
  check("Tras corregir, ya no aparece en pendientes", !siguePendiente);

  // 8. RLS: un empleado normal NO puede insertar correcciones.
  const clienteEmpleado = createClient(URL_, ANON, { auth: { persistSession: false } });
  await clienteEmpleado.auth.signInWithPassword({ email: empleadoEmail, password });
  const { data: otroClockIn } = await insertarEvento("clock_in", new Date(Date.now() - 18 * 3600_000).toISOString());
  const { error: errorRLSEmpleado } = await clienteEmpleado.from("clock_event_corrections").insert({
    company_id: companyId,
    employee_id: empleadoId,
    opens_event_id: otroClockIn.id,
    corrected_closing_ts: new Date().toISOString(),
    reason: "intento no autorizado",
    created_by: empleadoUserId,
  });
  check("Un empleado normal NO puede insertar una corrección (RLS)", !!errorRLSEmpleado);

  // 9. El empleado SÍ puede leer las correcciones de su propio historial.
  const { data: lectura, error: errorLectura } = await clienteEmpleado
    .from("clock_event_corrections")
    .select("id")
    .eq("opens_event_id", clockInAbierto.id);
  check("El empleado puede leer una corrección sobre su propio fichaje", !errorLectura && (lectura ?? []).length === 1, errorLectura?.message);

  // 10. Caso "cierre marcado como anomalía": clock_in hace 20h + clock_out
  // flageado (simula lo que el auto-flag de las Tasks 3/4 va a producir).
  const { data: clockInAnomalia } = await insertarEvento("clock_in", new Date(Date.now() - 20 * 3600_000 - 3600_000).toISOString());
  await insertarEvento("clock_out", new Date(Date.now() - 3600_000).toISOString(), { flag_sequence_anomaly: true });

  const { data: pendientesAnomalia } = await admin.rpc("tramos_pendientes_revision", { p_company_id: companyId });
  const filaAnomalia = (pendientesAnomalia ?? []).find((p) => p.opens_event_id === clockInAnomalia.id);
  check("tramos_pendientes_revision detecta el cierre marcado como anomalía", !!filaAnomalia, JSON.stringify(pendientesAnomalia));
  check("El motivo reportado es 'anomalia'", filaAnomalia?.motivo === "anomalia", filaAnomalia?.motivo);
} finally {
  if (companyId) {
    await admin.from("clock_event_corrections").delete().eq("company_id", companyId);
    await admin.from("clock_events").delete().eq("company_id", companyId);
    await admin.from("employees").delete().eq("company_id", companyId);
    await admin.from("work_centers").delete().eq("company_id", companyId);
    await admin.from("company_members").delete().eq("company_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  if (empleadoUserId) await admin.auth.admin.deleteUser(empleadoUserId);
}

console.log(failures === 0 ? "\nTodas las pruebas de corrección de fichajes pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el script y confirmar que falla**

Run: `node scripts/test-correcciones-fichajes.mjs`
Expected: falla al importar `duracionExcedeUmbral` desde `lib/fichaje.ts` (no existe todavía) — `SyntaxError` o `does not provide an export named 'duracionExcedeUmbral'`.

- [ ] **Step 3: Escribir la migración completa**

Crear `supabase/migrations/20260714100000_clock_event_corrections.sql`:

```sql
-- Corrección de fichajes faltantes o mal cerrados (spec:
-- docs/superpowers/specs/2026-07-13-correcciones-fichajes-design.md).
-- clock_events sigue intocable — esto es una tabla aparte, también
-- append-only, que apunta al evento que ABRE un tramo (clock_in o
-- break_start) y declara cuál fue el cierre real. Si una corrección
-- está mal, se inserta una nueva para el mismo opens_event_id — la
-- vigente es la más reciente por created_at (mismo patrón que
-- consent_documents).

create table public.clock_event_corrections (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id),
  employee_id           uuid not null references public.employees (id),
  opens_event_id        uuid not null references public.clock_events (id),
  -- El evento de cierre real, si existe pero quedó flageado (p. ej. un
  -- clock_out marcado flag_sequence_anomaly por demasiado tardío). Null
  -- cuando el tramo nunca se cerró.
  closes_event_id       uuid references public.clock_events (id),
  corrected_closing_ts  timestamptz not null,
  reason                text not null check (char_length(reason) > 0),
  created_by            uuid not null references auth.users (id),
  created_at            timestamptz not null default now()
);

alter table public.clock_event_corrections enable row level security;

create index clock_event_corrections_opens_idx on public.clock_event_corrections (opens_event_id, created_at desc);

create policy clock_event_corrections_select on public.clock_event_corrections
  for select using (
    public.is_company_member(company_id)
    or exists (
      select 1 from public.employees e
      where e.id = clock_event_corrections.employee_id
        and e.auth_user_id = (select auth.uid())
    )
  );

create policy clock_event_corrections_insert on public.clock_event_corrections
  for insert with check (
    public.is_company_member(company_id)
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.clock_events ce
      where ce.id = clock_event_corrections.opens_event_id
        and ce.company_id = clock_event_corrections.company_id
        and ce.employee_id = clock_event_corrections.employee_id
        and ce.event_type in ('clock_in', 'break_start')
    )
  );

-- Sin políticas de UPDATE/DELETE: append-only, igual que clock_events y
-- clock_event_annotations.

-- Umbral configurable: a partir de cuántas horas un tramo abierto se
-- considera "posiblemente olvidado" (spec, decisión 2).
alter table public.system_settings
  add column open_shift_threshold_hours numeric not null default 16;

-- weekly_hours_for_employee: ahora, cuando un tramo no tiene cierre
-- válido dentro de la semana (el evento de apertura no tiene cierre, o
-- su cierre natural está flag_sequence_anomaly), busca si existe una
-- corrección vigente para ese opens_event_id y usa corrected_closing_ts
-- en vez de excluir el tramo del cómputo.
create or replace function public.weekly_hours_for_employee(
  p_employee_id uuid,
  p_week_start date
)
returns numeric
language plpgsql stable
as $$
declare
  v_event           record;
  v_shift_start     timestamptz;
  v_shift_start_id  uuid;
  v_break_start     timestamptz;
  v_break_start_id  uuid;
  v_break_accum     interval := '0'::interval;
  v_total           interval := '0'::interval;
  v_week_end        timestamptz := (p_week_start::timestamptz + interval '7 days');
  v_hasta           timestamptz;
  v_break_pendiente interval;
  v_correccion      timestamptz;
begin
  for v_event in
    select id, event_type, device_ts, flag_sequence_anomaly
    from public.clock_events
    where employee_id = p_employee_id
      and device_ts >= p_week_start::timestamptz
      and device_ts < v_week_end
    order by device_ts asc
  loop
    if v_event.event_type = 'clock_in' and not v_event.flag_sequence_anomaly then
      v_shift_start := v_event.device_ts;
      v_shift_start_id := v_event.id;
      v_break_accum := '0'::interval;
    elsif v_event.event_type = 'break_start' and not v_event.flag_sequence_anomaly then
      v_break_start := v_event.device_ts;
      v_break_start_id := v_event.id;
    elsif v_event.event_type = 'break_end' then
      if v_event.flag_sequence_anomaly then
        -- Cierre flageado: usar la corrección vigente para el descanso
        -- que abrió, si existe.
        if v_break_start_id is not null then
          select corrected_closing_ts into v_correccion
          from public.clock_event_corrections
          where opens_event_id = v_break_start_id
          order by created_at desc
          limit 1;
          if v_correccion is not null then
            v_break_accum := v_break_accum + (v_correccion - v_break_start);
          end if;
          v_break_start := null;
          v_break_start_id := null;
        end if;
      elsif v_break_start is not null then
        v_break_accum := v_break_accum + (v_event.device_ts - v_break_start);
        v_break_start := null;
        v_break_start_id := null;
      end if;
    elsif v_event.event_type = 'clock_out' then
      if v_event.flag_sequence_anomaly then
        -- Cierre flageado: usar la corrección vigente para el turno que
        -- abrió, si existe.
        if v_shift_start_id is not null then
          select corrected_closing_ts into v_correccion
          from public.clock_event_corrections
          where opens_event_id = v_shift_start_id
          order by created_at desc
          limit 1;
          if v_correccion is not null then
            v_total := v_total + (v_correccion - v_shift_start) - v_break_accum;
          end if;
          v_shift_start := null;
          v_shift_start_id := null;
          v_break_accum := '0'::interval;
        end if;
      elsif v_shift_start is not null then
        v_total := v_total + (v_event.device_ts - v_shift_start) - v_break_accum;
        v_shift_start := null;
        v_shift_start_id := null;
        v_break_accum := '0'::interval;
      end if;
    end if;
  end loop;

  -- Tramo todavía abierto al final de la semana consultada (o hasta
  -- ahora): si hay una corrección vigente, usarla como punto de cierre;
  -- si no, sigue contando en vivo hasta el momento de la consulta
  -- (comportamiento ya existente). Un descanso que también sigue
  -- abierto dentro de este turno se cierra en el mismo punto v_hasta —
  -- no se busca una corrección aparte para el descanso en este caso,
  -- para no encadenar dos búsquedas de corrección en un edge case
  -- (turno y descanso ambos sin cerrar) que hoy no es un caso de uso
  -- real para el tamaño de cliente de Chekly.
  if v_shift_start is not null then
    select corrected_closing_ts into v_correccion
    from public.clock_event_corrections
    where opens_event_id = v_shift_start_id
    order by created_at desc
    limit 1;

    v_hasta := coalesce(v_correccion, least(now(), v_week_end));
    v_break_pendiente := v_break_accum;
    if v_break_start is not null then
      v_break_pendiente := v_break_pendiente + (v_hasta - v_break_start);
    end if;
    v_total := v_total + (v_hasta - v_shift_start) - v_break_pendiente;
  end if;

  return round(extract(epoch from v_total) / 3600.0, 2);
end;
$$;

-- Lista, para una empresa, los tramos que necesitan revisión de un
-- admin: (1) el último evento de un empleado es de apertura y lleva más
-- del umbral sin cerrarse, o (2) hay un cierre marcado como anomalía sin
-- corrección vigente todavía. Ambos casos quedan fuera del listado en
-- cuanto existe al menos una corrección para ese opens_event_id.
create or replace function public.tramos_pendientes_revision(p_company_id uuid)
returns table (
  employee_id      uuid,
  employee_name    text,
  opens_event_id   uuid,
  opens_type       text,
  opens_device_ts  timestamptz,
  horas_abierto    numeric,
  motivo           text
)
language plpgsql stable
as $$
declare
  v_umbral_horas numeric;
begin
  select open_shift_threshold_hours into v_umbral_horas from public.system_settings limit 1;
  v_umbral_horas := coalesce(v_umbral_horas, 16);

  return query
  with ultimo_evento as (
    select distinct on (ce.employee_id)
      ce.employee_id, ce.id, ce.event_type, ce.device_ts
    from public.clock_events ce
    where ce.company_id = p_company_id
    order by ce.employee_id, ce.device_ts desc
  ),
  abiertos as (
    select
      u.employee_id,
      e.full_name as employee_name,
      u.id as opens_event_id,
      u.event_type as opens_type,
      u.device_ts as opens_device_ts,
      round(extract(epoch from (now() - u.device_ts)) / 3600.0, 2) as horas_abierto,
      'abierto'::text as motivo
    from ultimo_evento u
    join public.employees e on e.id = u.employee_id
    where u.event_type in ('clock_in', 'break_start')
      and (now() - u.device_ts) > (v_umbral_horas * interval '1 hour')
      and not exists (
        select 1 from public.clock_event_corrections cec where cec.opens_event_id = u.id
      )
  ),
  cierres_anomalos as (
    select ce.id as closes_event_id, ce.employee_id, ce.event_type as closes_type, ce.device_ts as closes_device_ts
    from public.clock_events ce
    where ce.company_id = p_company_id
      and ce.event_type in ('clock_out', 'break_end')
      and ce.flag_sequence_anomaly = true
  ),
  anomalos as (
    select
      ca.employee_id,
      e.full_name as employee_name,
      apertura.id as opens_event_id,
      apertura.event_type as opens_type,
      apertura.device_ts as opens_device_ts,
      round(extract(epoch from (ca.closes_device_ts - apertura.device_ts)) / 3600.0, 2) as horas_abierto,
      'anomalia'::text as motivo
    from cierres_anomalos ca
    join public.employees e on e.id = ca.employee_id
    cross join lateral (
      select ce2.id, ce2.device_ts, ce2.event_type
      from public.clock_events ce2
      where ce2.employee_id = ca.employee_id
        and ce2.event_type = case ca.closes_type when 'clock_out' then 'clock_in' else 'break_start' end
        and ce2.device_ts < ca.closes_device_ts
      order by ce2.device_ts desc
      limit 1
    ) apertura
    where not exists (
      select 1 from public.clock_event_corrections cec where cec.opens_event_id = apertura.id
    )
  )
  select * from abiertos
  union all
  select * from anomalos;
end;
$$;
```

- [ ] **Step 4: Aplicar la migración a la base compartida**

Run: `cd "/Users/paolabramlett/Reloj Checador" && set -a && source .env.local && set +a && supabase db push --db-url "$SUPABASE_DB_URL"`
Expected: `Applying migration 20260714100000_clock_event_corrections.sql... Finished supabase db push.` (el warning de Docker es normal, ya lo vimos antes — no bloquea).

- [ ] **Step 5: Correr el script de nuevo — debe seguir fallando (falta `duracionExcedeUmbral`)**

Run: `node scripts/test-correcciones-fichajes.mjs`
Expected: mismo error de import que en el Step 2 (Task 2 todavía no existe) — confirma que la migración en sí no rompió nada antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260714100000_clock_event_corrections.sql scripts/test-correcciones-fichajes.mjs
git commit -m "$(cat <<'EOF'
Agregar tabla de correcciones de fichajes y actualizar cómputo de horas

clock_event_corrections (append-only, igual patrón que
clock_event_annotations): vincula un evento de apertura (clock_in o
break_start) con la hora de cierre real que declara un admin, con
motivo obligatorio. weekly_hours_for_employee ahora la consulta
cuando un tramo no tiene cierre válido, en vez de excluirlo sin más.
Nueva función tramos_pendientes_revision para el tablero del admin.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `duracionExcedeUmbral` en `lib/fichaje.ts`

**Files:**
- Modify: `lib/fichaje.ts`
- Test: ya escrito en `scripts/test-correcciones-fichajes.mjs` (Task 1, Step 1)

- [ ] **Step 1: Confirmar que el test sigue fallando por la razón correcta**

Run: `node scripts/test-correcciones-fichajes.mjs`
Expected: falla al importar `duracionExcedeUmbral` (no exportada todavía).

- [ ] **Step 2: Agregar la función a `lib/fichaje.ts`**

Al final del archivo `lib/fichaje.ts` (después de `calcularFlagsDeTiempo`), agregar:

```ts
/**
 * True si el tramo entre `apertura` y `cierre` supera `umbralHoras` — se
 * usa para auto-marcar flag_sequence_anomaly en un cierre estructural-
 * mente válido pero sospechosamente tardío (spec: "Auto-flag de cierre
 * tardío"), y para listar tramos abiertos en tramos_pendientes_revision.
 */
export function duracionExcedeUmbral(apertura: Date, cierre: Date, umbralHoras: number): boolean {
  const horasTranscurridas = (cierre.getTime() - apertura.getTime()) / 3_600_000;
  return horasTranscurridas > umbralHoras;
}
```

- [ ] **Step 3: Correr el script — la parte de `duracionExcedeUmbral` y el resto (ya cubierto por la migración de la Task 1) debe pasar completo**

Run: `node scripts/test-correcciones-fichajes.mjs`
Expected: `Todas las pruebas de corrección de fichajes pasan.` (exit code 0)

- [ ] **Step 4: Commit**

```bash
git add lib/fichaje.ts
git commit -m "$(cat <<'EOF'
Agregar duracionExcedeUmbral para detectar tramos sospechosamente largos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Auto-marcar anomalía en `app/api/fichar/route.ts` cuando el cierre excede el umbral

**Files:**
- Modify: `app/api/fichar/route.ts`

- [ ] **Step 1: Leer el bloque actual que decide `esAnomalia` y la consulta de `system_settings`**

El archivo hoy (después del fix de orden de eventos) tiene, en este orden: la consulta de `ultimoEvento` (solo `event_type`), el cálculo de `esAnomalia` por secuencia, y una consulta separada de `system_settings` para `clock_skew_threshold_seconds`/`late_sync_threshold_seconds`. Hay que: (a) traer también `device_ts` en `ultimoEvento`, (b) adelantar la consulta de `system_settings` para incluir `open_shift_threshold_hours` y reusarla, (c) agregar la condición de duración.

- [ ] **Step 2: Aplicar el cambio**

Reemplazar este bloque (el que empieza en `// device_ts (cuándo pasó de verdad)...` y termina antes de `const flagOutOfFence`):

```ts
  // device_ts (cuándo pasó de verdad), no server_ts (cuándo llegó): dos
  // fichajes casi simultáneos pueden llegar al servidor en desorden, y
  // ordenar por server_ts hacía que el estado "anterior" fuera el
  // equivocado — marcando como anomalía una secuencia que en realidad
  // era válida.
  const { data: ultimoEvento } = await supabase
    .from("clock_events")
    .select("event_type")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  const esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);

  const { data: config } = await supabase
    .from("system_settings")
    .select("clock_skew_threshold_seconds, late_sync_threshold_seconds")
    .single();
```

con:

```ts
  // device_ts (cuándo pasó de verdad), no server_ts (cuándo llegó): dos
  // fichajes casi simultáneos pueden llegar al servidor en desorden, y
  // ordenar por server_ts hacía que el estado "anterior" fuera el
  // equivocado — marcando como anomalía una secuencia que en realidad
  // era válida.
  const { data: ultimoEvento } = await supabase
    .from("clock_events")
    .select("event_type, device_ts")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  let esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);

  const { data: config } = await supabase
    .from("system_settings")
    .select("clock_skew_threshold_seconds, late_sync_threshold_seconds, open_shift_threshold_hours")
    .single();

  // Transición estructuralmente válida, pero el tramo resultante es
  // sospechosamente largo (spec: "Auto-flag de cierre tardío") — p. ej.
  // alguien toca "Marcar salida" al día siguiente sin darse cuenta de
  // que su turno de ayer se quedó abierto. Se deja registrar, pero
  // queda flageado para que un admin lo revise y, si aplica, lo
  // corrija con la hora real.
  if (
    !esAnomalia &&
    ultimoEvento &&
    (eventType === "clock_out" || eventType === "break_end")
  ) {
    esAnomalia = duracionExcedeUmbral(
      new Date(ultimoEvento.device_ts),
      deviceTs,
      config?.open_shift_threshold_hours ?? 16,
    );
  }
```

- [ ] **Step 3: Agregar el import**

En el bloque de imports de `lib/fichaje` al inicio del archivo, agregar `duracionExcedeUmbral`:

```ts
import {
  calcularFlagsDeTiempo,
  duracionExcedeUmbral,
  estadoDesdeUltimoEvento,
  estadoSiguiente,
  transicionEsValida,
  TIPOS_EVENTO_VALIDOS,
  type TipoEvento,
} from "@/lib/fichaje";
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build limpio, sin errores de tipos (nota: `let esAnomalia` en vez de `const` — si TypeScript se queja de reasignación, confirmar que el cambio de `const` a `let` en el Step 2 quedó aplicado).

- [ ] **Step 5: Verificación manual en el navegador**

Esta parte no tiene test automatizado (el patrón de este repo prueba rutas de API vía navegador real, no vía script — ver `test-fichaje-flow.mjs`, que prueba RLS a nivel de base, no la ruta en sí). Con el dev server corriendo:

1. Insertar directamente (con service role, vía un script de una línea o la consola de Supabase) un `clock_in` con `device_ts` de hace 18 horas para un empleado de prueba.
2. Loguear como ese empleado, tocar "Marcar salida".
3. Confirmar en la tabla `clock_events` que el `clock_out` insertado tiene `flag_sequence_anomaly = true`.
4. Repetir con un `clock_in` de hace 2 horas y confirmar que el `clock_out` NO queda flageado.

- [ ] **Step 6: Commit**

```bash
git add app/api/fichar/route.ts
git commit -m "$(cat <<'EOF'
Auto-marcar anomalía cuando un cierre normal excede el umbral de horas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Mismo cambio en `app/api/kiosco/fichar/route.ts`

**Files:**
- Modify: `app/api/kiosco/fichar/route.ts`

- [ ] **Step 1: Aplicar el mismo cambio de patrón**

Reemplazar:

```ts
  // device_ts, no server_ts — ver la misma nota en api/fichar/route.ts.
  // Acá coinciden casi siempre (el kiosco no tiene reloj propio del
  // cliente), pero un empleado que también usa su teléfono personal
  // puede mezclar ambos orígenes.
  const { data: ultimoEvento } = await admin
    .from("clock_events")
    .select("event_type")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  const esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);
```

con:

```ts
  // device_ts, no server_ts — ver la misma nota en api/fichar/route.ts.
  // Acá coinciden casi siempre (el kiosco no tiene reloj propio del
  // cliente), pero un empleado que también usa su teléfono personal
  // puede mezclar ambos orígenes.
  const { data: ultimoEvento } = await admin
    .from("clock_events")
    .select("event_type, device_ts")
    .eq("employee_id", empleado.id)
    .order("device_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  let esAnomalia = !transicionEsValida(estadoActual, eventType as TipoEvento);

  if (!esAnomalia && ultimoEvento && (eventType === "clock_out" || eventType === "break_end")) {
    const { data: umbralConfig } = await admin
      .from("system_settings")
      .select("open_shift_threshold_hours")
      .single();
    esAnomalia = duracionExcedeUmbral(
      new Date(ultimoEvento.device_ts),
      new Date(),
      umbralConfig?.open_shift_threshold_hours ?? 16,
    );
  }
```

Nota: el kiosco no recibe `device_ts` del cliente (usa `ahora` del servidor para ambos, ver el insert más abajo en el mismo archivo) — por eso acá se compara contra `new Date()` directamente, no contra un `deviceTs` capturado antes.

- [ ] **Step 2: Agregar el import**

```ts
import {
  duracionExcedeUmbral,
  estadoDesdeUltimoEvento,
  estadoSiguiente,
  transicionEsValida,
  TIPOS_EVENTO_VALIDOS,
  type TipoEvento,
} from "@/lib/fichaje";
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 4: Verificación manual**

Mismo procedimiento que Task 3 Step 5, pero fichando desde `/kiosco` en vez del teléfono personal.

- [ ] **Step 5: Commit**

```bash
git add app/api/kiosco/fichar/route.ts
git commit -m "$(cat <<'EOF'
Auto-marcar anomalía por cierre tardío también en modo kiosco

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Interpretar hora local de México en formularios (helper compartido)

**Files:**
- Modify: `lib/formato-fecha.ts`

- [ ] **Step 1: Agregar la función**

El input `datetime-local` del formulario de corrección (Task 6) entrega un string sin zona horaria (p. ej. `"2026-07-13T14:30"`). Sin esto, `new Date(valor)` lo interpretaría en la zona del servidor (UTC en Vercel), corriendo la hora ~6h — el mismo bug que ya se corrigió para lectura, ahora del lado de escritura. México (Zona Centro) no tiene horario de verano desde la reforma de 2022, así que el offset fijo `-06:00` es seguro para el alcance de este producto (un solo huso horario soportado, como ya se decidió para el resto de la app).

Agregar a `lib/formato-fecha.ts`:

```ts
// El input datetime-local del formulario de corrección entrega
// "YYYY-MM-DDTHH:mm" sin zona — se interpreta como hora de Zona Centro
// (UTC-6 fijo, México no tiene horario de verano desde 2022) y se
// convierte a un Date en UTC real para guardar en la base.
export function interpretarFechaHoraLocalComoUTC(valorDatetimeLocal: string): Date {
  return new Date(`${valorDatetimeLocal}:00-06:00`);
}
```

- [ ] **Step 2: Verificar en un REPL rápido**

Run: `node -e "console.log(new Date('2026-07-13T14:30:00-06:00').toISOString())"`
Expected: `2026-07-13T20:30:00.000Z` (14:30 hora de México = 20:30 UTC).

- [ ] **Step 3: Commit**

```bash
git add lib/formato-fecha.ts
git commit -m "$(cat <<'EOF'
Agregar interpretarFechaHoraLocalComoUTC para el formulario de corrección

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Formulario y vista de "pendientes de revisión" para el admin

**Files:**
- Create: `app/panel/horas/pendientes/actions.ts`
- Create: `components/formulario-correccion.tsx`
- Create: `app/panel/horas/pendientes/page.tsx`
- Modify: `app/panel/horas/page.tsx`

- [ ] **Step 1: Server action `crearCorreccion`**

Crear `app/panel/horas/pendientes/actions.ts`:

```ts
"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { interpretarFechaHoraLocalComoUTC } from "@/lib/formato-fecha";

export async function crearCorreccion(_prevState: unknown, formData: FormData) {
  const opensEventId = String(formData.get("opens_event_id") ?? "");
  const employeeId = String(formData.get("employee_id") ?? "");
  const closesEventId = String(formData.get("closes_event_id") ?? "") || null;
  const horaLocal = String(formData.get("corrected_closing_ts") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!opensEventId || !employeeId || !horaLocal || !reason) {
    return { error: "Completa la hora y el motivo de la corrección.", guardadoEn: null };
  }

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa.", guardadoEn: null };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión inválida.", guardadoEn: null };

  const { data: eventoApertura } = await supabase
    .from("clock_events")
    .select("device_ts")
    .eq("id", opensEventId)
    .eq("company_id", empresa.id)
    .single();

  if (!eventoApertura) return { error: "No encontramos el fichaje a corregir.", guardadoEn: null };

  const correctedClosingTs = interpretarFechaHoraLocalComoUTC(horaLocal);
  if (Number.isNaN(correctedClosingTs.getTime())) {
    return { error: "La hora que capturaste no es válida.", guardadoEn: null };
  }
  if (correctedClosingTs.getTime() <= new Date(eventoApertura.device_ts).getTime()) {
    return { error: "La hora corregida tiene que ser después de cuándo empezó el tramo.", guardadoEn: null };
  }
  if (correctedClosingTs.getTime() > Date.now()) {
    return { error: "La hora corregida no puede estar en el futuro.", guardadoEn: null };
  }

  const { error } = await supabase.from("clock_event_corrections").insert({
    company_id: empresa.id,
    employee_id: employeeId,
    opens_event_id: opensEventId,
    closes_event_id: closesEventId,
    corrected_closing_ts: correctedClosingTs.toISOString(),
    reason,
    created_by: user.id,
  });

  if (error) return { error: "No pudimos guardar la corrección. Intenta de nuevo.", guardadoEn: null };

  return { error: null, guardadoEn: Date.now() };
}
```

- [ ] **Step 2: Componente de formulario**

Crear `components/formulario-correccion.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { crearCorreccion } from "@/app/panel/horas/pendientes/actions";

interface FormularioCorreccionProps {
  opensEventId: string;
  employeeId: string;
  closesEventId?: string | null;
}

export function FormularioCorreccion({ opensEventId, employeeId, closesEventId }: FormularioCorreccionProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enProceso] = useActionState(crearCorreccion, {
    error: null as string | null,
    guardadoEn: null as number | null,
  });

  useEffect(() => {
    if (estado.guardadoEn) {
      setAbierto(false);
      router.refresh();
    }
  }, [estado.guardadoEn, router]);

  if (!abierto) {
    return (
      <Boton type="button" variante="secundario" anchoCompleto={false} className="px-4 text-sm" onClick={() => setAbierto(true)}>
        Corregir
      </Boton>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <input type="hidden" name="opens_event_id" value={opensEventId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      {closesEventId && <input type="hidden" name="closes_event_id" value={closesEventId} />}
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      <Campo etiqueta="Hora real de salida" name="corrected_closing_ts" type="datetime-local" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-sm font-medium text-ink">
          Motivo
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          placeholder="Ej: el empleado olvidó marcar salida; según su reporte, salió a las 18:00."
          className="min-h-20 rounded-md border border-border px-3 py-2 text-sm text-ink placeholder:text-muted"
        />
      </div>
      <div className="flex gap-2">
        <Boton type="submit" anchoCompleto={false} cargando={enProceso} className="px-4 text-sm">
          Guardar corrección
        </Boton>
        <Boton type="button" variante="secundario" anchoCompleto={false} className="px-4 text-sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Página de pendientes**

Crear `app/panel/horas/pendientes/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { obtenerAccesoAdmin } from "@/lib/facturacion";
import { BloqueoFacturacion } from "@/components/bloqueo-facturacion";
import { FormularioCorreccion } from "@/components/formulario-correccion";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { formatearFechaHoraCorta } from "@/lib/formato-fecha";

const ETIQUETA_MOTIVO: Record<string, string> = {
  abierto: "Sigue abierto",
  anomalia: "Cierre marcado como anomalía",
};

export default async function PaginaPendientes() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) return <BloqueoFacturacion />;

  const { data: pendientes } = await supabase.rpc("tramos_pendientes_revision", { p_company_id: empresa.id });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Pendientes de revisión</h1>
        <p className="text-sm text-muted">
          Turnos o descansos que se quedaron abiertos, o que se cerraron sospechosamente tarde.
        </p>
      </div>

      {!pendientes || pendientes.length === 0 ? (
        <p className="text-muted">No hay nada pendiente de revisión.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((tramo: {
            employee_id: string;
            employee_name: string;
            opens_event_id: string;
            opens_type: string;
            opens_device_ts: string;
            horas_abierto: number;
            motivo: string;
          }) => (
            <li key={tramo.opens_event_id} className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink">{tramo.employee_name}</span>
                <span className="text-sm text-muted">
                  {ETIQUETA_EVENTO[tramo.opens_type as TipoEvento]} — {formatearFechaHoraCorta(tramo.opens_device_ts)}
                </span>
                <span className="text-sm font-medium text-danger">
                  {ETIQUETA_MOTIVO[tramo.motivo] ?? tramo.motivo} · {tramo.horas_abierto.toFixed(1)} h
                </span>
              </div>
              <FormularioCorreccion opensEventId={tramo.opens_event_id} employeeId={tramo.employee_id} />
            </li>
          ))}
        </ul>
      )}

      <Link href="/panel/horas" className="text-sm font-medium text-primary hover:underline">
        ← Volver al tablero de horas
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Enlace desde el tablero de horas**

En `app/panel/horas/page.tsx`, agregar un enlace justo antes del cierre de `</main>` (después de la lista de `filas`, antes de que termine el componente). Ubicar la línea:

```tsx
      )}
    </main>
  );
}
```

y reemplazarla por:

```tsx
      )}

      <Link href="/panel/horas/pendientes" className="text-sm font-medium text-primary hover:underline">
        Ver pendientes de revisión →
      </Link>
    </main>
  );
}
```

(El import de `Link` ya existe en este archivo.)

- [ ] **Step 5: Verificación manual en el navegador**

Con el dev server corriendo:
1. Insertar (vía service role) un `clock_in` de hace 18h sin cierre para un empleado de prueba.
2. Entrar a `/panel/horas`, confirmar que aparece el enlace "Ver pendientes de revisión".
3. Entrar a `/panel/horas/pendientes`, confirmar que el tramo aparece listado con "Sigue abierto" y las horas correctas.
4. Tocar "Corregir", llenar hora y motivo, guardar.
5. Confirmar que la fila desaparece de pendientes tras el `router.refresh()`.
6. Entrar a `/panel/horas` y confirmar que las horas de ese empleado ahora reflejan la corrección.

- [ ] **Step 6: Commit**

```bash
git add app/panel/horas/pendientes/ components/formulario-correccion.tsx app/panel/horas/page.tsx
git commit -m "$(cat <<'EOF'
Agregar vista de pendientes de revisión y formulario de corrección

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Mostrar la corrección vigente en el historial del admin

**Files:**
- Modify: `app/panel/historial/page.tsx`

- [ ] **Step 1: Traer las correcciones junto con las anotaciones**

Después del bloque que arma `anotacionesPorEvento` en `app/panel/historial/page.tsx`, agregar la consulta y el mapa de correcciones (una corrección se muestra en el evento que ABRE el tramo, es decir cuando `evento.id === correccion.opens_event_id`):

Reemplazar:

```tsx
  const anotacionesPorEvento = new Map<string, { motivo: string; created_at: string }[]>();
  for (const anotacion of anotaciones ?? []) {
    const lista = anotacionesPorEvento.get(anotacion.clock_event_id) ?? [];
    lista.push(anotacion);
    anotacionesPorEvento.set(anotacion.clock_event_id, lista);
  }
```

con:

```tsx
  const anotacionesPorEvento = new Map<string, { motivo: string; created_at: string }[]>();
  for (const anotacion of anotaciones ?? []) {
    const lista = anotacionesPorEvento.get(anotacion.clock_event_id) ?? [];
    lista.push(anotacion);
    anotacionesPorEvento.set(anotacion.clock_event_id, lista);
  }

  const { data: correcciones } =
    idsEventos.length > 0
      ? await supabase
          .from("clock_event_corrections")
          .select("opens_event_id, corrected_closing_ts, reason, created_at")
          .in("opens_event_id", idsEventos)
          .order("created_at", { ascending: false })
      : { data: [] };

  // La vigente es la más reciente por opens_event_id — al venir ya
  // ordenada desc por created_at, la primera que se ve por id es la que
  // se queda.
  const correccionVigentePorEvento = new Map<string, { corrected_closing_ts: string; reason: string; created_at: string }>();
  for (const correccion of correcciones ?? []) {
    if (!correccionVigentePorEvento.has(correccion.opens_event_id)) {
      correccionVigentePorEvento.set(correccion.opens_event_id, correccion);
    }
  }
```

- [ ] **Step 2: Mostrarla en cada `<li>`**

Dentro del `.map((evento) => { ... })`, después de la línea `const misAnotaciones = anotacionesPorEvento.get(evento.id) ?? [];`, agregar:

```tsx
                const correccion = correccionVigentePorEvento.get(evento.id);
```

Y después del bloque `{misAnotaciones.length > 0 && (...)}`, agregar:

```tsx
                {correccion && (
                  <div className="flex flex-col gap-1 rounded-md bg-primary-tint px-3 py-2 text-xs text-ink">
                    <p>
                      <span className="font-medium">Corrección vigente</span> ({formatearFecha(correccion.created_at)}):
                      cierre real {formatearFechaHoraCorta(correccion.corrected_closing_ts)} — {correccion.reason}
                    </p>
                  </div>
                )}
```

- [ ] **Step 3: Verificación manual**

Con una corrección ya creada (de la Task 6), entrar a `/panel/historial`, confirmar que el evento de apertura correspondiente muestra el bloque "Corrección vigente" con la hora y el motivo correctos.

- [ ] **Step 4: Commit**

```bash
git add app/panel/historial/page.tsx
git commit -m "$(cat <<'EOF'
Mostrar la corrección vigente junto al fichaje que corrige en el historial

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Historial propio del empleado

**Files:**
- Create: `app/mi-cuenta/historial/page.tsx`
- Modify: `app/mi-cuenta/page.tsx`

- [ ] **Step 1: Página de historial propio**

Crear `app/mi-cuenta/historial/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { formatearFechaHoraCorta, formatearFecha } from "@/lib/formato-fecha";

export default async function PaginaHistorialPropio() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!empleado) redirect("/panel");

  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - 30);

  const { data: eventos } = await supabase
    .from("clock_events")
    .select("id, event_type, source, device_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly")
    .eq("employee_id", empleado.id)
    .gte("device_ts", desde.toISOString())
    .order("device_ts", { ascending: false });

  const idsEventos = (eventos ?? []).map((e) => e.id);
  const { data: correcciones } =
    idsEventos.length > 0
      ? await supabase
          .from("clock_event_corrections")
          .select("opens_event_id, corrected_closing_ts, reason, created_at")
          .in("opens_event_id", idsEventos)
          .order("created_at", { ascending: false })
      : { data: [] };

  const correccionVigentePorEvento = new Map<string, { corrected_closing_ts: string; reason: string; created_at: string }>();
  for (const correccion of correcciones ?? []) {
    if (!correccionVigentePorEvento.has(correccion.opens_event_id)) {
      correccionVigentePorEvento.set(correccion.opens_event_id, correccion);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Tu historial</h1>
      <p className="text-sm text-muted">Últimos 30 días.</p>

      {!eventos || eventos.length === 0 ? (
        <p className="text-muted">No hay fichajes en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventos.map((evento) => {
            const correccion = correccionVigentePorEvento.get(evento.id);
            return (
              <li key={evento.id} className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{ETIQUETA_EVENTO[evento.event_type as TipoEvento]}</span>
                  <span className="text-sm text-muted">{formatearFechaHoraCorta(evento.device_ts)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span>{ETIQUETA_ORIGEN[evento.source] ?? evento.source}</span>
                  {marcasDelEvento(evento).map((marca) => (
                    <span key={marca} className={marca === "En vivo" ? "" : "font-medium text-danger"}>
                      · {marca}
                    </span>
                  ))}
                </div>
                {correccion && (
                  <div className="flex flex-col gap-1 rounded-md bg-primary-tint px-3 py-2 text-xs text-ink">
                    <p>
                      <span className="font-medium">Corrección</span> ({formatearFecha(correccion.created_at)}): cierre real{" "}
                      {formatearFechaHoraCorta(correccion.corrected_closing_ts)} — {correccion.reason}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/mi-cuenta" className="text-sm font-medium text-primary hover:underline">
        ← Volver
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Enlace desde `/mi-cuenta`**

En `app/mi-cuenta/page.tsx`, dentro del `return` final (el que muestra `PantallaFichaje`), ubicar:

```tsx
      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario">
          Cerrar sesión
        </Boton>
      </form>
```

y agregar el enlace justo antes:

```tsx
      <Link href="/mi-cuenta/historial" className="text-center text-sm font-medium text-primary hover:underline">
        Ver mi historial
      </Link>

      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario">
          Cerrar sesión
        </Boton>
      </form>
```

Agregar el import de `Link` al inicio del archivo si no está ya:

```tsx
import Link from "next/link";
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build limpio, sin rutas nuevas con errores.

- [ ] **Step 4: Verificación manual**

Loguear como el empleado de prueba en `/mi-cuenta`, tocar "Ver mi historial", confirmar que se ven los fichajes de los últimos 30 días y, si hay una corrección vigente sobre alguno, que se muestra debajo del evento correspondiente.

- [ ] **Step 5: Commit**

```bash
git add app/mi-cuenta/historial/ app/mi-cuenta/page.tsx
git commit -m "$(cat <<'EOF'
Agregar historial propio del empleado con correcciones visibles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Build final, push y despliegue

**Files:** ninguno (solo verificación y despliegue)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build limpio, todas las rutas nuevas (`/panel/horas/pendientes`, `/mi-cuenta/historial`) listadas sin error.

- [ ] **Step 2: Correr toda la suite de regresión existente, para confirmar que nada se rompió**

Run: `node scripts/test-fichaje-flow.mjs && node scripts/test-horas-flow.mjs && node scripts/test-kiosco-flow.mjs && node scripts/test-correcciones-fichajes.mjs`
Expected: los cuatro terminan con "Todas las pruebas... pasan." y exit code 0.

- [ ] **Step 3: Push**

Run: `git push origin main`

- [ ] **Step 4: Deploy a producción**

Run: `vercel deploy --prod --yes`
Expected: deployment listo, sin errores de build en Vercel.

- [ ] **Step 5: Smoke test en producción**

En el navegador, contra `https://reloj-checador-chi.vercel.app`: repetir el flujo manual de la Task 6 Step 5 (insertar un turno abierto de prueba vía service role, confirmar que aparece en pendientes, corregirlo, confirmar que las horas se actualizan) — usando una empresa/empleado de prueba que se borre al terminar (mismo patrón que `scripts/smoke-test-limpiar.mjs` de la sesión anterior).

- [ ] **Step 6: Actualizar `openspec/changes/mvp-reloj-checador/tasks.md`**

Agregar una entrada bajo el grupo 8 (Historial y reportes) o como ítem nuevo documentando que se implementó la corrección de fichajes con efecto real en el cómputo de horas, con referencia a la spec y este plan.

---

## Self-review

**Cobertura de la spec:**
- Detección por umbral de horas (16h, turnos y descansos) → Task 1 (`tramos_pendientes_revision`), Task 3/4 (auto-flag).
- Visibilidad solo en tablero, sin correo/push → Task 6 (`/panel/horas/pendientes`), nada de email agregado.
- Corrección de hora libre con validaciones básicas → Task 6 Step 1 (`crearCorreccion`: posterior a apertura, no futuro).
- Autorización admin-only → Task 1 Step 3 (RLS `is_company_member` en insert, igual que `clock_event_annotations`).
- Visibilidad pasiva del empleado, sin objeción → Task 8 (historial propio, solo lectura).
- Reportes de cumplimiento con ambas capas → cubierto parcialmente: Task 7 lo agrega al historial del admin en pantalla; **no** se agregó a los exports CSV/PDF (`app/api/panel/reportes/csv|pdf/route.ts`) — es un gap real de la spec (sección "Reportes de cumplimiento... deben incluir ambas capas"). Se deja fuera de este plan a propósito por alcance (los exports ya son bastante densos); si Paola lo quiere para v1, es una Task 10 corta que reutiliza `correccionVigentePorEvento` del mismo modo que la Task 7.
- `clock_events` intocable → ninguna task lo modifica, confirmado.

**Nota de alcance:** el gap de "corrección visible en CSV/PDF" arriba es la única pieza de la spec que este plan no cierra. Se lo señalo a Paola explícitamente al entregar el plan, no lo escondo.

**Consistencia de tipos:** `opens_event_id`, `employee_id`, `closes_event_id`, `corrected_closing_ts`, `reason` se usan con esos mismos nombres en la migración (Task 1), la server action (Task 6), y las lecturas (Task 7, Task 8) — verificado consistente en todo el plan.

**Placeholders:** ninguno — cada paso de código trae el archivo completo o el diff exacto a aplicar, sin "TODO" ni "similar a la Task N".
