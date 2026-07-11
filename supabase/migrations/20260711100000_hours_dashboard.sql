-- Tablero de horas: límites legales como datos (design.md, decisión 7) y
-- una función que deriva las horas semanales SIEMPRE desde los eventos
-- crudos de clock_events — nunca desde un total guardado aparte, para que
-- el cómputo sea reproducible y auditable.

create table public.legal_limits (
  year          integer primary key,
  weekly_hours  numeric not null check (weekly_hours > 0)
);

alter table public.legal_limits enable row level security;

create policy legal_limits_select on public.legal_limits
  for select using (true);

insert into public.legal_limits (year, weekly_hours) values
  (2026, 48), (2027, 46), (2028, 44), (2029, 42), (2030, 40);

-- Años posteriores a 2030 (la reforma ya asentada en 40h) resuelven al
-- último año sembrado — no hace falta insertar una fila nueva cada año.
create or replace function public.legal_weekly_hours(p_year integer)
returns numeric
language sql stable
as $$
  select weekly_hours from public.legal_limits
  where year <= p_year
  order by year desc
  limit 1;
$$;

-- Horas trabajadas de un empleado en una semana [p_week_start, +7 días).
-- Empareja clock_in/clock_out y descuenta los descansos cerrados entre
-- medio; un turno o descanso todavía abierto al momento de la consulta
-- cuenta hasta ahora (spec: "ve las horas acumuladas... a ese momento").
-- Los eventos marcados como anomalía de secuencia quedan fuera del
-- cómputo automático (tasks.md 7.1) — entran manualmente vía anotaciones
-- en el grupo 8, no acá.
create or replace function public.weekly_hours_for_employee(
  p_employee_id uuid,
  p_week_start date
)
returns numeric
language plpgsql stable
as $$
declare
  v_event          record;
  v_shift_start    timestamptz;
  v_break_start    timestamptz;
  v_break_accum    interval := '0'::interval;
  v_total          interval := '0'::interval;
  v_week_end       timestamptz := (p_week_start::timestamptz + interval '7 days');
  v_hasta          timestamptz;
  v_break_pendiente interval;
begin
  for v_event in
    select event_type, server_ts
    from public.clock_events
    where employee_id = p_employee_id
      and server_ts >= p_week_start::timestamptz
      and server_ts < v_week_end
      and flag_sequence_anomaly = false
    order by server_ts asc
  loop
    if v_event.event_type = 'clock_in' then
      v_shift_start := v_event.server_ts;
      v_break_accum := '0'::interval;
    elsif v_event.event_type = 'break_start' then
      v_break_start := v_event.server_ts;
    elsif v_event.event_type = 'break_end' then
      if v_break_start is not null then
        v_break_accum := v_break_accum + (v_event.server_ts - v_break_start);
        v_break_start := null;
      end if;
    elsif v_event.event_type = 'clock_out' then
      if v_shift_start is not null then
        v_total := v_total + (v_event.server_ts - v_shift_start) - v_break_accum;
        v_shift_start := null;
        v_break_accum := '0'::interval;
      end if;
    end if;
  end loop;

  if v_shift_start is not null then
    v_hasta := least(now(), v_week_end);
    v_break_pendiente := v_break_accum;
    if v_break_start is not null then
      v_break_pendiente := v_break_pendiente + (v_hasta - v_break_start);
    end if;
    v_total := v_total + (v_hasta - v_shift_start) - v_break_pendiente;
  end if;

  return round(extract(epoch from v_total) / 3600.0, 2);
end;
$$;
