-- Invitaciones para que un empleado reclame sesión propia en su teléfono
-- (modo personal). El token nunca se guarda en texto plano — solo su hash —
-- porque la posesión del token ES la credencial de autorización: quien
-- redime el link todavía no tiene sesión, así que ese paso corre con la
-- service role key, deliberadamente por fuera de RLS.

create table public.employee_invitations (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null unique references public.employees (id),
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.employee_invitations enable row level security;

-- Solo miembros de la empresa dueña del empleado pueden generar/consultar
-- su invitación. No hay política para anónimos: el canje pasa por el
-- cliente de service role, que ignora RLS por completo.
create policy invitations_select on public.employee_invitations
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = employee_invitations.employee_id
        and public.is_company_member(e.company_id)
    )
  );

create policy invitations_insert on public.employee_invitations
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_invitations.employee_id
        and public.is_company_member(e.company_id)
    )
  );

create policy invitations_update on public.employee_invitations
  for update using (
    exists (
      select 1 from public.employees e
      where e.id = employee_invitations.employee_id
        and public.is_company_member(e.company_id)
    )
  ) with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_invitations.employee_id
        and public.is_company_member(e.company_id)
    )
  );
