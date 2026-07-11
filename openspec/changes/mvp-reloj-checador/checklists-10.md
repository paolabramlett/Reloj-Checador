# Checklists Grupo 10 — tareas que requieren acción humana externa

No las puedo completar yo (requieren dispositivos físicos reales o
juicio profesional de un abogado). Este documento acota exactamente qué
falta revisar para que quien lo haga no tenga que "revisar todo".

## 10.1 — QA en dispositivos reales

### Android de gama baja
- [ ] Cola offline: activar modo avión, fichar 3-4 veces seguidas (entrada, descanso, regreso, salida), confirmar que quedan en estado "pendiente" visible en la UI
- [ ] Reactivar datos/wifi con la app **en primer plano**: confirmar que la cola sincroniza sola sin recargar la página
- [ ] Cerrar la app por completo con fichajes aún pendientes (sin conexión) y volver a abrirla más tarde: confirmar que la cola sobrevive (persistencia IndexedDB) y sincroniza al recuperar señal
- [ ] GPS: probar en interior (señal débil/imprecisa) y confirmar que el mensaje de "fuera de la geocerca" es comprensible, no un error técnico crudo
- [ ] GPS: negar el permiso de ubicación al navegador y confirmar que la app explica qué hacer, no que se cuelga en blanco
- [ ] Cámara del kiosco: probar captura de selfie con poca luz y con la cámara frontal de un equipo de gama baja (calidad/latencia)
- [ ] Confirmar que los objetivos táctiles (botón de fichar, teclado de PIN) son cómodos con el tamaño de pantalla real, no solo en el emulador de escritorio

### iPhone
- [ ] Instalar la PWA desde Safari ("Agregar a pantalla de inicio") y confirmar que abre en modo standalone (sin barra de Safari)
- [ ] Fichar estando offline, cerrar la app instalada, y confirmar que **al volver a abrirla** (no en segundo plano — iOS no permite sync en background para PWAs) la cola sincroniza inmediatamente
- [ ] Confirmar que el ícono y el splash screen de la PWA se ven bien (no es el genérico de Safari)
- [ ] Repetir la prueba de permiso de ubicación denegado — el flujo de "activar ubicación" en iOS es distinto al de Android

### Tablet como kiosco
- [ ] Dejar la tablet en modo kiosco varias horas seguidas (uso real de una jornada) y confirmar que no se duerme la pantalla a medio fichaje ni pierde el token del dispositivo
- [ ] Probar el teclado de PIN con guantes o dedos grandes (contexto de trabajo físico, si aplica al giro del negocio)
- [ ] Confirmar que tras 3-5 fichajes seguidos de empleados distintos, la pantalla siempre vuelve limpia al listado de empleados (sin arrastrar sesión del anterior)
- [ ] Probar el bloqueo temporal por PIN incorrecto repetido y confirmar que el mensaje de espera es claro

## 10.3 — Textos finales del acuerdo y aviso de privacidad + revisión del laboralista

Alcance acotado: **no** es "revisar toda la app", son estos puntos concretos.

### De `openspec/changes/mvp-reloj-checador/design.md` § Open Questions
- [ ] **Formato del reporte para inspección**: la ley es tecnológicamente neutral, no fija formato — validar que el CSV/PDF actual (ver [app/api/panel/reportes/](../../../app/api/panel/reportes/)) es defendible ante la STPS tal cual, o si hace falta ajustar campos/encabezados
- [ ] **Selfie como dato no sensible**: confirmar la interpretación de que la foto tomada en kiosco (sin reconocimiento facial, solo evidencia visual) no cae en la categoría de "datos sensibles" de la LFPDPPP
- [ ] **Alcance del "acuerdo" con valor de prueba plena**: confirmar si basta la aceptación in-app (checkbox + registro de versión/timestamp, ver `consent_documents` / `consent_acceptances` en la migración de consentimiento) para que el fichaje tenga valor probatorio ante una autoridad laboral, o si se necesita algo adicional (firma, biométrico, etc.)
- [ ] **Parámetros operativos a calibrar en beta**: umbral de `late_sync` (default 5 min), umbral de `clock_skew`, radio default de geocerca (default 100 m), intentos de PIN antes de bloqueo, días de gracia de facturación — confirmar que ninguno de estos defaults tiene implicación legal que requiera ajuste antes de lanzar

### Textos concretos a revisar palabra por palabra
- [ ] Acuerdo del sistema de registro (`system_agreement`, versión 1) — texto completo en [supabase/migrations/20260710190000_consentimiento.sql:69-75](../../../supabase/migrations/20260710190000_consentimiento.sql)
- [ ] Aviso de privacidad (`privacy_notice`, versión 1) — texto completo en el mismo archivo, líneas 80-92
  - Puntualmente: la referencia a LFT art. 132 fracc. XXXIV y art. 804 (plazo de retención "1 año tras terminar la relación laboral"), y la referencia a la LFPDPPP para derechos ARCO — confirmar que las citas son correctas y están completas
- [ ] Si el laboralista pide cambios: como el esquema ya soporta versionado (`consent_documents.version` + re-aceptación automática al cambiar de versión, ver `lib/consentimiento.ts`), el cambio es insertar una fila nueva con `version` incrementada — no requiere migración de esquema, solo el dato

### Nota técnica para quien haga la revisión
Los textos viven en la base de datos, no hardcodeados en el código — cualquier corrección se aplica con un `insert` a `consent_documents`, no con un deploy.
