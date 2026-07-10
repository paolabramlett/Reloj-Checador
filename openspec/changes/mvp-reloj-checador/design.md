# Design: MVP Reloj Checador

## Context

Proyecto greenfield construido por una fundadora sola con Claude Code, tiempo completo, con meta de lanzamiento en octubre de 2026. El producto es una PWA de registro de asistencia para micro y pequeñas empresas mexicanas; el marco estratégico vive en `PRODUCT.md` y el análisis legal en `docs/research/reforma-40-horas-reloj-checador.md`. Restricciones dominantes: mínima superficie de operación (nada que administrar a mano), costo de infraestructura cercano a cero durante los primeros meses, y usuarios finales con Android de gama media/baja y conectividad irregular.

## Goals / Non-Goals

**Goals:**
- Las 7 capabilities del proposal funcionando en producción para octubre de 2026.
- Fichaje confiable en condiciones reales: offline, GPS impreciso, dispositivos baratos, kiosco compartido.
- Registros con integridad demostrable (doble timestamp, inmutabilidad, marcas honestas) que resistan el escrutinio de una inspección.
- Arquitectura paramétrica donde la ley aún es ambigua (límites por año, umbrales, textos de acuerdo versionados).

**Non-Goals:**
- Turnos, vacaciones, permisos, nómina (tier RH futuro).
- Reconocimiento facial o cualquier matching biométrico.
- Vista multi-empresa para contadores (el modelo de datos la permite; la UI no se construye ahora).
- CFDI automática, envoltorio nativo (Capacitor), integridad criptográfica de la cola offline (hash chain) — todos son upgrades posteriores ya previstos.

## Decisions

**1. Stack: Next.js (App Router, PWA) + Supabase + Vercel + Stripe.**
Elegido sobre un backend propio (Node/VPS) por superficie de operación mínima y por ser el stack mejor documentado — relevante cuando el par de programación es una IA. Supabase da Postgres con RLS, auth, y storage administrados; todo con tier gratuito. Alternativa considerada: Firebase — descartado porque el modelo relacional con RLS de Postgres encaja mejor con multi-tenant estricto y reportes tabulares.

**2. Modelo multi-tenant: `accounts → companies → work_centers → employees`, RLS por `company_id`.**
Toda tabla de datos lleva `company_id` y las políticas RLS lo exigen en cada operación. Una cuenta puede poseer N empresas (membresía con rol en tabla puente), lo que deja lista la futura vista de contadores sin migración. Alternativa considerada: esquema por tenant — descartado por complejidad operativa injustificada a esta escala.

**3. Fichajes como tabla append-only de eventos.**
`clock_events` (id UUID generado en cliente, company_id, employee_id, work_center_id, tipo, device_ts, server_ts, coordenadas?, selfie_path?, flags). Sin UPDATE ni DELETE (negados por RLS incluso al dueño); las correcciones viven en una tabla `annotations` vinculada. Las horas se computan derivando pares de eventos en una función SQL — el cómputo siempre es reproducible desde los eventos crudos.

**4. Offline: cola en IndexedDB + service worker, idempotencia por UUID de cliente.**
El fichaje escribe primero a IndexedDB (incluida la selfie como blob) y un sincronizador la drena al recuperar conexión con la app abierta (iOS no ofrece background sync; aceptable porque la app se abre justamente para fichar). El servidor calcula `flags` al ingerir: `late_sync` si `server_ts - device_ts` supera el umbral, `clock_skew` si el reloj del dispositivo difiere del servidor más allá del umbral (medido en un handshake al sincronizar). Umbrales en tabla de configuración, no en código.

**5. Kiosco: la misma PWA en modo dispositivo, autenticado por token de dispositivo.**
El administrador "registra" el kiosco desde su sesión, generando un token de larga vida ligado a empresa + centro de trabajo que se guarda en el dispositivo. El kiosco opera sin sesión de usuario: lista de empleados activos + PIN + selfie. Bloqueo temporal tras N intentos de PIN fallidos. Alternativa considerada: sesión de usuario "kiosco" — descartada por ser más frágil (expiraciones de sesión en un dispositivo desatendido).

