-- Bug encontrado probando /mi-cuenta en el navegador: un empleado podía
-- leer su propia ficha (employees_select_self, migración 2.2) pero no el
-- work_center al que está asignado, así que el SELECT embebido
-- `employees(...).select("work_centers(...)")` volvía null por RLS y la
-- pantalla de fichaje explotaba con "Cannot read properties of null".
--
-- El empleado solo puede ver el centro al que está asignado — no los
-- demás centros de la empresa, que siguen siendo cosa del administrador.
create policy work_centers_select_self on public.work_centers
  for select using (
    exists (
      select 1 from public.employees e
      where e.work_center_id = work_centers.id
        and e.auth_user_id = (select auth.uid())
    )
  );
