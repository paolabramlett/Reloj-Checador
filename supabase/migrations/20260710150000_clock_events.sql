-- Fichajes: tabla append-only. El id lo genera el CLIENTE (es la clave de
-- idempotencia — reintentos de red nunca duplican un registro). Sin
-- políticas de UPDATE/DELETE: son inmutables incluso para el dueño de la
-- empresa. Las correcciones futuras (grupo 8) viven en una tabla
-- `annotations` aparte, vinculada, que nunca reemplaza el original.

create table public.clock_events (
  id                     uuid primary key,
  company_id             uuid not null references public.companies (id),
  employee_id            uuid not null references public.employees (id),
  work_center_id         uuid not null references public.work_centers (id),
  event_type             text not null check (event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')),
  source                 text not null check (source in ('personal_phone', 'kiosk')),
  -- Doble timestamp (design.md, decisión 4): device_ts es el toque real del
  -- empleado; server_ts es cuándo lo recibimos. Offline-sync (grupo 4) es
  -- donde ambos empiezan a diferir de verdad.
  device_ts              timestamptz not null,
  server_ts              timestamptz not null default now(),
  lat                    double precision,
  lng                    double precision,
  selfie_path            text, -- solo modo kiosco (grupo 5)
  flag_out_of_fence      boolean not null default false,
  flag_clock_skew        boolean not null default false,
  flag_late_sync         boolean not null default false,
  flag_sequence_anomaly  boolean not null default false
);

alter table public.clock_events enable row level security;

create index clock_events_employee_idx on public.clock_events (employee_id, server_ts desc);
create index clock_events_company_idx on public.clock_events (company_id, server_ts desc);

create policy clock_events_select_admin on public.clock_events
  for select using (public.is_company_member(company_id));

create policy clock_events_select_self on public.clock_events
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = clock_events.employee_id
        and e.auth_user_id = (select auth.uid())
    )
  );

-- Solo el propio empleado inserta su fichaje, y solo mientras esté activo.
-- company_id/work_center_id deben coincidir con su ficha — última barrera
-- si algún día algo más que este endpoint escribe en la tabla.
create policy clock_events_insert_self on public.clock_events
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = clock_events.employee_id
        and e.auth_user_id = (select auth.uid())
        and e.status = 'active'
        and e.company_id = clock_events.company_id
        and e.work_center_id = clock_events.work_center_id
    )
  );

-- Configuración operativa (design.md: "umbrales en tabla de configuración,
-- no en código"). Patrón de fila única: la constraint de PK booleana
-- garantiza que nunca exista más de una fila.
create table public.system_settings (
  id boolean primary key default true,
  clock_skew_threshold_seconds integer not null default 300,
  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id) values (true);

alter table public.system_settings enable row level security;

create policy system_settings_select on public.system_settings
  for select using (true);
