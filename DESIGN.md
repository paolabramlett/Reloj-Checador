<!-- SEED: re-run $impeccable document una vez que exista código (después de construir la pantalla de login) para capturar los tokens y componentes reales. -->

---
name: Chekly
description: Registro de asistencia confiable y sencillo para micro y pequeñas empresas mexicanas
---

# Design System: Chekly

## 1. Overview

**Creative North Star: "El Sello de Confianza"**

Chekly no se viste de startup ni de trámite de gobierno: se viste de comprobante. La superficie es restringida y casi silenciosa —blanco puro, texto casi negro— para que un solo verde de confianza haga todo el trabajo emocional: es el verde del "aprobado", del check, del semáforo en verde. Cuando aparece, el usuario sabe que algo quedó en regla sin que se lo tengamos que explicar.

La referencia no es Linear ni Notion — es Mercado Pago, WhatsApp Business y Stripe Checkout: herramientas que un dueño de taller o de fonda ya usa a diario, sin curva de aprendizaje, sin vocabulario de startup, con una sola acción obvia por pantalla. El sistema rechaza explícitamente los ERPs de escritorio mexicanos (CONTPAQi, Aspel), el dashboard SaaS genérico con gradientes y espanglish, y los portales de gobierno (SAT, IMSS) — las tres anti-referencias de `PRODUCT.md`. Si el dueño de un taller mecánico de 55 años duda dónde tocar, el sistema falló.

**Key Characteristics:**
- Restringido: neutrales + un único acento verde, nunca decoración por decoración.
- Una sola tipografía sans, sin jerarquía de familias que distraiga.
- Movimiento responsivo, nunca coreografiado: confirma, no entretiene.
- Objetivos táctiles generosos y alto contraste real, pensados para exteriores y dedos apurados.

## 2. Colors

**The Restrained Rule.** Neutrales tintados + un único acento cubriendo ≤10% de cualquier pantalla. El registro es "producto": el color sirve a la tarea, nunca decora.

### Primary
- **Verde de confianza** `[to be resolved during implementation]`: el "aprobado", el check, el semáforo en verde. Reservado para la acción de fichar, confirmaciones de éxito, y el estado "en regla". Familia de tono: verde franco, ni musgo ni menta — el verde que ya vive en el ícono de la PWA.

### Neutral
- **Blanco puro** `[to be resolved during implementation]`: fondo base. Sin tinte cálido — el calor de la marca lo carga el verde y la voz, no el fondo (evitar el "beige IA" de 2026).
- **Tinta casi negra** `[to be resolved during implementation]`: texto de cuerpo, con leve tinte hacia el verde de marca. Debe alcanzar ≥7:1 de contraste contra el fondo — no negociable dado el uso al aire libre.
- **Superficie secundaria** `[to be resolved during implementation]`: un neutral apenas distinto del fondo, para paneles y barras — nunca tarjetas anidadas.

### Named Rules (optional, powerful)
**The One Green Rule.** Un solo verde para todo el sistema. Si algo más necesita "sentirse aprobado", reutiliza este verde — no se inventan variantes.

## 3. Typography

**Display Font:** `[font pairing to be chosen at implementation]` — dirección: una sola sans bien afinada.
**Body Font:** la misma familia que el display.

**Character:** Una tipografía de trabajo, no de vitrina. Carga títulos, botones, etiquetas y datos sin cambiar de voz entre ellos — el usuario nunca debe notar que hay "una tipografía para verse bonito" y "otra para leer".

### Hierarchy
- **Display** (peso medio, escala fija en rem — no fluida): reservado para el número de horas y el estado de fichaje, lo único que merece tamaño de impacto.
- **Body** (regular, escala compacta 1.125–1.2 entre pasos): todo el resto de la interfaz. Línea máxima 65–75ch en prosa; las tablas de reportes pueden correr más densas.
- **Label** (medium, tamaño reducido): etiquetas de formulario, estados, marcas de origen de los registros.

### Named Rules (optional)
**The No Display-Font-in-UI Rule.** Ninguna tipografía decorativa en botones, etiquetas o datos — eso es para landing pages, no para una herramienta que se abre para fichar y listo.

## 4. Elevation

Plana por defecto. La energía de movimiento elegida es Responsiva —feedback y transiciones de estado, sin coreografía— y eso empuja hacia una jerarquía visual resuelta por contraste de superficie y tipografía, no por sombra. Si hace falta profundidad (un modal, un panel flotante), se resuelve con una sombra difusa y sutil, nunca decorativa.

### Named Rules (optional)
**The Flat-By-Default Rule.** Las superficies están planas en reposo. La sombra aparece solo como respuesta a un estado (foco, elevación temporal de un panel), nunca como adorno permanente de tarjetas o botones.

## 5. Components

`[pendiente: no hay componentes construidos todavía. Se documentan en el próximo $impeccable document, en modo scan, sobre la pantalla de login/fichaje.]`

## 6. Do's and Don'ts

### Do:
- **Do** usar el verde de confianza únicamente para la acción de fichar, confirmaciones y el estado "en regla" — su rareza es lo que lo hace significar algo.
- **Do** mantener objetivos táctiles generosos y contraste alto real, pensando en uso al aire libre y dedos apurados o con las manos ocupadas.
- **Do** usar una escala tipográfica fija en rem, no clamp() fluido — esto es una herramienta de trabajo, no una landing page.

### Don't:
- **Don't** parecerse a un ERP de escritorio mexicano (CONTPAQi, Aspel): pantallas densas, menús interminables, estética de otra década.
- **Don't** parecerse a un dashboard SaaS genérico: gradientes, tarjetas de métricas por todos lados, espanglish ("Insights", "Analytics"), onboarding de 12 pasos.
- **Don't** parecerse a un portal de gobierno (SAT, IMSS): formularios eternos, lenguaje burocrático, sensación de trámite.
- **Don't** usar texto legal o jerga técnica en el flujo de fichaje — lenguaje llano siempre, especialmente en los cuatro pasos críticos (fichar, confirmar, ver estado, corregir un error).
- **Don't** animar como coreografía de landing page — el movimiento aquí confirma un estado, no entretiene.
