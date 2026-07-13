-- weekly_hours_for_employee usaba server_ts (cuándo llegó el fichaje al
-- servidor) tanto para el filtro de la semana como para el cómputo de
-- horas trabajadas. Eso es incorrecto: server_ts es metadata de
-- sincronización (para detectar late_sync/clock_skew), no la hora real
-- del fichaje — esa es device_ts (cuándo la persona tocó el botón).
--
-- Encontrado por un caso real: dos fichajes casi simultáneos pueden
-- llegar al servidor en un orden distinto al que pasaron, lo que además
-- de romper la lectura cronológica en reportes/historial (arreglado por
-- separado en el código de la app), también podía distorsionar el
-- cómputo de horas si un evento con server_ts fuera de orden quedaba
-- emparejado con el evento equivocado.
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
    select event_type, device_ts
    from public.clock_events
    where employee_id = p_employee_id
      and device_ts >= p_week_start::timestamptz
      and device_ts < v_week_end
      and flag_sequence_anomaly = false
    order by device_ts asc
  loop
    if v_event.event_type = 'clock_in' then
      v_shift_start := v_event.device_ts;
      v_break_accum := '0'::interval;
    elsif v_event.event_type = 'break_start' then
      v_break_start := v_event.device_ts;
    elsif v_event.event_type = 'break_end' then
      if v_break_start is not null then
        v_break_accum := v_break_accum + (v_event.device_ts - v_break_start);
        v_break_start := null;
      end if;
    elsif v_event.event_type = 'clock_out' then
      if v_shift_start is not null then
        v_total := v_total + (v_event.device_ts - v_shift_start) - v_break_accum;
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
