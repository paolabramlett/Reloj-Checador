# Correcciones de fichajes: qué exige la ley y cómo lo resuelven otros ("checadores olvidados")

**Fecha de investigación:** 13 de julio de 2026
**Método:** verificación contra fuentes primarias donde existen (texto vigente de la LFT en diputados.gob.mx, decreto DOF 01-05-2026, documentación oficial de producto de cada competidor). Las fuentes secundarias (despachos, blogs) se marcan como tales y solo se usan de pista.
**Advertencia:** investigación de producto, no asesoría legal. La sección de doctrina/jurisprudencia en particular debe revisarse con un(a) abogado(a) laboralista antes de tomarla como base de diseño definitiva — la reforma es de mayo de 2026 y todavía no hay criterios judiciales publicados que la interpreten.
**Contexto del problema:** en Chekly, `clock_events` es append-only por diseño. Un admin puede anotar una "corrección" en texto libre sobre un evento, pero hoy esa anotación es cosmética: no cambia el total de horas semanales calculado, no limpia `flag_sequence_anomaly`, y los eventos con esa bandera se excluyen por completo del cómputo SQL. Resultado: una salida olvidada, seguida de una entrada nueva sin salida registrada de por medio, hace que todo ese turno desaparezca silenciosamente del total semanal — horas realmente trabajadas se esfuman del número que ve el empleador, sin aviso.

---

## Resumen ejecutivo

- La LFT (art. 132, fracc. XXXIV) **no dice nada** sobre correcciones, ediciones, inmutabilidad o auditoría de los registros de asistencia. El texto legal se agota en: registrar electrónicamente inicio y fin de jornada, entregarlo a la autoridad cuando lo pida, y que "hará prueba plena si se acredita que fue acordado" entre trabajador y patrón. Las disposiciones de la STPS que podrían llenar ese vacío **siguen sin publicarse** al 13-jul-2026 (entran en vigor el 1-ene-2027, pero su contenido es desconocido).
- La única obligación indirecta y ya vigente que sí importa aquí es la carga de la prueba: arts. 784, 804 y 805 LFT ponen sobre el patrón la obligación de conservar y exhibir "controles de asistencia" y de probar la jornada trabajada; si no lo hace, se presumen ciertos los hechos que alegue el trabajador. **Que Chekly calcule menos horas de las que la persona realmente trabajó no protege al empleador — lo expone.** Un total semanal que "pierde" un turno completo por un fallo de diseño es, en sí mismo, un riesgo de cumplimiento.
- Ningún competidor investigado (ocho internacionales, cinco mexicanos) mantiene el fichaje crudo intocable a nivel de base de datos como principio de diseño explícito. Todos usan un modelo de **"editar + bitácora de auditoría"**: el valor que ve nómina se sobrescribe (o se reemplaza), y lo que se preserva es un registro de *quién cambió qué y cuándo*, no el dato original inmutable en el sentido estricto de Chekly.
- Recomendación: no romper la inmutabilidad de `clock_events` (es la ventaja competitiva y la lectura más prudente de "prueba plena si fue acordado"). En vez de eso, agregar una tabla de correcciones separada, vinculada al evento original, que sí alimente el cómputo de horas, sea también append-only, exija motivo, registre autor y fecha, y se muestre siempre junto al original — combinando el patrón de "editar con bitácora" de la industria con el principio de no-alteración que ya tiene Chekly.

---

## Parte 1 — Qué exige realmente la ley mexicana

### 1.1 Texto vigente del art. 132, fracción XXXIV LFT

Verificado en el texto vigente consolidado de la LFT (última reforma DOF 14-05-2026), el mismo que se usó en la investigación previa de este repositorio:

> **"Artículo 132.- Son obligaciones de los patrones: [...]**
> **XXXIV. Registrar de manera electrónica la jornada laboral de cada persona trabajadora, incluyendo el horario de inicio y finalización; así como proporcionarlo a la autoridad cuando se le requiera.**
> **La Secretaría del Trabajo y Previsión Social expedirá las disposiciones de carácter general que determinen el ámbito de aplicación y excepción a la obligación establecida en el párrafo que antecede.**
> **El contenido del registro electrónico hará prueba plena si se acredita que fue acordado entre la persona trabajadora y empleadora."**

