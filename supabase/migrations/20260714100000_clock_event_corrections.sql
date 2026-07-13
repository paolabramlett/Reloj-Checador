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
