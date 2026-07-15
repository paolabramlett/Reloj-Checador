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

### Requirement: Bloqueo duro al llegar al tope del rango
Cuando los empleados activos de una empresa lleguen al tope de su rango contratado, el sistema SHALL bloquear el alta (o reactivación) de un empleado nuevo, mostrando un mensaje claro para subir de rango; este bloqueo MUST NOT aplicar durante el periodo de prueba, y jamás aplica al fichaje ni a su ingesta.

(Decisión revertida el 2026-07-14 respecto a la versión original de este requirement — ver `docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md`, sección "Decisiones que esta spec revierte", para la justificación completa.)

#### Scenario: Empresa dentro del trial
- **WHEN** una empresa en periodo de prueba con 18 empleados agrega uno más
- **THEN** el alta procede sin ningún bloqueo, sin importar el tamaño

#### Scenario: Empresa suscrita al tope de su rango
- **WHEN** una empresa activa del rango "hasta 10", con 10 empleados activos, intenta agregar uno más
- **THEN** el alta se bloquea y ve un mensaje indicando que debe subir de rango en Facturación

#### Scenario: Empresa suscrita por debajo del tope
- **WHEN** una empresa activa del rango "hasta 10" con 4 empleados agrega 3 más (total 7)
- **THEN** el alta procede sin bloqueo ni aviso, porque sigue dentro de su rango

### Requirement: Bloqueo suave por falta de pago
Si el pago vence sin renovarse tras el periodo de gracia, el sistema MUST bloquear el acceso del administrador a tableros y reportes, pero el fichaje de los empleados y el almacenamiento de registros SHALL seguir funcionando, porque los registros de asistencia son una obligación legal del cliente que el producto nunca pone en riesgo.

#### Scenario: Suscripción vencida
- **WHEN** una empresa lleva vencido su pago más allá del periodo de gracia
- **THEN** sus empleados siguen fichando con normalidad, y el administrador ve sus tableros bloqueados con la opción de pagar para recuperar acceso inmediato
