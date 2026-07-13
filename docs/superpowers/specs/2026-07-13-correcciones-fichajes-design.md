# Corrección de fichajes faltantes o mal cerrados

**Fecha:** 2026-07-13
**Estado:** aprobado por Paola, pendiente de plan de implementación
**Investigación previa:** [docs/research/correcciones-fichajes-y-stps.md](../../research/correcciones-fichajes-y-stps.md)

## Problema

`clock_events` es append-only por diseño (RLS niega UPDATE/DELETE a todos, incluida la service role): es la base del argumento de confianza del producto ("un registro que no se puede alterar"). Pero eso significa que hoy no hay ninguna forma de que un turno mal cerrado — o nunca cerrado — termine reflejado correctamente en el cómputo de horas semanales:

- Un evento marcado `flag_sequence_anomaly = true` queda **excluido por completo** del cómputo de horas (`weekly_hours_for_employee`, ver `supabase/migrations/20260713190000_horas_usar_device_ts.sql`).
- Un turno que se queda abierto (`clock_in` sin `clock_out`) y luego se "pisa" por un evento posterior pierde silenciosamente sus horas — no se sobreescribe con nada, simplemente no cuenta.
- Las anotaciones de corrección que ya existen (`clock_event_annotations`, formulario en el historial) son puramente cosméticas: no cambian el cómputo de horas ni limpian la bandera de anomalía. Son una nota para humanos, no una entrada al cálculo.

Motivado por un caso real de Paola probando la app: un fichaje de "fin de descanso" llegó marcado como anomalía por una condición de carrera en la cola offline (ya corregida por separado, ver commit `f29b3ec`). Al investigar qué pasaba con ese tipo de casos, encontramos que **no hay ningún mecanismo, ni cosmético ni real, para que un admin corrija un turno y que esa corrección cuente**.

## Alcance de esta spec

Cubre exclusivamente: turnos o descansos que quedan abiertos sin cierre, o que se cierran tan tarde que el resultado es sospechoso. No cubre: fichajes duplicados, fichajes fuera de geocerca, ni renegociar el modelo de anomalías por condición de carrera (ya resuelto). Tampoco cubre notificaciones por correo/push — quedan fuera de esta versión.

## Decisiones (de la sesión de brainstorming con Paola)

1. **Detección: umbral de horas, no rastreo de geocerca.** Chekly no hace seguimiento pasivo de ubicación (solo se registra al tocar el botón), así que no hay forma de detectar "salió de la geocerca" como evento. La única señal disponible es tiempo transcurrido sin un evento de cierre.
2. **Umbral: 16 horas**, aplicado igual a turnos (`clock_in`→`clock_out`) y a descansos (`break_start`→`break_end`). Cubre turnos dobles ocasionales sin marcar de más, y atrapa el caso típico de "se le olvidó marcar y ya pasó la noche".
3. **Visibilidad: solo en el tablero del admin.** Sin correo ni push en esta versión — Chekly no tiene ningún sistema de notificaciones hoy, y construir uno es un esfuerzo aparte que no se justifica todavía.
4. **Cierre tardío normal (no-corrección) de un tramo largo: se deja cerrar, pero se marca `flag_sequence_anomaly` automáticamente** si el tramo resultante supera las 16 horas — aunque la transición en sí sea válida según la máquina de estados. Esto evita que un "Marcar salida" accidental al día siguiente cuente como 20+ horas trabajadas sin que nadie lo revise.
5. **Corrección de hora: libre, con validaciones básicas.** El admin puede capturar cualquier hora, siempre que sea posterior al evento que abre el tramo y no esté en el futuro. Sin tope máximo de horas por turno — hay giros con turnos largos legítimos (seguridad, guardias) y la responsabilidad de que sea verdad recae en el admin, con motivo obligatorio como respaldo.
6. **Autorización: admin de la empresa, sin segundo aprobador.** No hay flujo de "empleado propone / manager aprueba" en v1 — encaja con el perfil de cliente de Chekly (dueño único que probablemente también hace nómina). Queda como posible v2 si algún cliente lo pide.
7. **Objeción del empleado: visibilidad pasiva, sin flujo formal.** El empleado ve el evento original (marcado, p. ej., "sin salida registrada") y, si existe, la corrección con motivo, quién la hizo y cuándo — en su propio historial. No hay botón de "objetar" dentro de la app; si no está de acuerdo, se resuelve fuera del sistema. El punto de esta visibilidad es que quede documentado y consultable, no arbitrar el conflicto.

## Modelo de datos

### Tabla nueva: `clock_event_corrections`

```sql
create table public.clock_event_corrections (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id),
  employee_id           uuid not null references public.employees (id),
  -- El evento que ABRE el tramo que se está corrigiendo: un clock_in
  -- (corrige un turno) o un break_start (corrige un descanso). Siempre
  -- existe — es el ancla de la corrección.
  opens_event_id        uuid not null references public.clock_events (id),
  -- El evento de cierre real, SI existe pero quedó flageado (p. ej. un
  -- clock_out marcado flag_sequence_anomaly por ser demasiado tardío).
  -- Null cuando el tramo nunca se cerró en absoluto.
  closes_event_id       uuid references public.clock_events (id),
  corrected_closing_ts  timestamptz not null,
  reason                text not null check (char_length(reason) > 0),
  created_by            uuid not null references auth.users (id),
  created_at            timestamptz not null default now()
);
```