**6. Selfies en Supabase Storage, bucket privado, URLs firmadas.**
Solo administradores de la empresa acceden, vía URLs firmadas de corta vida. La retención sigue la misma política legal que los eventos.

**7. Límites legales como datos: tabla `legal_limits (año, horas_semanales)`.**
Precargada 2026→2030 (48/46/44/42/40). Tablero y alertas consultan el límite vigente a la fecha del cálculo. Los textos del acuerdo del trabajador y del aviso de privacidad se versionan en tabla propia; las constancias referencian la versión aceptada.

**8. Stripe: Checkout + customer portal + webhooks; el estado de suscripción vive en la DB.**
Un producto por rango con precio mensual y anual; OXXO y SPEI como payment methods de Stripe. Los webhooks actualizan `subscription_status` por empresa; un guard central aplica el bloqueo suave: rutas de administración (tableros, reportes) exigen suscripción vigente o trial; las rutas de fichaje e ingesta jamás se bloquean. Facturas CFDI: manuales por ahora, fuera del sistema.

**9. Geocerca evaluada en el cliente con evidencia verificable en servidor.**
El cliente valida el radio antes de aceptar el fichaje (feedback inmediato) y las coordenadas viajan con el evento; el servidor re-verifica al ingerir y marca `out_of_fence` si no cuadra (defensa contra clientes manipulados). Radio configurable por centro de trabajo, con default generoso (100 m) para tolerar GPS urbano impreciso.

## Risks / Trade-offs

- [Las disposiciones generales de la STPS (vigor: 01-01-2027) aún no se publican y podrían cambiar requisitos o exceptuar microempresas] → Todo lo normativo es paramétrico (límites, umbrales, formato de reporte como capa de presentación separada); monitoreo del DOF como rutina; el messaging de venta destaca el valor probatorio en juicios laborales, que existe con o sin obligación.
- [Reloj del dispositivo manipulable en fichajes offline] → Doble timestamp + flag de discrepancia; los reportes distinguen honestamente registros en vivo de diferidos. La cadena de hashes queda como upgrade si la ley lo exige.
- [GPS impreciso en zonas urbanas densas puede rechazar fichajes legítimos] → Radio default generoso y configurable; el kiosco existe como alternativa sin GPS en el mismo local.
- [iOS: sin background sync y con instalación de PWA poco intuitiva] → La sincronización al abrir cubre el caso de uso real; Android domina el segmento objetivo; Capacitor previsto como paso posterior si la fricción de iOS resulta material.
- [Una sola persona construyendo contra fecha fija] → El orden de construcción (tasks.md) pone el camino crítico primero (fichaje + offline + multi-tenant); si octubre se compromete, se recorta desde el final de la lista (billing automatizado puede lanzarse en modo manual), nunca del núcleo de registro.
- [Selfies y ubicación son datos personales bajo la nueva LFPDPPP] → El consentimiento y el aviso de privacidad son una capability de primera clase (`employee-onboarding-consent`); captura de ubicación solo al fichar; revisión de laboralista antes del lanzamiento ya comprometida.

## Migration Plan

Greenfield, sin migración de datos. Despliegue: Vercel con preview deploys por rama y producción en `main`; esquema de Supabase versionado con migraciones del CLI (`supabase/migrations/`) aplicadas por CI; entornos dev y prod separados. Rollback de app = revert del deploy en Vercel; las migraciones de esquema son siempre aditivas durante el MVP para que el rollback de app nunca dependa de revertir la DB.

## Open Questions

- Formato exacto del reporte para inspección: la ley es tecnológicamente neutral y no fija formato; el diseño CSV/PDF propio se valida con el laboralista y se ajusta cuando la STPS publique sus disposiciones.
- Confirmación jurídica de dos interpretaciones marcadas en la investigación: la selfie sin matching como dato no sensible, y el alcance exacto del "acuerdo" que otorga valor de prueba plena (¿basta la aceptación in-app?). Ambas van a la revisión del laboralista.
- Parámetros operativos por calibrar en beta: umbral de `late_sync` (default 5 min), umbral de `clock_skew`, radio default de geocerca (default 100 m), intentos de PIN antes del bloqueo, y días de gracia de facturación.
- Precios de los rangos superiores (hasta 25, hasta 50): se calibran con la lista de espera antes del lanzamiento.
