# Spec: billing

## ADDED Requirements

### Requirement: Suscripción de tarifa plana por rangos de empleados
Cada empresa SHALL tener una suscripción con precio fijo mensual según su rango de empleados activos (primer rango: hasta 10 empleados; rangos superiores configurables). El precio MUST ser independiente del número exacto de empleados dentro del rango.

#### Scenario: Empresa dentro del primer rango
- **WHEN** una empresa con 4 empleados activos agrega 3 más (total 7)
- **THEN** su precio mensual no cambia porque sigue dentro del rango "hasta 10"

### Requirement: Periodo de prueba sin tarjeta
Toda empresa nueva SHALL iniciar con un periodo de prueba de 30 días con funcionalidad completa, sin requerir método de pago para comenzar.

#### Scenario: Alta y prueba
- **WHEN** una cuenta crea su primera empresa
- **THEN** puede configurar empleados y fichar de inmediato, y ve cuántos días de prueba le quedan

### Requirement: Pago con tarjeta, OXXO y SPEI
El sistema SHALL cobrar las suscripciones a través de Stripe aceptando tarjeta, pago en efectivo vía OXXO y transferencia SPEI, y MUST ofrecer pago anual con descuento además del mensual.

#### Scenario: Dueño sin tarjeta
- **WHEN** una empresa elige pagar su suscripción vía OXXO
- **THEN** recibe la referencia de pago y, al confirmarse el pago, su suscripción se activa automáticamente

### Requirement: Exceso de rango solicita upgrade
Cuando los empleados activos de una empresa excedan su rango contratado, el sistema SHALL notificar al administrador y solicitar el upgrade de rango, con un margen de gracia; el alta de empleados MUST seguir funcionando durante ese margen para no interrumpir la operación.

#### Scenario: Crecimiento del equipo
- **WHEN** una empresa del rango "hasta 10" activa a su empleado número 11
- **THEN** el alta procede, el administrador ve el aviso de upgrade y el plazo de gracia para regularizar

### Requirement: Bloqueo suave por falta de pago
Si el pago vence sin renovarse tras el periodo de gracia, el sistema MUST bloquear el acceso del administrador a tableros y reportes, pero el fichaje de los empleados y el almacenamiento de registros SHALL seguir funcionando, porque los registros de asistencia son una obligación legal del cliente que el producto nunca pone en riesgo.

#### Scenario: Suscripción vencida
- **WHEN** una empresa lleva vencido su pago más allá del periodo de gracia
- **THEN** sus empleados siguen fichando con normalidad, y el administrador ve sus tableros bloqueados con la opción de pagar para recuperar acceso inmediato
