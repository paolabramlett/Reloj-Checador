# Spec: hours-dashboard

## ADDED Requirements

### Requirement: Tablero semanal de horas por empleado
El sistema SHALL mostrar al administrador un tablero con las horas trabajadas acumuladas en la semana en curso por cada empleado activo, calculadas a partir de los fichajes y descontando los descansos registrados.

#### Scenario: Semana en curso
- **WHEN** el administrador abre el tablero un jueves
- **THEN** ve por cada empleado las horas acumuladas de lunes a ese momento, con los descansos ya descontados

### Requirement: Límite legal paramétrico por año calendario
El límite semanal de jornada MUST estar definido como configuración por año calendario (48 h en 2026, 46 h en 2027, 44 h en 2028, 42 h en 2029, 40 h desde 2030), no fijo en código, y el sistema SHALL aplicar automáticamente el límite vigente a la fecha del cálculo. Un cambio normativo MUST poder absorberse actualizando la configuración sin modificar el código.

#### Scenario: Cambio de año
- **WHEN** el calendario pasa del 31 de diciembre de 2026 al 1 de enero de 2027
- **THEN** el tablero y las alertas pasan de evaluar contra 48 h a evaluar contra 46 h sin intervención manual

### Requirement: Alertas de proximidad y exceso del límite
El sistema SHALL señalar visualmente a los empleados que alcancen el 90% del límite semanal vigente y MUST distinguir con una señal más fuerte a quienes lo excedan, de forma perceptible sin depender solo del color.

#### Scenario: Empleado cerca del límite
- **WHEN** un empleado acumula 42 horas en 2027 (límite 46 h)
- **THEN** su fila aparece con la alerta de proximidad y el motivo en texto claro

#### Scenario: Empleado excedido
- **WHEN** un empleado supera las 46 horas esa misma semana
- **THEN** su fila muestra la alerta de exceso indicando por cuántas horas superó el límite

### Requirement: Detalle navegable por empleado
Desde el tablero, el administrador SHALL poder abrir el detalle de cualquier empleado con sus fichajes de la semana, incluyendo las marcas de origen (en vivo, sincronizado tarde, anomalía, discrepancia de reloj).

#### Scenario: Investigar una alerta
- **WHEN** el administrador abre el detalle de un empleado con alerta de exceso
- **THEN** ve la lista de fichajes que produjeron el cómputo, con sus marcas de origen visibles
