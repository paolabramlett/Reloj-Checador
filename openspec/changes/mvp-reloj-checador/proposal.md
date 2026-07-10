# Proposal: MVP Reloj Checador

## Why

La LFT (art. 132 fracc. XXXIV, vigente desde el 1 de mayo de 2026) ya obliga a los patrones a llevar un registro electrónico de asistencia, y la reforma de 40 horas reduce la jornada gradualmente (48→40 h, 2026–2030) con disposiciones de la STPS entrando en vigor el 1 de enero de 2027. Millones de micro y pequeñas empresas mexicanas no tienen nada instalado y van a buscar una solución de bajo costo conforme se acerque 2027. Este MVP (meta: octubre 2026) captura esa ola con un producto de tarifa plana, listo antes de la estampida. El contexto estratégico completo vive en `PRODUCT.md` y la base legal en `docs/research/reforma-40-horas-reloj-checador.md`.

## What Changes

Proyecto greenfield: se construye la primera versión completa del producto.

- PWA (Next.js) con dos modos de fichaje: teléfono personal con geocerca, y kiosco en dispositivo compartido con PIN + selfie-evidencia (sin biometría).
- Registro de entradas, salidas y descansos, offline-first: cola local con doble timestamp (dispositivo + servidor) y marcado de registros sincronizados tarde.
- Arquitectura multi-tenant desde el día uno: una cuenta puede administrar varias empresas (pensando en el canal de contadores).
- Tablero semanal de horas por empleado con alerta paramétrica contra el límite legal vigente del año (46 h en 2027, bajando a 40 h en 2030).
- Reportes de asistencia exportables para inspecciones de la STPS, con retención conforme al art. 804 LFT (último año + 1 año tras extinguirse la relación).
- Onboarding del empleado que captura su acuerdo con el sistema de registro (valor probatorio de "prueba plena") y el aviso de privacidad (nueva LFPDPPP).
- Suscripciones con Stripe: tarifa plana por rangos de empleados (~$179 MXN/mes hasta 10), pago con tarjeta, OXXO y SPEI, descuento anual. CFDI manual por ahora.

Fuera de alcance del MVP: turnos/horarios programados, vacaciones y permisos, nómina, biometría con matching, vista multi-empresa para contadores (la arquitectura la permite; la UI llega después), CFDI automática, envoltorio nativo en tiendas.

## Capabilities

### New Capabilities

- `multi-tenant-accounts`: cuentas de usuario, empresas y centros de trabajo, empleados y roles (dueño/admin, empleado); aislamiento por empresa con RLS; una cuenta puede poseer varias empresas.
- `time-clock`: el fichaje mismo — entrada, salida y descansos en modo teléfono personal (sesión propia + geocerca del centro de trabajo) y modo kiosco (selección de empleado + PIN + selfie adjunta como evidencia).
- `offline-sync`: cola local de fichajes sin conexión, doble timestamp (dispositivo y recepción en servidor), marcado de registros tardíos y de discrepancias de reloj.
- `hours-dashboard`: tablero semanal por empleado con horas acumuladas y alertas contra el límite legal paramétrico por año calendario.
- `compliance-reporting`: historial consultable y reportes exportables por empleado/periodo para inspecciones de la STPS; política de retención conforme a ley.
- `employee-onboarding-consent`: alta del empleado con captura de su acuerdo con el sistema de registro y aceptación del aviso de privacidad, con constancia consultable.
- `billing`: suscripción por empresa con tarifa plana por rangos, Stripe (tarjeta + OXXO + SPEI), trial, descuento anual, y bloqueo suave al vencer el pago.

### Modified Capabilities

(Ninguna — no existen specs previas; proyecto nuevo.)

## Impact

- Código nuevo: aplicación Next.js (App Router, PWA con service worker), esquema Postgres en Supabase (con row-level security para el multi-tenant), storage de Supabase para selfies (URLs firmadas), despliegue en Vercel.
- Dependencias externas: Supabase (auth, DB, storage), Stripe (suscripciones y métodos de pago mexicanos), APIs del navegador (geolocalización, cámara, service worker/IndexedDB).
- Datos personales de empleados (fichajes, ubicación puntual al fichar, fotografías): sujetos a la nueva LFPDPPP — el aviso de privacidad y el consentimiento forman parte del alcance (`employee-onboarding-consent`).
- Riesgo externo vigilado: las disposiciones generales de la STPS (pendientes de publicación) podrían ajustar requisitos o exceptuar micronegocios; la capability `hours-dashboard` y los reportes nacen paramétricos para absorber cambios sin rediseño.
