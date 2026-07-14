# Plan de facturación "hasta 25 empleados"

**Fecha:** 2026-07-14
**Estado:** aprobado por Paola, pendiente de plan de implementación
**Decisión previa relevante:** `openspec/changes/mvp-reloj-checador/design.md` (decisión 8) y `openspec/changes/mvp-reloj-checador/specs/billing/spec.md` — ver sección "Decisiones que esta spec revierte" más abajo.

## Problema

Chekly solo tiene un rango de facturación hoy: "hasta 10 empleados" a $179 MXN/mes (o $1,790/año), ya vendido y cobrado por Stripe. No hay nada construido para negocios más grandes — ni un segundo precio en Stripe, ni ningún límite técnico real sobre cuántos empleados puede tener una empresa en ese rango (`app/panel/empleados/actions.ts` inserta empleados sin consultar el rango contratado en ningún momento).

Sí existe infraestructura parcial, construida por adelantado en una sesión anterior de diseño (`supabase/migrations/20260711120000_facturacion.sql`): la columna `companies.employee_range` (default `'hasta_10'`, protegida contra escritura desde sesiones de usuario — solo el webhook de Stripe con service role puede tocarla) y un aviso *suave* en `/panel` cuando el conteo de empleados activos excede el rango contratado. Pero ese aviso es cosmético: el webhook nunca actualiza `employee_range` (ni siquiera para el rango actual), y el alta de empleados nunca se bloquea.

## Alcance de esta spec

Cubre exclusivamente: agregar el segundo rango "hasta 25 empleados" (precio, enforcement técnico, cambios de Stripe/webhook/UI necesarios). No cubre: rangos superiores a 25 (hasta 50, empresas medianas 50-250), la vista multi-empresa para contadores/gestores, ni ningún cambio a OXXO/SPEI como método de pago (ya están fuera de este alcance, siguen pendientes como estaban).

## Decisiones (de la sesión de brainstorming con Paola)

1. **Alcance: solo el siguiente escalón**, no la escalera completa hasta empresa mediana ni el canal de contadores — ambos siguen como expansión futura, sin tocar en esta spec.
2. **Modelo de precio: tarifa plana con un tope más alto**, igual que el rango actual — no precio por empleado ni varios rangos intermedios. Mantiene la promesa de marca de "precio fijo que se entiende en un segundo".
3. **Tope: 25 empleados.** Salto de 2.5x desde el rango actual (10).
4. **Precio: $349 MXN/mes, o $3,490 MXN/año** (10 meses — mismo patrón de "2 meses gratis" que el rango actual). A capacidad llena, esto baja el costo por empleado de $17.90 (rango de 10) a $13.96 (rango de 25) — un descuento de volumen que premia crecer, no lo castiga.
5. **Sin tope de empleados durante el trial** (30 días, sin tarjeta). Un negocio que ya tiene, por ejemplo, 18 empleados debe poder probar Chekly con su equipo real completo antes de elegir y pagar un rango — el tope solo empieza a aplicar una vez que hay una suscripción activa.
6. **Enforcement: bloqueo duro sobre altas nuevas**, no aviso con margen de gracia. Al llegar al tope de su rango (10 o 25), el botón/acción de agregar un empleado nuevo se bloquea con un mensaje claro señalando que hay que subir de rango. Aplica también a reactivar un empleado dado de baja si eso lleva el conteo por encima del tope. El fichaje (`/api/fichar`, `/api/kiosco/fichar`) **nunca** se bloquea por esto, sin excepción — igual que el resto del sistema de facturación. El chequeo solo corre al insertar o reactivar: una empresa que hoy ya tenga más empleados activos que su tope (posible, porque nunca hubo enforcement) no pierde ni ve bloqueado a ningún empleado existente — simplemente no puede agregar ni reactivar a nadie más hasta subir de rango o dar de baja a alguien.
7. **Ambos rangos visibles siempre en Facturación**, no solo el rango contratado actualmente ni solo tras toparse con el límite. Un negocio que ya sabe que tiene 18 empleados puede elegir "hasta 25" desde el principio, sin tener que pasar primero por el rango chico.

## Decisiones que esta spec revierte (a propósito, no por descuido)

Durante el brainstorming se encontraron dos decisiones ya registradas que esta spec cambia deliberadamente, con el visto bueno explícito de Paola después de ponerlas sobre la mesa:

- **`specs/billing/spec.md`, requirement "Exceso de rango solicita upgrade"** decía que el alta de empleados debía **seguir funcionando** al exceder el rango, con un aviso y margen de gracia — la razón dada entonces era que bloquear el registro de un empleado nuevo pone en riesgo la obligación legal de llevar su asistencia, el mismo principio que protege el fichaje de cualquier bloqueo. Paola decidió conscientemente ir con bloqueo duro de todos modos: el fichaje en sí sigue protegido (nunca se bloquea), pero el **alta administrativa** de un empleado nuevo sí puede esperar a que se resuelva el pago. Este documento reemplaza esa decisión; `specs/billing/spec.md` se actualiza como parte del plan de implementación para que no quede contradiciendo el código.
- **`design.md`, sección "Open Questions"** decía que el precio de los rangos superiores se calibraría "con la lista de espera antes del lanzamiento" — es decir, juntar señal real de negocios interesados antes de fijar un número. Esta spec fija el precio ($349/mes) directamente, sin ese paso.

