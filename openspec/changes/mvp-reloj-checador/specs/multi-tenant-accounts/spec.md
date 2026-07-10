# Spec: multi-tenant-accounts

## ADDED Requirements

### Requirement: Registro y autenticación de cuenta administradora
El sistema SHALL permitir crear una cuenta de administrador con email y contraseña, y autenticarse en sesiones persistentes. Toda operación administrativa MUST requerir sesión autenticada.

#### Scenario: Alta de cuenta nueva
- **WHEN** un visitante se registra con email y contraseña válidos
- **THEN** el sistema crea la cuenta, inicia sesión y lo lleva a crear su primera empresa

### Requirement: Una cuenta administra múltiples empresas
El sistema SHALL permitir que una misma cuenta cree y administre varias empresas, cada una con sus propios empleados, centros de trabajo y suscripción. El selector de empresa activa MUST estar disponible cuando la cuenta tiene más de una.

#### Scenario: Cuenta con dos empresas
- **WHEN** una cuenta con la empresa A crea la empresa B
- **THEN** ambas aparecen en su selector y los datos de cada una (empleados, fichajes, reportes) se mantienen separados

### Requirement: Centros de trabajo con geocerca
Cada empresa SHALL tener al menos un centro de trabajo con nombre, ubicación (coordenadas) y radio de geocerca configurable en metros. El sistema MUST usar esa geocerca para validar fichajes en modo teléfono personal.

#### Scenario: Configurar centro de trabajo
- **WHEN** el administrador crea un centro de trabajo señalando su ubicación en un mapa y un radio
- **THEN** el sistema lo guarda y lo ofrece como lugar de fichaje válido para los empleados asignados

### Requirement: Empleados con perfil mínimo y ciclo de vida
El sistema SHALL registrar empleados con nombre completo y centro de trabajo asignado, y soportar los estados activo y baja. Al dar de baja, el sistema MUST conservar al empleado y sus registros conforme a la política de retención (ver `compliance-reporting`), nunca borrarlos.

#### Scenario: Baja de empleado
- **WHEN** el administrador da de baja a un empleado
- **THEN** el empleado ya no puede fichar, deja de contar para el rango de facturación, y su historial sigue consultable y exportable

### Requirement: Aislamiento estricto entre empresas
El sistema MUST garantizar a nivel de base de datos (row-level security) que ningún usuario acceda a datos de una empresa que no administra o a la que no pertenece.

#### Scenario: Intento de acceso cruzado
- **WHEN** un usuario autenticado de la empresa A solicita por API datos de la empresa B
- **THEN** el sistema responde como si esos datos no existieran, sin revelar su existencia

### Requirement: Credenciales de empleado por modo de fichaje
Cada empleado SHALL poder tener acceso de sesión propia (para modo teléfono personal, vía invitación) y un PIN numérico (para modo kiosco). El PIN MUST ser único dentro de la empresa y modificable por el administrador.

#### Scenario: Invitación a teléfono personal
- **WHEN** el administrador genera una invitación para un empleado y este la abre en su teléfono
- **THEN** el empleado queda con sesión propia vinculada solo a su perfil en esa empresa
