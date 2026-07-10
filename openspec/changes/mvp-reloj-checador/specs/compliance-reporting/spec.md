# Spec: compliance-reporting

## ADDED Requirements

### Requirement: Historial consultable por empleado y periodo
El sistema SHALL permitir al administrador consultar el historial de fichajes filtrando por empleado y por rango de fechas, mostrando cada evento con sus dos timestamps y sus marcas (en vivo, sincronizado tarde, anomalía, discrepancia de reloj).

#### Scenario: Consulta de una quincena
- **WHEN** el administrador consulta los fichajes de un empleado del 1 al 15 del mes
- **THEN** ve todos los eventos del periodo en orden cronológico con sus marcas de origen

### Requirement: Reporte exportable para inspección
El sistema SHALL generar un reporte exportable (CSV y PDF) por empresa, empleado(s) y periodo, que MUST incluir por evento: empleado, centro de trabajo, tipo de evento, timestamp del dispositivo, timestamp de recepción, y sus marcas de origen. El PDF MUST ser legible como documento entregable a un inspector de la STPS.

#### Scenario: Exportar para una inspección
- **WHEN** el administrador exporta el reporte del mes de todos los empleados en PDF
- **THEN** obtiene un documento con encabezado de la empresa y una tabla completa de eventos apta para entregarse en una inspección

### Requirement: Inmutabilidad de los registros
Los fichajes MUST ser inmutables: ni el administrador ni el sistema pueden editar o borrar un registro existente. Las correcciones SHALL hacerse mediante anotaciones firmadas por el administrador (con fecha y motivo) que se muestran junto al registro original sin reemplazarlo.

#### Scenario: Corregir un olvido de salida
- **WHEN** el administrador anota que un empleado olvidó fichar su salida y declara la hora real
- **THEN** la anotación queda vinculada al día con su motivo, autor y fecha, y el registro original permanece intacto

### Requirement: Retención conforme al artículo 804 de la LFT
El sistema MUST conservar los registros de asistencia durante toda la relación laboral vigente y por lo menos un año después de extinguida la relación, y SHALL impedir cualquier operación (incluida la baja de empleados o la cancelación de la suscripción) que destruya registros dentro de ese plazo.

#### Scenario: Cancelación de suscripción
- **WHEN** una empresa cancela su suscripción
- **THEN** los registros existentes se conservan y siguen siendo exportables durante el plazo legal de retención, aunque la operación de fichaje quede desactivada
