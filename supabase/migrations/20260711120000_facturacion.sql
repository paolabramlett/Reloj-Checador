-- Facturación: el estado de suscripción vive en la empresa, actualizado
-- por los webhooks de Stripe (design.md, decisión 8). trial_ends_at se
-- fija sola al crear la empresa (30 días, sin tarjeta) vía el default.
alter table public.companies
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column trial_ends_at timestamptz not null default (now() + interval '30 days'),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  -- Único rango por ahora (design.md: los rangos superiores se calibran
  -- después). La columna ya existe para cuando haya más de uno.
  add column employee_range text not null default 'hasta_10'
    check (employee_range in ('hasta_10'));

-- La política companies_update (migración 2.2) ya deja al dueño
-- actualizar CUALQUIER columna de su empresa — incluidas estas nuevas.
-- RLS no filtra por columna, así que sin este trigger un dueño podría
-- escribir subscription_status = 'active' directo, sin pagar. Estas
-- columnas solo las toca el webhook de Stripe (service role, sin
-- auth.uid()); cualquier intento desde una sesión de usuario se revierte
-- en silencio, sin romper el resto del UPDATE (ej. renombrar la empresa).
create or replace function public.proteger_columnas_facturacion()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.employee_range := old.employee_range;
  end if;
  return new;
end;
$$;

create trigger proteger_columnas_facturacion_trigger
  before update on public.companies
  for each row execute function public.proteger_columnas_facturacion();
