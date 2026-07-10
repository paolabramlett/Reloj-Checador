# Spec: employee-onboarding-consent

## ADDED Requirements

### Requirement: Acuerdo del trabajador con el sistema de registro
Antes de su primer fichaje, cada empleado SHALL pasar por un paso único de aceptación donde se le explica en lenguaje llano qué registra el sistema (horarios, ubicación al fichar en modo personal, fotografía al fichar en kiosco) y manifiesta su acuerdo. El sistema MUST guardar constancia del acuerdo con identidad del empleado, fecha, hora y versión del texto aceptado, dado que el registro pactado con el trabajador tiene valor probatorio pleno.

#### Scenario: Primer fichaje en teléfono personal
- **WHEN** un empleado abre su invitación y llega a la pantalla de fichaje por primera vez
- **THEN** antes de poder fichar ve la explicación del sistema, la acepta, y su constancia queda registrada con fecha, hora y versión del texto

#### Scenario: Primer fichaje en kiosco
- **WHEN** un empleado sin acuerdo previo se selecciona en el kiosco e ingresa su PIN por primera vez
- **THEN** el kiosco muestra el paso de aceptación una única vez antes de permitirle fichar

### Requirement: Aviso de privacidad presentado y aceptado
El flujo de aceptación MUST incluir el aviso de privacidad conforme a la LFPDPPP, cubriendo el tratamiento de datos del fichaje (ubicación puntual al fichar, fotografías de kiosco, horarios). La aceptación SHALL registrarse por separado del acuerdo del sistema de registro, cada una con su propia constancia.

#### Scenario: Aceptación completa
- **WHEN** un empleado completa el paso de aceptación
- **THEN** quedan dos constancias distintas: la del acuerdo con el sistema de registro y la del aviso de privacidad

### Requirement: Constancias consultables y exportables
El administrador SHALL poder consultar el estado de aceptación de cada empleado (aceptado con fecha / pendiente) y MUST poder exportar las constancias como parte del expediente de cumplimiento de la empresa.

#### Scenario: Verificar cumplimiento del equipo
- **WHEN** el administrador abre la vista de empleados
- **THEN** ve por cada uno si su acuerdo y aviso de privacidad están aceptados y desde cuándo, y puede exportar las constancias

### Requirement: Versionado del texto de acuerdo
Cuando el texto del acuerdo o del aviso de privacidad cambie de versión, el sistema SHALL solicitar la re-aceptación a los empleados en su siguiente fichaje, conservando las constancias de versiones anteriores.

#### Scenario: Actualización del aviso de privacidad
- **WHEN** se publica una nueva versión del aviso y un empleado con la versión anterior va a fichar
- **THEN** se le presenta la nueva versión para aceptar una única vez, y ambas constancias (anterior y nueva) se conservan
