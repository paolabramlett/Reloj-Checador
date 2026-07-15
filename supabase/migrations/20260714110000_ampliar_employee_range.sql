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
