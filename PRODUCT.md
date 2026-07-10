# Product

## Register

product

## Platform

web

## Users

Dos audiencias con papeles distintos. El **comprador y administrador** es el dueño de una micro o pequeña empresa mexicana (1–50 empleados): fondas, talleres, comercios, despachos chicos. No es técnico, nunca compró software de RH, y compra "que no me multen" — su contexto es de urgencia legal, no de evaluación de features. El **usuario diario** es su empleado, que ficha entrada, salida y descansos desde su teléfono personal (Android de gama media/baja, a veces sin datos) o desde un kiosco compartido en el local, de pie, apurado, a veces bajo el sol.

Audiencia secundaria en el horizonte: **contadores y gestores** que administran decenas de micronegocios (canal de venta clave, exigirá vista multi-empresa), y empresas medianas (50–250) como expansión natural posterior.

## Product Purpose

PWA de reloj checador para que micro y pequeñas empresas cumplan con el registro electrónico de asistencia que exige la Ley Federal del Trabajo (art. 132 fracc. XXXIV, vigente desde el 1 de mayo de 2026) y naveguen la reducción gradual de jornada de la reforma de 40 horas (48→40 h entre 2026 y 2030). Registra entradas, salidas y descansos con evidencia (geocerca en teléfono personal; PIN + selfie en kiosco), funciona offline con cola local y doble timestamp, genera reportes exportables para inspecciones de la STPS, y alerta cuando un empleado se acerca al límite de horas vigente del año.

El éxito es un negocio rentable: el plan base de tarifa plana financia la operación por volumen, y los tiers superiores de RH (turnos, vacaciones, permisos, nómina) generan el margen. La base legal detallada, con lo firme y lo pendiente de reglamento, vive en `docs/research/reforma-40-horas-reloj-checador.md`.

## Positioning

El checador de tarifa plana que deja tu negocio en regla sin contratar un ERP: cumplimiento simple, precio fijo que se entiende en un segundo, y listo para usarse el mismo día.

## Brand Personality

**Confiable, simple, cercano.** Confiable porque vende cumplimiento legal: nada puede sentirse improvisado — números claros, estados visibles, registros honestos. Simple porque la competencia real es el papel y el Excel: cada pantalla se entiende sin manual. Cercano porque le habla a la fonda y al taller en español mexicano llano ("checar", no "registrar evento de asistencia"), sin jerga legal ni anglicismos SaaS.

## Anti-references

- **ERPs mexicanos de escritorio (CONTPAQi, Aspel):** pantallas densas, menús interminables, estética de otra década. Es el software que el cliente ya decidió que "no es para él".
- **El dashboard SaaS genérico:** gradientes, tarjetas de métricas por todos lados, espanglish ("Insights", "Analytics"), onboarding de 12 pasos. Comunica "para startups", no para una tortillería.
- **Los portales de gobierno (SAT, IMSS):** formularios eternos, lenguaje burocrático, sensación de trámite. El producto existe para proteger de la burocracia; no puede olerse a ella.

Prueba de fuego: si el dueño de un taller mecánico de 55 años lo abre y duda dónde tocar, fallamos.

## Design Principles

1. **Fichar en 5 segundos.** El gesto central del producto manda sobre cualquier otra decisión de pantalla: el fichaje siempre es lo más grande, lo más rápido y lo que nunca falla.
2. **La confianza se muestra, no se declara.** Estados siempre visibles (fichado/no fichado, sincronizado/pendiente), registros honestos sobre su origen (en vivo vs. sincronizado tarde), evidencia consultable. Un registro que parece trucable destruye la propuesta entera.
3. **Si duda dónde tocar, fallamos.** Interfaz autoevidente para usuarios no técnicos y de cualquier escolaridad: íconos + palabras simples en cada acción crítica, nunca texto legal en el flujo de fichaje.
4. **Protege, no burocratiza.** El producto es el escudo del dueño frente a la inspección y la multa; cada interacción debe reducir ansiedad, no agregar trámite.
5. **Paramétrico a la ley.** La norma cambia cada año (límite 46 h en 2027, 40 h en 2030) y su reglamento sigue pendiente: los límites, alertas y reportes se configuran, no se recompilan.

## Accessibility & Inclusion

WCAG 2.1 nivel AA como piso: contraste mínimo 4.5:1, objetivos táctiles generosos, información nunca dependiente solo del color, animaciones respetando `prefers-reduced-motion`. Encima, cuatro compromisos del contexto real de uso: legibilidad bajo el sol (alto contraste real en exteriores), botones de fichaje grandes para dedos apurados o manos ocupadas, rendimiento fluido en Android de gama baja, y lenguaje llano como requisito de accesibilidad — no solo de estilo — para usuarios con baja escolaridad.
