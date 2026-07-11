-- Onboarding y consentimiento del empleado. Dos documentos versionados,
-- de plataforma (no por empresa): el acuerdo con el sistema de registro
-- (le da valor de "prueba plena" al fichaje pactado, según la
-- investigación legal) y el aviso de privacidad (LFPDPPP, DOF
-- 20-03-2025). El texto sembrado acá es un BORRADOR — design.md ya deja
-- anotado que necesita revisión de un laboralista antes de producción.

create table public.consent_documents (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('system_agreement', 'privacy_notice')),
  version     integer not null check (version > 0),
  body        text not null,
  created_at  timestamptz not null default now(),
  unique (type, version)
);

alter table public.consent_documents enable row level security;

-- Contenido público: cualquiera (con sesión o sin ella, como el kiosco)
-- necesita poder leer el texto vigente para poder aceptarlo.
create policy consent_documents_select on public.consent_documents
  for select using (true);

-- Constancias de aceptación. Con company_id propio (no solo vía join a
-- employees) para que las políticas de admin sean simples y directas.
-- Inmutables por diseño: son un registro legal, nunca se editan ni se
-- borran — ni siquiera al cambiar de versión, que es justo el mecanismo
-- que conserva el historial cuando toca re-aceptar.
create table public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  employee_id   uuid not null references public.employees (id),
  document_id   uuid not null references public.consent_documents (id),
  source        text not null check (source in ('personal_phone', 'kiosk')),
  accepted_at   timestamptz not null default now(),
  unique (employee_id, document_id)
);

alter table public.consent_records enable row level security;

create policy consent_records_select_admin on public.consent_records
  for select using (public.is_company_member(company_id));

create policy consent_records_select_self on public.consent_records
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = consent_records.employee_id
        and e.auth_user_id = (select auth.uid())
    )
  );

-- Solo el propio empleado registra su aceptación en modo personal; el
-- kiosco (sin sesión) lo hace vía service role, igual que sus fichajes.
create policy consent_records_insert_self on public.consent_records
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = consent_records.employee_id
        and e.auth_user_id = (select auth.uid())
        and e.company_id = consent_records.company_id
    )
  );

insert into public.consent_documents (type, version, body) values
(
  'system_agreement',
  1,
  'Al aceptar, estás de acuerdo en que Reloj Checador registre tu entrada, salida y descansos como parte del control de asistencia de tu trabajo.

Cuando fiches desde tu propio teléfono, se guarda tu ubicación en el momento exacto en que tocas el botón — nunca antes ni después, y nunca te seguimos durante el día.

Cuando fiches desde el kiosco (una tablet o teléfono fijo en tu lugar de trabajo), se toma una foto tuya como evidencia de que fuiste tú quien fichó. Esa foto no se usa para reconocimiento facial ni para ningún otro fin.

Este acuerdo, junto con tu registro de fichajes, tiene valor como prueba ante una autoridad laboral, precisamente porque lo aceptaste tú.'
),
(
  'privacy_notice',
  1,
  'Aviso de privacidad

Tu empleador usa Reloj Checador para cumplir con la obligación legal de llevar un registro de asistencia (Ley Federal del Trabajo, artículo 132, fracción XXXIV).

Datos que tratamos: tu nombre, tus fichajes (fecha y hora de entrada, salida y descansos), tu ubicación únicamente en el momento de fichar desde tu teléfono, y una fotografía si fichas desde un kiosco.

Para qué los usamos: exclusivamente para llevar el registro de asistencia que exige la ley y para que tu empleador pueda calcular tus horas trabajadas.

Cuánto tiempo los guardamos: mientras dure tu relación laboral y un año más después de que termine, tal como lo exige el artículo 804 de la Ley Federal del Trabajo.

Con quién los compartimos: con nadie fuera de tu empleador, salvo que una autoridad laboral lo solicite conforme a la ley.

Tus derechos: puedes pedirle a tu empleador acceder a tus datos, corregirlos, o preguntar cómo se usan, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.'
);
