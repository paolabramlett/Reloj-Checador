-- Anotaciones de corrección (spec compliance-reporting: "Inmutabilidad de
-- los registros"). El fichaje original nunca se toca — esto es una nota
-- aparte, vinculada, firmada por quién y cuándo. Tampoco se editan ni se
-- borran una vez creadas: son parte del expediente.
create table public.clock_event_annotations (
  id              uuid primary key default gen_random_uuid(),
  clock_event_id  uuid not null references public.clock_events (id),
  company_id      uuid not null references public.companies (id),
  created_by      uuid not null references auth.users (id),
  motivo          text not null check (char_length(motivo) between 1 and 1000),
  created_at      timestamptz not null default now()
);

alter table public.clock_event_annotations enable row level security;

create index clock_event_annotations_event_idx on public.clock_event_annotations (clock_event_id);

create policy clock_event_annotations_select on public.clock_event_annotations
  for select using (public.is_company_member(company_id));

create policy clock_event_annotations_insert on public.clock_event_annotations
  for insert with check (
    public.is_company_member(company_id)
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.clock_events ce
      where ce.id = clock_event_annotations.clock_event_id
        and ce.company_id = clock_event_annotations.company_id
    )
  );

-- Sin políticas de UPDATE/DELETE: inmutables, igual que el fichaje que anotan.
