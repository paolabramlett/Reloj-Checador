# Spec: offline-sync

## ADDED Requirements

### Requirement: Los fichajes sin conexión nunca se pierden
Cuando el dispositivo no tiene conexión, el sistema SHALL guardar el fichaje completo (evento, empleado, timestamp del dispositivo, coordenadas o selfie según el modo) en una cola local persistente que MUST sobrevivir cierres de la app y reinicios del dispositivo.

#### Scenario: Fichaje sin internet
- **WHEN** un empleado ficha sin conexión y cierra la app
- **THEN** al reabrirla el registro sigue en la cola local y se muestra como "pendiente de sincronizar"

### Requirement: Doble timestamp en todo registro
Todo fichaje MUST almacenar dos tiempos: el timestamp del dispositivo capturado en el momento del toque, y el timestamp del servidor asignado al recibirse. Ambos SHALL conservarse y ser visibles en el detalle del registro y en los reportes exportados.

#### Scenario: Registro en línea
- **WHEN** un fichaje se envía con conexión activa
- **THEN** los dos timestamps difieren en segundos y el registro se considera "en vivo"

### Requirement: Registros sincronizados tarde quedan marcados
El sistema SHALL marcar como "sincronizado tarde" todo registro cuya diferencia entre timestamp de dispositivo y de recepción supere un umbral configurable (por defecto 5 minutos). La marca MUST ser visible para el administrador y MUST incluirse en los reportes exportables, distinguiendo honestamente registros en vivo de registros diferidos.

#### Scenario: Sincronización tras horas sin conexión
- **WHEN** un fichaje hecho a las 8:00 sin conexión se sincroniza a las 14:00
- **THEN** el registro conserva las 8:00 como hora de fichaje, guarda las 14:00 como recepción y queda marcado "sincronizado tarde"

### Requirement: Detección de relojes de dispositivo desviados
Al sincronizar, el sistema SHALL comparar el reloj del dispositivo contra el del servidor y MUST marcar con una señal de discrepancia los registros provenientes de dispositivos cuyo reloj difiera del servidor más allá de un umbral configurable, para que el administrador evalúe su confiabilidad.

#### Scenario: Dispositivo con reloj manipulado
- **WHEN** se sincronizan fichajes desde un dispositivo cuyo reloj está 40 minutos desviado del servidor
- **THEN** esos registros quedan marcados con discrepancia de reloj y el administrador los ve señalados

### Requirement: Sincronización automática al recuperar conexión
Con la app abierta, el sistema SHALL sincronizar la cola local automáticamente al detectar conexión, sin requerir acción del usuario, y MUST reflejar en la interfaz el paso de "pendiente" a "sincronizado" de cada registro.

#### Scenario: Vuelve el internet
- **WHEN** un dispositivo con 3 fichajes en cola recupera conexión con la app abierta
- **THEN** los 3 se envían automáticamente y la interfaz muestra la cola vacía

### Requirement: Idempotencia de sincronización
Cada fichaje MUST llevar un identificador único generado en el dispositivo, y el servidor SHALL descartar duplicados del mismo identificador, de modo que reintentos de sincronización nunca produzcan registros dobles.

#### Scenario: Reintento tras fallo de red
- **WHEN** el envío de un fichaje se interrumpe y el dispositivo lo reintenta
- **THEN** el servidor almacena el registro una sola vez
