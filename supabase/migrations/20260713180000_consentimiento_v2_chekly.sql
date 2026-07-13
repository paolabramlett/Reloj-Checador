-- Rebrand a "Chekly": nueva versión de los textos de consentimiento con
-- el nombre actualizado. Al insertar version=2, obtenerDocumentosVigentes()
-- los toma como vigentes automáticamente y dispara re-aceptación para
-- todo empleado que ya había aceptado la v1 (lib/consentimiento.ts).
-- Mismo contenido legal que v1 — el texto en sí sigue pendiente de
-- revisión del laboralista (tarea 10.3), esto es solo el cambio de nombre.

insert into public.consent_documents (type, version, body) values
(
  'system_agreement',
  2,
  'Al aceptar, estás de acuerdo en que Chekly registre tu entrada, salida y descansos como parte del control de asistencia de tu trabajo.

Cuando fiches desde tu propio teléfono, se guarda tu ubicación en el momento exacto en que tocas el botón — nunca antes ni después, y nunca te seguimos durante el día.

Cuando fiches desde el kiosco (una tablet o teléfono fijo en tu lugar de trabajo), se toma una foto tuya como evidencia de que fuiste tú quien fichó. Esa foto no se usa para reconocimiento facial ni para ningún otro fin.

Este acuerdo, junto con tu registro de fichajes, tiene valor como prueba ante una autoridad laboral, precisamente porque lo aceptaste tú.'
),
(
  'privacy_notice',
  2,
  'Aviso de privacidad

Tu empleador usa Chekly para cumplir con la obligación legal de llevar un registro de asistencia (Ley Federal del Trabajo, artículo 132, fracción XXXIV).

Datos que tratamos: tu nombre, tus fichajes (fecha y hora de entrada, salida y descansos), tu ubicación únicamente en el momento de fichar desde tu teléfono, y una fotografía si fichas desde un kiosco.

Para qué los usamos: exclusivamente para llevar el registro de asistencia que exige la ley y para que tu empleador pueda calcular tus horas trabajadas.

Cuánto tiempo los guardamos: mientras dure tu relación laboral y un año más después de que termine, tal como lo exige el artículo 804 de la Ley Federal del Trabajo.

Con quién los compartimos: con nadie fuera de tu empleador, salvo que una autoridad laboral lo solicite conforme a la ley.

Tus derechos: puedes pedirle a tu empleador acceder a tus datos, corregirlos, o preguntar cómo se usan, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.'
);
