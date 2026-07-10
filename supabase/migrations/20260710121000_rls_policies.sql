-- Políticas RLS del esquema multi-tenant. Regla de oro (spec
-- multi-tenant-accounts): ningún usuario ve datos de una empresa que no
-- administra o a la que no pertenece; los datos ajenos responden como
-- inexistentes.

-- ── Helpers ────────────────────────────────────────────────────────────────
-- security definer para no recursar sobre las políticas de company_members.

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_company_owner(target_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Alta atómica de empresa: crea la empresa y la membresía owner en una sola
-- operación, evitando el estado intermedio "empresa sin dueño".
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  insert into public.companies (name) values (company_name) returning id into new_id;
  insert into public.company_members (company_id, user_id, role)
    values (new_id, (select auth.uid()), 'owner');
  return new_id;
end;
$$;

-- ── companies ──────────────────────────────────────────────────────────────

create policy companies_select on public.companies
  for select using (public.is_company_member(id));

create policy companies_update on public.companies
  for update using (public.is_company_owner(id))
  with check (public.is_company_owner(id));

-- Sin política de INSERT directo (se usa create_company_with_owner) ni DELETE.

-- ── company_members ────────────────────────────────────────────────────────

create policy members_select on public.company_members
  for select using (
    user_id = (select auth.uid()) or public.is_company_member(company_id)
  );

create policy members_insert on public.company_members
  for insert with check (public.is_company_owner(company_id));

create policy members_delete on public.company_members
  for delete using (
    public.is_company_owner(company_id)
    and user_id <> (select auth.uid()) -- un owner no puede dejar la empresa sin dueño
  );

-- ── work_centers ───────────────────────────────────────────────────────────

create policy work_centers_select on public.work_centers
  for select using (public.is_company_member(company_id));

create policy work_centers_insert on public.work_centers
  for insert with check (public.is_company_member(company_id));

create policy work_centers_update on public.work_centers
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- ── employees ──────────────────────────────────────────────────────────────

create policy employees_select on public.employees
  for select using (
    public.is_company_member(company_id)
    or auth_user_id = (select auth.uid()) -- el empleado ve su propio perfil
  );

create policy employees_insert on public.employees
  for insert with check (public.is_company_member(company_id));

create policy employees_update on public.employees
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Sin DELETE: las bajas son cambio de status y conservan registros (art. 804 LFT).