## Cambios técnicos

### 1. Esquema (Supabase)

`companies.employee_range` ya existe; solo hace falta ampliar su restricción:

```sql
alter table public.companies drop constraint companies_employee_range_check;
alter table public.companies
  add constraint companies_employee_range_check
  check (employee_range in ('hasta_10', 'hasta_25'));
```

(El nombre exacto de la constraint se confirma en el plan de implementación — Postgres la nombra automáticamente al crear la columna con `check` inline; puede no ser `companies_employee_range_check` literal.)

### 2. Stripe

Nuevo producto "Chekly — hasta 25 empleados" con dos precios (mensual $349 MXN, anual $3,490 MXN), mismo patrón que `scripts/crear-productos-stripe.mjs` ya usó para el rango actual. Nuevas variables de entorno: `STRIPE_PRICE_MONTHLY_25`, `STRIPE_PRICE_ANNUAL_25` (las existentes `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_ANNUAL` no se tocan, para no arriesgar las suscripciones ya activas del rango de 10).

El portal de cliente de Stripe (usado por "Gestionar suscripción") necesita permitir cambiar entre los dos productos para que subir de rango sea autoservicio — se configura como parte del mismo script o vía `stripe.billingPortal.configurations`, a definir en el plan.

### 3. Webhook (`app/api/webhooks/stripe/route.ts`)

Hoy `actualizarPorSuscripcion` solo actualiza `subscription_status` y `stripe_subscription_id` — nunca toca `employee_range`, ni siquiera para el rango actual. Se extiende para leer `subscription.items.data[0].price.id`, mapearlo contra los 4 price IDs conocidos (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_MONTHLY_25`, `STRIPE_PRICE_ANNUAL_25`) a `'hasta_10'` o `'hasta_25'`, y guardarlo junto con `subscription_status`. Si el price ID no coincide con ninguno conocido (evento de prueba, producto viejo, etc.), `employee_range` no se toca.

### 4. `lib/facturacion.ts`

- `LIMITE_RANGO` gana la entrada `hasta_25: 25`.
- Nuevo helper (nombre a definir en el plan, p. ej. `limiteEfectivoDeEmpleados`) que reciba `subscription_status` y `employee_range` y devuelva: sin límite si `subscription_status === 'trialing'`, o `limiteDelRango(employee_range)` en cualquier otro estado (incluidos `past_due`/`canceled` — el tope de empleados no se levanta solo porque el pago esté atrasado).

### 5. `app/panel/empleados/actions.ts`

- `crearEmpleado`: antes de insertar, cuenta empleados activos de la empresa, calcula el límite efectivo, y si ya está en el tope devuelve un error claro en vez de insertar. Ya usa `useActionState` vía `FormularioEmpleado`, así que el mensaje se muestra igual que cualquier otro error de este formulario.
- `reactivar`: mismo chequeo antes de reactivar (reactivar a alguien también puede llevar el conteo por encima del tope). Hoy no tiene manejo de estado/error (`(formData) => void` con redirect fijo) — se resuelve con un query param en el redirect (mismo patrón que `checkout=exito`/`checkout=cancelado` en Facturación) y un `Mensaje` en la página de detalle del empleado.

### 6. `/panel/empleados` y `/panel` (banner existente)

El banner de `excedeRango` en `app/panel/page.tsx` cambia de disparar solo al *exceder* (`>`) a disparar al *llegar* (`>=`) al tope, y su texto se actualiza — ya no es cierto que "los nuevos altas siguen funcionando".

### 7. `app/panel/facturacion/page.tsx` y `actions.ts`

La página pasa de un solo plan (mensual/anual) a mostrar los dos rangos lado a lado, cada uno con sus dos periodos — visibles siempre, tanto para elegir por primera vez como para ver junto al rango ya contratado. `iniciarCheckout` gana un campo `rango` (`hasta_10` | `hasta_25`) además del `plan` (`monthly`|`annual`) existente, para elegir el price ID correcto de los 4 disponibles.

### 8. `openspec/changes/mvp-reloj-checador/specs/billing/spec.md`

El requirement "Exceso de rango solicita upgrade" se reescribe para reflejar bloqueo duro en vez de aviso con margen de gracia, con su escenario actualizado. El resto de la spec de billing (trial, Stripe, bloqueo suave por falta de pago en tableros/reportes) no cambia.

## Fuera de alcance

- Rangos superiores a 25 (hasta 50, empresas medianas 50-250 vía venta directa/manual).
- Vista multi-empresa para contadores/gestores.
- OXXO/SPEI como método de pago (ya estaba fuera, sigue así).
- Downgrade de rango 25 → 10: se asume que el portal de Stripe lo permite igual que el upgrade (mismo mecanismo, sin lógica especial), pero no se construye ningún chequeo adicional del lado de Chekly más allá del enforcement normal (si al bajar de rango la empresa ya tiene más empleados activos que el nuevo tope, simplemente no podrá agregar más hasta dar de baja a alguien o volver a subir — no se fuerza ninguna baja automática).