- **Append-only**, igual que `clock_events`: RLS niega UPDATE/DELETE a todos. Si una corrección está mal, se inserta una fila nueva para el mismo `opens_event_id` — la vigente es la más reciente por `created_at` (mismo patrón de versionado que `consent_documents`).
- RLS de INSERT: solo admins/dueños de la empresa (reutilizar el helper `is_company_owner` o equivalente ya existente).
- RLS de SELECT: miembros de la empresa (admins) y el propio empleado dueño del `employee_id` (para la visibilidad pasiva del punto 7).
- Validación a nivel aplicación (no necesariamente constraint SQL): `corrected_closing_ts` > `device_ts` del `opens_event_id`, y `corrected_closing_ts` ≤ ahora.

### Cambios a `weekly_hours_for_employee`

Al iterar eventos cronológicamente (por `device_ts`, ya migrado en `20260713190000_horas_usar_device_ts.sql`), cuando la función encuentra un tramo sin cierre válido dentro de la ventana de la semana — ya sea porque el evento de apertura no tiene cierre, o porque su cierre natural está `flag_sequence_anomaly = true` — busca una corrección vigente para ese `opens_event_id`:

- Si existe, usa `corrected_closing_ts` como la hora de cierre para ese tramo (en vez de excluirlo).
- Si no existe, se mantiene el comportamiento actual (excluir, con la alerta del tablero avisando que falta revisión).

### Nuevo umbral configurable

Agregar `open_shift_threshold_hours` (default 16) a `system_settings`, siguiendo el mismo patrón que `late_sync_threshold_seconds` / `clock_skew_threshold_seconds` ya existentes.

## Detección de "posible olvido" (tablero)

Consulta (no una columna nueva en `clock_events`) que, para cada empleado activo, busca el último evento cuyo tipo abre un tramo (`clock_in` o `break_start`) sin un cierre correspondiente posterior, y cuya antigüedad supera `open_shift_threshold_hours`. Se muestra en una vista de admin — probablemente una sección nueva dentro de `/panel/horas` o una ruta dedicada — junto con cualquier evento ya marcado `flag_sequence_anomaly = true` sin corrección vigente, ambos con un botón "Corregir" que abre el formulario descrito abajo.

## Auto-flag de cierre tardío

En `app/api/fichar/route.ts` (y el equivalente de kiosco), al procesar un `clock_out` o `break_end`: si la duración resultante del tramo (evento actual `device_ts` − `device_ts` del evento de apertura correspondiente) supera `open_shift_threshold_hours`, marcar `flag_sequence_anomaly = true` en el insert — aunque `transicionEsValida` haya dado `true`. Esto es una condición adicional a la validación de secuencia existente, no un reemplazo.

## UI: formulario de corrección

Formulario simple (server action), reutilizando el patrón de `formulario-anotacion.tsx`:

- Selector implícito por el tramo que se está corrigiendo (se llega desde el listado de "posible olvido"/anomalías, no se busca el evento a mano).
- Campo de hora (date+time) para `corrected_closing_ts`, con la validación básica del punto 5.
- Campo de motivo, obligatorio.
- Al guardar: inserta en `clock_event_corrections`, no toca `clock_events`.

## Vista del empleado

Verificado: hoy `/mi-cuenta` solo consulta `clock_events` para determinar el estado actual (último evento), no existe ninguna vista de historial propio para el empleado. Esta spec incluye construir una mínima: una lista de sus fichajes recientes (mismo alcance de fechas que el historial del admin, o los últimos N días) mostrando cada evento con su marca (p. ej. "sin salida registrada" o "anomalía de secuencia"), y si hay corrección vigente, mostrarla justo debajo: hora corregida, motivo, quién la hizo, cuándo. Sin acción disponible para el empleado sobre esa corrección — solo lectura.

## Fuera de alcance para v1

- Notificaciones por correo/push cuando se detecta un "posible olvido".
- Flujo de aprobación del empleado (proponer/objetar dentro de la app).
- Corrección de casos más exóticos: secuencias con múltiples eventos del mismo tipo consecutivos, fichajes duplicados, fichajes fuera de geocerca. Estos se quedan como "el admin revisa el historial y decide" sin herramienta dedicada.
- Tope máximo configurable de horas por turno para la corrección misma (el admin puede capturar cualquier hora futura-válida, sin límite superior).

## Riesgos / cosas a validar durante la implementación

- Confirmar que el helper de autorización de admin ya existente (`obtenerAccesoAdmin` o el que aplique) es el correcto para gatear el INSERT en `clock_event_corrections` — debe ser consistente con quién puede ver/editar el resto de `/panel`.
- El auto-flag de cierre tardío debe convivir con la detección de anomalía de secuencia existente sin pisarla — son dos condiciones independientes que pueden coexistir en el mismo evento.
- Este diseño está pendiente de revisión por un laboralista antes de publicarse (ya señalado en la investigación previa) — no bloquea construirlo, pero sí bloquea que los textos/flujo se den por definitivos de cara a una inspección real.
