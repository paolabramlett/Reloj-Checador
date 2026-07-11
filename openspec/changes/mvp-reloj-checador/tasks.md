# Tasks: MVP Reloj Checador

## 1. Fundaciones

- [x] 1.1 Scaffold del proyecto Next.js (App Router, TypeScript) con configuración PWA (manifest, service worker básico, instalable)
- [x] 1.2 Crear proyecto Supabase (dev) y conectar cliente; estructura de migraciones con el CLI (`supabase/migrations/`)
- [x] 1.3 Configurar Vercel (preview por rama, producción en `main`) y variables de entorno dev/prod
- [x] 1.4 Sistema de diseño mínimo: tokens de color/tipografía/espaciado conforme a PRODUCT.md (AA, alto contraste, botones grandes) — sembrar DESIGN.md con `/impeccable document` antes de la primera pantalla

## 2. Multi-tenant y cuentas

- [x] 2.1 Migración inicial: `accounts` (membresías con rol), `companies`, `work_centers` (coordenadas + radio), `employees` (estados activo/baja, PIN hasheado)
- [x] 2.2 Políticas RLS por `company_id` en todas las tablas + pruebas de aislamiento cruzado (empresa A no ve nada de empresa B)
- [x] 2.3 Auth de administrador (registro, login, recuperación) con Supabase Auth
- [x] 2.4 UI: crear/editar empresa, centros de trabajo con mapa y radio de geocerca, selector de empresa activa
- [x] 2.5 UI: alta/edición/baja de empleados, asignación de centro, gestión de PIN
- [x] 2.6 Invitaciones de empleado para modo personal (link → sesión propia vinculada al perfil)

## 3. Fichaje (modo teléfono personal)

- [x] 3.1 Migración: `clock_events` append-only (UUID de cliente, doble timestamp, coordenadas, flags) con RLS que niega UPDATE/DELETE a todos
- [x] 3.2 Endpoint de ingesta idempotente: descarta UUIDs duplicados, asigna `server_ts`, calcula flags (`late_sync`, `clock_skew`, `out_of_fence`)
- [x] 3.3 Pantalla principal del empleado: botón de fichar como acción dominante, estado actual visible (fuera / trabajando / en descanso), entrada/salida/descansos
- [x] 3.4 Validación de geocerca en cliente (feedback inmediato, mensaje llano al estar fuera) + re-verificación en servidor
- [x] 3.5 Detección de secuencias inválidas marcadas como anomalía visible para el administrador

## 4. Offline-first

- [x] 4.1 Cola local en IndexedDB: escribir todo fichaje primero localmente (incluida selfie como blob), persistente entre cierres
- [x] 4.2 Sincronizador: drena la cola al detectar conexión con la app abierta, reintentos con backoff, estados pendiente/sincronizado en la UI
- [x] 4.3 Handshake de reloj al sincronizar para medir desviación del dispositivo y flag de `clock_skew`
- [x] 4.4 Tabla de configuración de umbrales (late_sync, clock_skew) con defaults (5 min) — verificado en navegador real; falta la prueba en un Android físico (ver nota)

## 5. Modo kiosco

- [x] 5.1 Registro de dispositivo kiosco desde la sesión del admin: token de larga vida ligado a empresa + centro de trabajo
- [x] 5.2 Pantalla kiosco: lista de empleados activos → PIN → captura de selfie → confirmación y regreso al inicio
- [x] 5.3 Bloqueo temporal tras N intentos de PIN fallidos
- [x] 5.4 Storage de selfies: bucket privado, subida al fichar, URLs firmadas de corta vida solo para admins de la empresa

## 6. Onboarding y consentimiento del empleado

- [x] 6.1 Migración: tablas de textos versionados (acuerdo del sistema + aviso de privacidad) y constancias de aceptación (empleado, versión, timestamp)
- [x] 6.2 Flujo de aceptación única antes del primer fichaje, en ambos modos (personal y kiosco), con lenguaje llano
- [x] 6.3 Re-aceptación automática cuando cambia la versión del texto, conservando constancias anteriores
- [x] 6.4 Vista de admin: estado de aceptación por empleado + exportación de constancias

## 7. Tablero de horas

- [x] 7.1 Función SQL de cómputo de horas semanales por empleado a partir de pares de eventos, descontando descansos y excluyendo anomalías del cómputo automático
- [x] 7.2 Tabla `legal_limits` precargada 2026→2030 (48/46/44/42/40) aplicada según la fecha del cálculo
- [x] 7.3 Tablero semanal: horas por empleado, alerta de proximidad (≥90%) y de exceso, perceptibles sin depender solo del color
- [x] 7.4 Detalle por empleado con fichajes de la semana y sus marcas de origen

## 8. Historial y reportes de cumplimiento

- [x] 8.1 Historial consultable con filtros por empleado y rango de fechas, marcas visibles
- [x] 8.2 Anotaciones de corrección del admin (motivo, autor, fecha) vinculadas sin tocar el registro original
- [x] 8.3 Exportación CSV por empresa/empleados/periodo con doble timestamp y marcas
- [x] 8.4 Exportación PDF con encabezado de empresa, apta para entregar en inspección
- [x] 8.5 Política de retención: bloqueo de toda operación destructiva dentro del plazo legal (baja de empleado y cancelación de suscripción conservan registros)

## 9. Facturación

- [x] 9.1 Productos y precios en Stripe: rango "hasta 10" mensual y anual (con descuento) — tarjeta funcionando; OXXO/SPEI descubrimos que no son compatibles con `mode: "subscription"` de Stripe (son pago único, no se pueden recargar solos), decisión con Paola: quedan para una iteración futura con facturación período a período
- [x] 9.2 Trial de 30 días sin tarjeta al crear empresa, con días restantes visibles
- [x] 9.3 Checkout + customer portal + webhooks que actualizan `subscription_status` por empresa
- [x] 9.4 Guard central de bloqueo suave: tableros y reportes exigen suscripción vigente o trial; fichaje e ingesta nunca se bloquean
- [x] 9.5 Detección de exceso de rango con aviso de upgrade y periodo de gracia

## 10. Calidad y lanzamiento

- [ ] 10.1 QA en dispositivos reales: Android de gama baja (offline, GPS, cámara), iPhone (instalación PWA, sync al abrir), tablet como kiosco
- [ ] 10.2 Auditoría de accesibilidad AA (contraste 4.5:1, objetivos táctiles, reduced motion, lectura sin color) sobre los flujos de fichaje y tablero
- [ ] 10.3 Textos finales del acuerdo y aviso de privacidad + revisión del laboralista (interpretaciones marcadas en design.md § Open Questions) antes de publicar
- [ ] 10.4 Entorno de producción: Supabase prod, migraciones por CI, dominio, monitoreo básico de errores
- [ ] 10.5 Smoke test end-to-end en producción con una empresa real de prueba (alta → empleados → fichajes ambos modos → reporte exportado)
