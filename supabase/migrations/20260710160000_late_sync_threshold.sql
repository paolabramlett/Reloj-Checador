-- Segundo umbral configurable (design.md: "umbrales en tabla de
-- configuración, no en código"). El de clock_skew ya existía desde el
-- grupo 3; este es el que faltaba para detectar fichajes "sincronizados
-- tarde" ahora que existe una cola offline real que sí puede demorarlos.
alter table public.system_settings
  add column late_sync_threshold_seconds integer not null default 300;
