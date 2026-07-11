-- Modo kiosco: el dispositivo no tiene sesión de Supabase Auth (nadie
-- "inicia sesión" en la tablet compartida). Se autentica por posesión de
-- un token de larga vida, igual que las invitaciones — el mismo patrón
-- ya usado en el grupo 2, aplicado a un dispositivo en vez de a una
-- persona. Todo el tráfico del kiosco pasa por rutas que usan la service
-- role key (sin sesión no hay RLS que aplicar); la admisión pasa por
-- validar el token a mano en cada request.

create table public.kiosk_devices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  work_center_id  uuid not null references public.work_centers (id),
  name            text not null default 'Kiosco' check (char_length(name) between 1 and 100),
  token_hash      text not null unique,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz
);

alter table public.kiosk_devices enable row level security;

create policy kiosk_devices_select on public.kiosk_devices
  for select using (public.is_company_member(company_id));

create policy kiosk_devices_insert on public.kiosk_devices
  for insert with check (public.is_company_member(company_id));

-- Solo para revocar (set revoked_at). No hay UPDATE de token_hash desde
-- la app: regenerar significa dar de baja este dispositivo y registrar uno
-- nuevo, no reescribir el token de un registro existente.
create policy kiosk_devices_update on public.kiosk_devices
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Bloqueo de PIN por empleado. Sin políticas para authenticated/anon:
-- solo lo toca la service role desde las rutas de kiosco. RLS igual
-- queda habilitado por consistencia y como cierre por defecto.
create table public.pin_lockouts (
  employee_id        uuid primary key references public.employees (id),
  intentos_fallidos  integer not null default 0,
  bloqueado_hasta     timestamptz
);

alter table public.pin_lockouts enable row level security;

-- Umbrales del bloqueo, junto a los otros umbrales operativos del grupo 4
-- (misma tabla singleton: "umbrales en tabla de configuración, no en código").
alter table public.system_settings
  add column pin_lockout_attempts integer not null default 5,
  add column pin_lockout_minutes integer not null default 5;

-- Selfies: bucket privado. La subida la hace la service role (sin sesión
-- de kiosco que RLS pueda evaluar); la lectura queda reservada a
-- administradores de la empresa dueña del archivo, vía URL firmada.
-- Convención de ruta: {company_id}/{clock_event_id}.jpg — el primer
-- segmento es lo que la política de storage usa para decidir acceso.
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do nothing;

create policy selfies_select_admin on storage.objects
  for select using (
    bucket_id = 'selfies'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );
