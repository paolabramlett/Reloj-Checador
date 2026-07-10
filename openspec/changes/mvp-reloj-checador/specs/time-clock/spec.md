# Spec: time-clock

## ADDED Requirements

### Requirement: Fichaje de entrada, salida y descansos
El sistema SHALL permitir a un empleado registrar entrada, salida, inicio de descanso y fin de descanso. Cada registro MUST capturar el tipo de evento, el empleado, el centro de trabajo y el timestamp del dispositivo en el momento del toque (ver `offline-sync` para el doble timestamp).

#### Scenario: Jornada completa
- **WHEN** un empleado registra entrada, inicio de descanso, fin de descanso y salida a lo largo del día
- **THEN** los cuatro eventos quedan registrados en orden y el tablero de horas los computa correctamente

### Requirement: Fichaje en teléfono personal validado por geocerca
En modo teléfono personal, el sistema SHALL obtener la ubicación del dispositivo al momento de fichar y MUST aceptar el fichaje solo dentro del radio de geocerca del centro de trabajo asignado. La ubicación se captura únicamente en el momento del fichaje, nunca en seguimiento continuo.

#### Scenario: Fichaje dentro de la geocerca
- **WHEN** un empleado con sesión propia ficha estando dentro del radio de su centro de trabajo
- **THEN** el registro se acepta y guarda las coordenadas del momento como evidencia

#### Scenario: Fichaje fuera de la geocerca
- **WHEN** un empleado intenta fichar fuera del radio configurado
- **THEN** el sistema rechaza el fichaje con un mensaje claro en lenguaje llano indicando que debe estar en su lugar de trabajo

### Requirement: Fichaje en modo kiosco con PIN y selfie
En modo kiosco, el sistema SHALL mostrar la lista de empleados activos del centro de trabajo; el fichaje MUST requerir el PIN del empleado y la captura de una fotografía con la cámara frontal, que queda adjunta al registro como evidencia (sin reconocimiento facial ni matching biométrico).

#### Scenario: Fichaje correcto en kiosco
- **WHEN** un empleado se selecciona en el kiosco, ingresa su PIN correcto y se toma la selfie
- **THEN** el registro se guarda con la fotografía adjunta y el kiosco vuelve a la pantalla inicial listo para el siguiente

#### Scenario: PIN incorrecto
- **WHEN** se ingresa un PIN que no corresponde al empleado seleccionado
- **THEN** el fichaje se rechaza sin revelar el PIN correcto y tras varios intentos fallidos consecutivos el empleado queda temporalmente bloqueado en kiosco

### Requirement: Estado de fichaje siempre visible
Tras cada fichaje el sistema SHALL confirmar visualmente el evento registrado (tipo y hora), y la pantalla principal del empleado MUST mostrar su estado actual (fuera / trabajando / en descanso) sin ambigüedad.

#### Scenario: Confirmación inmediata
- **WHEN** un empleado registra su entrada
- **THEN** ve una confirmación con la hora registrada y su estado cambia a "trabajando"

### Requirement: Secuencias inválidas marcadas como anomalía
El sistema SHALL detectar secuencias de eventos incoherentes (p. ej. dos entradas sin salida intermedia) y MUST registrar el evento marcándolo como anomalía visible para el administrador, en lugar de rechazarlo silenciosamente o corromper el cómputo de horas.

#### Scenario: Entrada duplicada
- **WHEN** un empleado que ya tiene una entrada abierta registra otra entrada
- **THEN** el evento queda guardado y marcado como anomalía, y el administrador lo ve señalado en el historial

### Requirement: El fichaje es la interacción más rápida del producto
El flujo de fichaje MUST completarse en un máximo de dos interacciones desde la pantalla principal en modo personal (abrir → fichar) y tres en kiosco (seleccionarse → PIN → selfie automática), sin pasos intermedios de navegación.

#### Scenario: Fichaje directo en modo personal
- **WHEN** un empleado abre la PWA con sesión iniciada
- **THEN** el botón de fichar es la acción principal de la primera pantalla, sin navegación previa