Fuente primaria: [LFT texto vigente (PDF, Cámara de Diputados)](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf) y [decreto DOF 01-05-2026](https://www.dof.gob.mx/nota_detalle.php?codigo=5786537&fecha=01/05/2026) — mismos artículos ya verificados en `docs/research/reforma-40-horas-reloj-checador.md` de este repo.

**Lo que el texto NO dice — literalmente silencio total:**
- No menciona correcciones, ediciones, ni la posibilidad de modificar un registro ya capturado.
- No menciona inmutabilidad ni integridad técnica del registro (hash, sello de tiempo, WORM, etc.) — ninguna ley mexicana la exige hoy para este propósito.
- No dice qué pasa si un registro tiene un hueco (turno sin salida) ni cómo debe documentarse una corrección.
- No dice quién puede autorizar una corrección, ni si el trabajador debe poder verla o impugnarla.
- No define un plazo de conservación específico para el registro electrónico del 132-XXXIV (aplica, por defecto y de forma supletoria, el art. 804 general de controles de asistencia — ver más abajo).

Esto no es una lectura conservadora nuestra: se buscó expresamente cualquier mención a "corrección", "edición", "alteración" o "inmutabilidad" en el texto de la fracción XXXIV y en los transitorios del decreto, y no existe ninguna.

### 1.2 STPS: disposiciones generales — siguen sin publicarse

El Transitorio Quinto del decreto delega en la STPS emitir las "disposiciones de carácter general" que definirán ámbito de aplicación y excepciones de la fracción XXXIV, con entrada en vigor el **1 de enero de 2027**. Se repitió la búsqueda de esa publicación (DOF, sitio de la STPS, CONAMER) el 13-jul-2026 y **sigue sin localizarse** — mismo estado que se documentó el 10-jul-2026 en la investigación previa de este repo. No hay NOM específica de registro de asistencia ni criterio operativo de inspección publicado sobre el tema. [gob.mx/stps](https://www.gob.mx/stps) no tiene ningún aviso, borrador o consulta pública al respecto a la fecha de esta consulta.

**Conclusión honesta: no hay ninguna fuente oficial, ni ley ni reglamento ni criterio STPS, que diga cómo debe manejarse una corrección de fichaje.** Todo lo que sigue en esta sección es inferencia a partir de otras normas de la LFT que sí están vigentes y sí importan indirectamente.

### 1.3 Carga de la prueba y conservación — lo que sí es ley vigente hoy

Estos artículos no son nuevos (no vienen de la reforma de 2026) pero son el marco real bajo el que un total de horas "equivocado" se vuelve un problema legal:

- **Art. 784 LFT:** el tribunal exime al trabajador de la carga de la prueba en ciertos supuestos y "requerirá al patrón para que exhiba los documentos que [...] tiene la obligación legal de conservar, bajo el apercibimiento de que, de no presentarlos, se presumirán ciertos los hechos alegados por el trabajador". Entre los supuestos: fracc. III "faltas de asistencia" y fracc. VIII "jornada de trabajo ordinaria y extraordinaria, cuando ésta no exceda de nueve horas semanales".
- **Art. 804, fracc. III LFT:** el patrón debe conservar y exhibir en juicio "controles de asistencia, cuando se lleven en el centro de trabajo". Plazo: "durante el último año y un año después de que se extinga la relación laboral".
- **Art. 805 LFT:** no exhibir esos documentos en juicio genera la presunción de que son ciertos los hechos que alegue el trabajador.

Fuente primaria: mismos artículos citados y verificados en el texto vigente de la LFT en la investigación previa de este repo ([LFT texto vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf)).

**Por qué esto importa para el bug de corrección:** si el sistema descarta silenciosamente un turno completo del total semanal porque quedó marcado `flag_sequence_anomaly`, el "controles de asistencia" que el patrón exhibiría en juicio (un reporte generado por Chekly) estaría **subestimando** las horas trabajadas. Eso no ayuda al empleador — el art. 784 le exige a él probar la jornada, y un reporte que se contradice con la realidad (el trabajador sí trabajó ese turno, solo que olvidó marcar salida) es evidencia débil o contraproducente en un litigio, aparte de ser simplemente incorrecto para nómina.

### 1.4 Doctrina y jurisprudencia sobre registros editados vs. originales — hallazgo: prácticamente no existe todavía

Se buscó explícitamente jurisprudencia o tesis de Tribunales Laborales / Juntas de Conciliación y Arbitraje sobre el valor probatorio de un registro de asistencia **editado o corregido** frente a uno sin editar. **No se localizó ninguna tesis mexicana sobre el tema.** (Sí apareció un antecedente de casación peruana sobre registros de asistencia y carga de la prueba, pero es de otra jurisdicción y no aplica al análisis de la LFT — se descarta como fuente.)

Es un vacío razonable: la obligación de registro *electrónico* es de mayo de 2026, no ha habido tiempo material para que se litigue y se generen criterios. Cualquier afirmación de que "un registro editado pierde valor probatorio" o de que "debe preservarse el original para no perder prueba plena" es, hoy, **interpretación de producto basada en principios generales de derecho probatorio, no un mandato citable**.

El análisis más cercano a un tratamiento serio del tema —de fuente secundaria, se marca como tal— es [Foro Jurídico, "Control electrónico de asistencia, una ventana de oportunidad probatoria"](https://forojuridico.mx/control-electronico-de-asistencia-una-ventana-de-oportunidad-probatoria/): argumenta que la frase "hará prueba plena si se acredita que fue acordado" del 132-XXXIV puede no ser determinante en juicio, porque los tribunales laborales suelen aplicar el principio de "primacía de la realidad" (lo que realmente ocurrió pesa más que la forma en que se documentó). El artículo **no** discute correcciones, ediciones ni inmutabilidad — confirma el vacío, no lo llena.

**Interpretación prudente (juicio de producto, no lectura legal firme):** si algún día se litiga sobre un registro de Chekly, lo más defendible es poder mostrarle al tribunal (a) el marcaje original tal como el trabajador lo hizo, sin alterar, y (b) por separado, cualquier corrección posterior, con quién la hizo, cuándo y por qué. Eso reduce la posibilidad de que se argumente manipulación del registro — pero es una estrategia de solidez probatoria, no el cumplimiento de un requisito legal explícito, porque ese requisito no existe todavía en el texto.

---

## Parte 2 — Cómo lo resuelven otros sistemas (fuentes primarias: documentación propia de cada producto)

### 2.1 Jugadores mexicanos

| Producto | Qué dice su propia documentación | Fuente |
|---|---|---|
| **Worky** | El admin entra al detalle del registro y da clic en "Editar"; captura la nueva información y el sistema **sobrescribe** el registro con los nuevos datos, mostrando solo la etiqueta **"(Editado)"** — no hay evidencia documentada de que el valor original quede visible o recuperable en la UI. La edición no aplica a registros hechos por WhatsApp. | [Centro de ayuda Worky — "¿Cómo editar un registro de reloj checador?"](https://support.worky.mx/hc/es-419/articles/42728286318739--C%C3%B3mo-editar-un-registro-de-reloj-checador) |
| **Bizneo** | Flujo **empleado-inicia / responsable-aprueba**: en "Tiempo > Mis fichajes" el empleado usa "Solicitar cambio", edita el tramo, agrega un comentario opcional y envía. El responsable ve el comentario al aprobar. Una vez aprobada, el nuevo fichaje aparece directamente en "Mis fichajes" del empleado. | [Centro de ayuda Bizneo — "Cómo solicitar cambio en mis Fichajes"](https://help.bizneo.com/hc/es/articles/11334849804956--Empleados-Solicitudes-para-modificar-el-registro-horario) |
| **Runa HR** | No se localizó un artículo de ayuda propio sobre autocorrección o flujo de aprobación de fichajes olvidados. Su documentación pública remite al problema a "contacta al encargado de RH de tu empresa" — es decir, la corrección parece resolverse fuera del producto o en una capa no documentada públicamente. | [Centro de ayuda Runa — "¿Cómo funciona la app de asistencias de Runa?"](https://support.runahr.com/hc/es/articles/4409309661719--C%C3%B3mo-funciona-la-app-de-asistencias-de-Runa) |
| **Nomilinea** | No se localizó documentación propia (soporte/ayuda oficial) sobre el flujo de corrección de checadas olvidadas. Lo único encontrado sobre el tema viene de terceros (blogs de partners), no de Nomilinea directamente — se descarta como fuente primaria y se marca como **no verificado**. |  — |
| **ContPAQi (vía Tempo Control / Pensus Temporis)** | El manual de Pensus Temporis menciona una función llamada "checadas olvidadas" dentro del módulo de nómina, pero el PDF público no fue legible de forma confiable (documento con compresión binaria) y no se pudo confirmar el detalle del flujo (quién corrige, si se preserva el original, si requiere motivo). Se marca como **documentación insuficiente**, no como ausencia de la función. | [Manual Pensus Temporis (PDF)](https://www.pensus.com.mx/_Manuales/Manual_Pensus_Temporis.pdf) — mención localizada pero no verificable en detalle |

**Lectura honesta de esta fila:** solo dos de los cinco jugadores mexicanos (Worky y Bizneo) tienen documentación pública suficientemente clara como para describir su flujo de corrección con confianza. Eso en sí es un dato: la documentación pública sobre "qué le pasa a un fichaje olvidado" es floja en el mercado mexicano — una razón más para que Chekly lo documente bien, tanto para el usuario como para un eventual inspector.

### 2.2 Jugadores internacionales

| Producto | Original preservado o sobrescrito | Quién aprueba | Bitácora de auditoría visible | Alimenta el cómputo de horas | Fuente |
|---|---|---|---|---|---|
| **Deputy** | El manager edita el timesheet directamente; el cambio queda **marcado como "amended" (enmendado)** en el historial del timesheet, visible para quien apruebe. Una vez aprobado, el timesheet se bloquea y hay que "desaprobar" para volver a editar. | Manager (empleado puede revisar/objetar su propio timesheet antes de aprobación) | Sí — historial de enmiendas por timesheet | Sí, directamente (es el mismo valor que se aprueba y pasa a nómina) | [Deputy — "Adding, editing and approving Timesheets"](https://help.deputy.com/hc/en-au/articles/6997348381327-Adding-editing-and-approving-Timesheets) |
| **QuickBooks Time (TSheets)** | Se sobrescribe el valor "actual" del timesheet, pero cada timesheet tiene un ícono **"View Log"** con la bitácora completa de cambios, incluida la creación original. | Manager/admin (según permisos) | Sí — log completo por timesheet, exportable | Sí | [Comunidad Intuit — "What happens to the original entry if you go back and change a timesheet in TSheets?"](https://quickbooks.intuit.com/learn-support/en-us/quickbooks-time/what-happens-to-the-original-entry-if-you-go-back-and-change-a/00/540588) |
| **When I Work** | Entradas faltantes se resaltan; el manager llena la hora faltante o usa "Approve missing entries" para ignorarlas. Editar desaprueba el timesheet automáticamente. | Manager | Sí — historial por entrada: cuándo se creó, cómo, ediciones y quién las hizo | Sí | [When I Work — "Approve User's Timesheets"](https://help.wheniwork.com/articles/approve-users-timesheets/) |
| **UKG / Kronos (Workforce Dimensions)** | El sistema genera una "excepción" de tiempo faltante; el empleado puede "justificarla" y el manager la aprueba o cambia el código usado. Tras la aprobación del manager, el empleado ya no puede editarla. | Empleado propone (justifica) → manager aprueba/edita | Sí — pestaña "Audit" registra cada acción (p. ej. "Manager Justified Time"), y reportes de "Corrected Timesheets" muestran código de corrección, comentario y quién la agregó | Sí — el tiempo justificado se incorpora al timecard con el código de pago usado | [UKG — "Justify or approve missing time exceptions (managers)"](https://customer2.kronos.com/support/kol/onlinehelp-workforcedimensions/en-us/Content/Timekeeping/Exceptions_JustifyMissingTime_mgr.htm), [UKG — pestaña Audit](https://communityfiles.ukg.com/support/KOL/OnlineHelp-WorkforceDimensions/en-us/Content/Timekeeping/AuditingTab.htm) |
| **ADP (Time & Attendance / Workforce Now)** | Un punch faltante genera una "excepción de par de tiempo"; el sistema **no calcula el total de horas hasta que la excepción se resuelve** (patrón idéntico al bug actual de Chekly, pero con flujo de resolución obligatorio en vez de exclusión silenciosa). El supervisor captura la hora correcta en el "Timecard Manager" y la somete. | Supervisor (con aprobación adicional configurable por la empresa) | Documentado el flujo de resolución; no se confirmó en el material público el nivel de detalle de la bitácora | Sí — una vez resuelta la excepción, se recalcula el total | [ADP — "Resolving Timecard Exceptions Overview"](https://otcdc1.adp.com/ezLMHelp/V18_30/WFN/General/StandardUI/en-US/ss_help/ss/exceptions-intro.htm), [ADP — "Resolving Exceptions for Missing In or Out Punches"](https://otcdc1.adp.com/ezLMHelp/V18_30/WFN/General/StandardUI/en-US/as_help/ss/exceptions-missing_in_out.htm) |
| **BambooHR** | Admins/aprobadores con permiso de edición pueden modificar cualquier entrada del periodo de pago **mientras no esté aprobada**; una vez aprobado el timesheet, se bloquea. | Admin / aprobador de timesheet | Sí — historial de cambios por día (ícono de reloj) y "Change History" por periodo completo | Sí | [BambooHR — "Timesheets on the Employee Profile"](https://help.bamboohr.com/hc/en-us/articles/360013063254-timesheets-on-the-employee-profile), [BambooHR — actualización de producto sobre edición](https://www.bamboohr.com/product-updates/enhanced-timesheet-edit-capabilities-in-time-tracking) |
| **Homebase** | Ante una salida sin marcar, el propio empleado puede capturar la hora real y un motivo; el manager corrige/aprueba. Activar "Lock timesheets after approval" bloquea ediciones posteriores (con aviso si se intenta editar algo ya aprobado). | Empleado propone (con motivo) → manager aprueba | Sí — ícono de historial de edición por tarjeta de tiempo | Sí | [Homebase — gestión y edición de tarjetas de tiempo](https://support.joinhomebase.com/s/article/Step-6-Adding-Editing-Time-Cards), [Homebase — revisión de tarjetas de tiempo](https://support.joinhomebase.com/s/article/How-to-Review-Time-Cards) |
| **Buddy Punch** | El empleado puede editar/agregar un punch, pero si la empresa exige aprobación, queda en estado **"Pending Approval"** hasta que un admin lo revise; el admin, en cambio, puede editar o **borrar** punches de cualquier trabajador directamente, sin aprobación (permiso completo por defecto). | Empleado propone (si se requiere aprobación) → admin aprueba; o admin edita directo | Sí — "Audit report" de cambios y un "Deleted Time Report" que muestra quién borró qué y cuándo | Sí | [Buddy Punch — "How to Add or Edit Punches—Employee"](https://docs.buddypunch.com/en/articles/919241-how-to-add-or-edit-punches-employee-web-app), [Buddy Punch — "How to Add, Edit, or Delete Punches—Administrator"](https://docs.buddypunch.com/en/articles/3120907-how-to-add-edit-or-delete-punches-administrator-web-app), [Buddy Punch — "Overview of Reports"](https://docs.buddypunch.com/en/articles/3658502-overview-of-reports) |

**Patrón consistente en los ocho:** ninguno trata el marcaje crudo como un dato inmutable a nivel de base de datos con un principio de diseño explícito tipo "nunca se toca". Todos usan **"editar el valor de trabajo + dejar una bitácora del cambio"**. Lo que sí es universal:

1. **El valor editado/corregido SÍ alimenta el cálculo de horas/nómina** — en ninguno de los ocho una corrección aprobada se queda "cosmética" o separada del total, que es justo lo que le falta a Chekly hoy.
2. **Casi todos exigen un motivo o comentario** en la corrección (Deputy, UKG, Homebase, Nomilinea explícitamente; Bizneo lo deja opcional).
3. **La aprobación de un manager/admin es casi universal** para que la corrección "cuente" — el modelo varía entre "empleado propone, manager aprueba" (Bizneo, Homebase, UKG, Buddy Punch) y "manager/admin edita directo" (Worky, ADP, BambooHR, y Buddy Punch para admins).
4. **La bitácora de auditoría (quién, cuándo, qué cambió) es prácticamente estándar** — todos los que documentan el detalle la tienen.

---

## Recomendación para Chekly

### Diseño propuesto

1. **No tocar `clock_events`.** Sigue siendo append-only, sin excepción. Es más estricto que cualquiera de los trece sistemas investigados y es la base real del argumento "no se puede falsificar este registro" — vale la pena conservarlo como diferenciador, no diluirlo.
2. **Agregar una tabla de correcciones** (p. ej. `clock_event_corrections`), también append-only, con al menos: `id`, `corrects_event_id` (o rango de eventos/turno si aplica), `corrected_clock_in`/`corrected_clock_out`, `reason` (**obligatorio**, texto libre — no hace falta un catálogo de códigos para el tamaño de cliente que atiende Chekly), `created_by_admin_id`, `created_at`. Si una corrección necesita corregirse a su vez, se crea una **nueva** fila de corrección que reemplaza a la anterior — nunca se edita una corrección existente. Esto extiende el mismo principio de inmutabilidad que ya aplican a `clock_events`, en vez de crear una excepción a la regla.
3. **El cómputo semanal de horas debe usar la corrección cuando exista una, en vez de excluir el turno.** Es decir: cuando un evento (o par de eventos) tiene `flag_sequence_anomaly=true` y existe una corrección vigente vinculada, el cálculo usa los tiempos de la corrección para ese turno; si no hay corrección, se mantiene la exclusión actual (con la alerta visible que ya debería existir para que el admin sepa que hay horas huérfanas por resolver — si hoy no hay alerta, agregarla es una mejora barata e independiente de este cambio).
4. **Autorización: admin de la cuenta, sin segundo aprobador**, al menos en la primera versión. Es el patrón de Worky, ADP (supervisor) y BambooHR, y es el que mejor encaja con el perfil de cliente de Chekly (negocio chico, dueño/admin único que probablemente también es quien firma la nómina) — un flujo de "empleado propone / manager aprueba" tipo Bizneo/Homebase/UKG añade complejidad de producto sin que hoy haya evidencia de que el usuario objetivo lo necesite. Dejarlo como posible v2.
5. **Visibilidad para el trabajador: mostrar el original y la corrección lado a lado** en cualquier vista/reporte donde el empleado vea su historial — el original tal como quedó capturado (marcado, p. ej., "sin salida registrada") y, si existe, la corrección con motivo, quién la hizo y cuándo. Esto no es una exigencia legal explícita (no hay ninguna norma que obligue a que el trabajador vea o impugne una corrección — ver §1.4), pero es la práctica más extendida entre los competidores (siete de ocho internacionales dan visibilidad al empleado) y es la lectura más prudente de la frase "hará prueba plena si se acredita que fue acordado" del 132-XXXIV: un sistema donde el trabajador puede ver — aunque no apruebe — cada corrección sostiene mejor el argumento de que el registro sigue siendo confiable y consensuado.
6. **Reportes de cumplimiento (el "exporte listo para inspección" que ya está en el roadmap del research de la reforma de 40 horas) deben incluir ambas capas**: el marcaje original íntegro y, marcado como tal, cualquier corrección aplicada, con motivo y autor. Eso es exactamente lo que se necesitaría para sostener la carga de la prueba de los arts. 784/804/805 LFT si algún día se litiga — no porque la ley lo pida en estos términos (no lo hace, ver §1.4), sino porque es la forma más defendible de cumplir una carga de la prueba que sí es ley vigente hoy.

### De dónde sale cada pieza

| Elemento del diseño | Modelado en | Satisface |
|---|---|---|
| `clock_events` intocable, append-only | Diferenciador propio de Chekly (ningún competidor lo hace así de estricto) | Lectura prudente de "prueba plena si fue acordado" (132-XXXIV) — judgment call, no mandato explícito |
| Corrección como registro nuevo, vinculado, también append-only | UKG (bitácora "Audit"), QuickBooks Time ("View Log"), Buddy Punch ("Audit report" + "Deleted Time Report") | Ninguna norma lo exige; reduce riesgo probatorio si se litiga (interpretación, no ley) |
| Motivo obligatorio | UKG (comentario requerido por política), Nomilinea ("toda corrección debe quedar documentada" — nota: fuente secundaria, no verificada como doc propia de Nomilinea, se usa solo como patrón de industria) | Ninguna norma lo exige; buena práctica de auditoría |
| Corrección alimenta el cómputo de horas | Los ocho competidores internacionales sin excepción | Corrige el riesgo real y actual: art. 784/805 LFT — un total que subestima horas trabajadas debilita, no fortalece, la posición del empleador en juicio |
| Admin-only, sin segundo aprobador (v1) | Worky, ADP (supervisor), BambooHR | Judgment call de producto — perfil de cliente (micro/pequeña empresa), no requisito legal |
| Visibilidad del trabajador sobre original + corrección | Deputy, When I Work, UKG, BambooHR, Homebase, Buddy Punch (7/8 internacionales) | Judgment call, no mandato — pero es la práctica dominante y refuerza el "acordado" del 132-XXXIV |
| Export de cumplimiento con ambas capas | Patrón "Corrected Timesheets report" de UKG | Carga de la prueba: arts. 784, 804, 805 LFT (vigentes, no dependen de las disposiciones STPS pendientes) |

### Qué es juicio de producto y qué es requisito legal — para que quede explícito

**Requisito legal real, hoy:** conservar y poder exhibir controles de asistencia que reflejen la jornada trabajada (art. 804), y que el patrón cargue con la prueba de la jornada si se le exige (art. 784) so pena de que se presuman ciertos los hechos del trabajador (art. 805). El bug actual — horas que desaparecen del total — es lo único de todo este análisis que sí choca con una obligación legal vigente, indirectamente, porque produce un registro que no refleja la realidad y que el propio patrón tendría que exhibir en su contra.

**Todo lo demás es juicio de producto, no mandato de la LFT ni de la STPS:** que el original deba preservarse de forma inmutable, que la corrección deba ser un registro separado y no una edición in situ, que deba requerir motivo, que el trabajador deba poder verla, y que la autorización sea admin-only. Ninguna ley mexicana vigente lo exige en estos términos — el vacío es real (§1.1–§1.4) y las disposiciones STPS que podrían llenarlo no se han publicado. Estas decisiones están fundamentadas en (a) lo que hace la industria (Parte 2) y (b) una lectura prudente y defendible de los principios probatorios generales de la LFT, no en una cita legal directa. Vale la pena revisar este diseño con un abogado laboralista antes de construirlo, y **monitorear la publicación de las disposiciones STPS** (esperadas para antes del 1-ene-2027) por si fijan requisitos específicos de formato o auditoría que hoy nadie puede anticipar con certeza.

---

## Fuentes

### Primarias — legales

1. Ley Federal del Trabajo, texto vigente (última reforma DOF 14-05-2026): https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf — verificados arts. 132 (fracc. XXXIV), 784, 804, 805 (mismos ya verificados en `docs/research/reforma-40-horas-reloj-checador.md`)
2. Decreto de reforma a la LFT en materia de reducción de la jornada laboral, DOF 01-05-2026, edición vespertina: https://www.dof.gob.mx/nota_detalle.php?codigo=5786537&fecha=01/05/2026
3. Secretaría del Trabajo y Previsión Social, sitio oficial (verificado el 13-jul-2026, sin publicación relacionada con disposiciones del 132-XXXIV): https://www.gob.mx/stps

### Primarias — documentación propia de producto (competidores)

4. Deputy — "Adding, editing and approving Timesheets": https://help.deputy.com/hc/en-au/articles/6997348381327-Adding-editing-and-approving-Timesheets
5. Intuit / QuickBooks Time (TSheets) — foro oficial de soporte, "What happens to the original entry if you go back and change a timesheet in TSheets?": https://quickbooks.intuit.com/learn-support/en-us/quickbooks-time/what-happens-to-the-original-entry-if-you-go-back-and-change-a/00/540588
6. When I Work — "Approve User's Timesheets": https://help.wheniwork.com/articles/approve-users-timesheets/
7. UKG — "Justify or approve missing time exceptions (managers)": https://customer2.kronos.com/support/kol/onlinehelp-workforcedimensions/en-us/Content/Timekeeping/Exceptions_JustifyMissingTime_mgr.htm
8. UKG — "Justify missing time exceptions (employees)": https://communityfiles.ukg.com/support/KOL/OnlineHelp-WorkforceDimensions/en-us/Content/Timekeeping/Exceptions_JustifyMissingTime_emp.htm
9. UKG — pestaña de auditoría ("Use the Audit add-on"): https://communityfiles.ukg.com/support/KOL/OnlineHelp-WorkforceDimensions/en-us/Content/Timekeeping/AuditingTab.htm
10. ADP — "Resolving Timecard Exceptions Overview": https://otcdc1.adp.com/ezLMHelp/V18_30/WFN/General/StandardUI/en-US/ss_help/ss/exceptions-intro.htm
11. ADP — "Resolving Exceptions for Missing In or Out Punches": https://otcdc1.adp.com/ezLMHelp/V18_30/WFN/General/StandardUI/en-US/as_help/ss/exceptions-missing_in_out.htm
12. BambooHR — "Timesheets on the Employee Profile": https://help.bamboohr.com/hc/en-us/articles/360013063254-timesheets-on-the-employee-profile
13. BambooHR — actualización de producto, "Enhanced Timesheet Edit Capabilities in Time Tracking": https://www.bamboohr.com/product-updates/enhanced-timesheet-edit-capabilities-in-time-tracking
14. Homebase — "Step 6: Adding & Editing Time Cards": https://support.joinhomebase.com/s/article/Step-6-Adding-Editing-Time-Cards
15. Homebase — "How to Review Time Cards": https://support.joinhomebase.com/s/article/How-to-Review-Time-Cards
16. Buddy Punch — "How to Add or Edit Punches—Employee (Web/App)": https://docs.buddypunch.com/en/articles/919241-how-to-add-or-edit-punches-employee-web-app
17. Buddy Punch — "How to Add, Edit, or Delete Punches—Administrator (Web/App)": https://docs.buddypunch.com/en/articles/3120907-how-to-add-edit-or-delete-punches-administrator-web-app
18. Buddy Punch — "Overview of Reports": https://docs.buddypunch.com/en/articles/3658502-overview-of-reports
19. Worky — "¿Cómo editar un registro de reloj checador?": https://support.worky.mx/hc/es-419/articles/42728286318739--C%C3%B3mo-editar-un-registro-de-reloj-checador
20. Bizneo — "Cómo solicitar cambio en mis Fichajes": https://help.bizneo.com/hc/es/articles/11334849804956--Empleados-Solicitudes-para-modificar-el-registro-horario
21. Runa HR — "¿Cómo funciona la app de asistencias de Runa?" (no documenta flujo de autocorrección; remite a RH): https://support.runahr.com/hc/es/articles/4409309661719--C%C3%B3mo-funciona-la-app-de-asistencias-de-Runa

### Secundarias — solo pista/contexto, no sustentan afirmaciones normativas

22. Foro Jurídico — "Control electrónico de asistencia, una ventana de oportunidad probatoria": https://forojuridico.mx/control-electronico-de-asistencia-una-ventana-de-oportunidad-probatoria/ — discute el valor probatorio del 132-XXXIV frente al principio de "primacía de la realidad"; no aborda correcciones ni inmutabilidad
23. Manual Pensus Temporis (ContPAQi / Tempo Control), PDF: https://www.pensus.com.mx/_Manuales/Manual_Pensus_Temporis.pdf — menciona una función de "checadas olvidadas" pero el detalle del flujo no pudo verificarse por limitaciones de extracción del documento

### No verificado / no localizado

- **Disposiciones de carácter general de la STPS (art. 132-XXXIV LFT):** siguen sin publicarse al 13-jul-2026 (mismo estado que el 10-jul-2026). Su contenido podría, en teoría, imponer requisitos específicos de formato, auditoría o manejo de correcciones que hoy no existen en ninguna fuente pública. Monitorear DOF y gob.mx/stps antes del 1-ene-2027.
- **Jurisprudencia o tesis mexicana sobre valor probatorio de registros de asistencia editados vs. originales:** no se localizó ninguna. Es razonable dado que la obligación de registro electrónico tiene apenas semanas de vigencia; no hay tiempo material para litigio ni criterios publicados.
- **Documentación propia de Nomilinea sobre corrección de checadas olvidadas:** no localizada; lo único disponible viene de terceros y se descartó como fuente primaria.
- **Detalle completo del flujo de "checadas olvidadas" en ContPAQi/Tempo Control:** mencionado en manual público pero no verificable con las herramientas de esta investigación (PDF con extracción de texto poco confiable).
