-- Esquema base multi-tenant: cuentas → empresas → centros de trabajo → empleados.
-- RLS queda HABILITADO en todas las tablas desde su creación (deny-all);
-- las políticas llegan en la siguiente migración para que ninguna ventana
-- de despliegue deje datos expuestos.

create extension if not exists pgcrypto;

-- ── Empresas ────────────────────────────────────────────────────────────────

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  created_at  timestamptz not null default now()
);

alter table public.companies enable row level security;

-- Membresías: qué usuarios administran qué empresa. Una cuenta puede
-- administrar varias empresas (canal de contadores a futuro).
create table public.company_members (
  company_id  uuid not null references public.companies (id),
  user_id     uuid not null references auth.users (id),
  role        text not null check (role in ('owner', 'admin')),
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

alter table public.company_members enable row level security;

-- ── Centros de trabajo ──────────────────────────────────────────────────────

create table public.work_centers (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id),
  name               text not null check (char_length(name) between 1 and 200),
  lat                double precision not null check (lat between -90 and 90),
  lng                double precision not null check (lng between -180 and 180),
  -- Radio generoso por defecto: el GPS urbano rebota (design.md, decisión 9).
  geofence_radius_m  integer not null default 100 check (geofence_radius_m between 10 and 5000),
  created_at         timestamptz not null default now()
);

alter table public.work_centers enable row level security;
create index work_centers_company_idx on public.work_centers (company_id);

-- ── Empleados ───────────────────────────────────────────────────────────────

create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  work_center_id  uuid not null references public.work_centers (id),
  full_name       text not null check (char_length(full_name) between 1 and 200),
  status          text not null default 'active' check (status in ('active', 'terminated')),
  -- Baja: fecha de extinción de la relación laboral. Arranca el plazo de
  -- retención del art. 804 LFT; el registro del empleado jamás se borra.
  terminated_at   timestamptz,
  -- Hash determinista del PIN (sha256 de company_id:pin) para modo kiosco:
  -- permite verificar y garantizar unicidad por empresa con un índice.
  -- La defensa real contra fuerza bruta es el bloqueo por intentos (spec
  -- time-clock), no la entropía del PIN.
  pin_hash        text,
  -- Vinculación a sesión propia para modo teléfono personal (tarea 2.6).
  auth_user_id    uuid unique references auth.users (id),
  created_at      timestamptz not null default now(),
  constraint terminated_needs_date check (
    (status = 'terminated') = (terminated_at is not null)
  )
);

alter table public.employees enable row level security;
create index employees_company_idx on public.employees (company_id);
create unique index employees_pin_unique_per_company
  on public.employees (company_id, pin_hash)
  where pin_hash is not null;
