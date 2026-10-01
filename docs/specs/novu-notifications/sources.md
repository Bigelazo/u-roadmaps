# Fuentes de la especificación de notificaciones con Novu

Recopilación íntegra del mapa #126 y sus diez hijos, leídos el 2026-09-30 mediante GitHub CLI. Los seis hijos cerrados conservan sus resoluciones y enlaces originales. Se respaldan también los cuatro hijos abiertos cuya eliminación pidió el usuario; sus preguntas se incorporan en la especificación o en el trabajo futuro. Este documento registra el estado previo a la eliminación, no el estado actual de GitHub.

Las decisiones de #132 prevalecen sobre el reconocimiento descrito originalmente en #129. La investigación previa sobre consolidación local es exploratoria y no sustituye las exclusiones de #126 y #128.


## #126 — Planificar el sistema de notificaciones de U-Roadmaps con Novu

- Estado al recopilar: OPEN (sin resolución).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/126
- Etiquetas: wayfinder:map

### Cuerpo original

## Destination

Una especificación lista para implementar del sistema de notificaciones de U-Roadmaps sobre Novu: alcance del MVP, contrato de Cambios del Roadmap, workflows, seguridad, superficies de Inbox y feedback contextual, reconocimiento granular, sincronización en tiempo real, validación y secuencia de entrega. El mapa también debe dejar especificado el futuro aviso previo al congelamiento, aunque su implementación no pertenezca al MVP.

## Notes

- Novu es una decisión previa y no se reevalúa como proveedor.
- El lenguaje canónico vive en `CONTEXT.md`; consultar `domain-modeling` cuando se resuelvan términos.
- Usar `graphify` antes de explorar relaciones del código y `codebase-design` para decidir los límites del módulo.
- Los prototipos de interfaz deben consultar `frontend-design` y `shadcn`; la integración React/Next.js debe consultar `vercel-react-best-practices` y las guías locales de Next.js 16.
- El MVP incluye campana e Inbox en la navegación, diálogo con la información entregada por Novu, indicadores en Nodo/Roadmap/Resumen académico, reconocimiento granular, fecha y hora, y actualización del Roadmap abierto ante cambios docentes.
- Los destinatarios de cambios docentes son todas las Participaciones activas del Curso —estudiantiles, observadoras y docentes— excepto la Participación autora. Estudiantes y observadores se filtran por acceso individual; para contenido y Recursos, el equipo docente se filtra solo por visibilidad y ausencia de Bloqueo docente, sin consultar Completions. El aviso futuro de congelamiento alcanza a todas las Participaciones activas del Curso y usa Inbox y correo.
- Los cambios se entregan después de confirmar la mutación, con semántica best effort: un fallo de Novu no revierte el cambio del Roadmap.
- Novu es la única persistencia de notificaciones del MVP. El diálogo puede agregar o resumir únicamente los datos que Novu exponga; no promete un historial exhaustivo.
- Las capacidades nativas de Novu administran repeticiones y múltiples notificaciones. El MVP no implementa consolidación semántica propia.
- Los cambios sobre Nodos siempre ocultos no se notifican. Ocultar y publicar sí; los cambios internos de un Nodo bloqueado no se notifican mientras sean inaccesibles, y desbloquear solo comunica disponibilidad.
- El aviso de congelamiento debe permanecer como ticket futuro porque el ciclo completo aún no está implementado.

## Decisions so far

- [Verificar el contrato operativo de Novu para el MVP](https://github.com/Bigelazo/u-roadmaps/issues/127) — Novu cubre autenticación HMAC, Inbox, Topics, estados y realtime; Digest es explícito y su detalle cliente requiere prototipo.
- [Cerrar el catálogo de Cambios del Roadmap y su matriz de entrega](https://github.com/Bigelazo/u-roadmaps/issues/128) — cinco clases funcionales, audiencia activa incluyendo al equipo docente salvo el autor, acceso por Participación, granularidad por Nodo, Digest nativo de 60 segundos, deep links y exclusiones explícitas.
- [Prototipar la campana, el diálogo y los indicadores contextuales](https://github.com/Bigelazo/u-roadmaps/issues/129) — prototipo interactivo y especificación para escritorio/móvil, primer cambio inmediato más digest separado, fechas efectivas, accesibilidad y destinos alternativos; la semántica de reconocimiento fue actualizada en #132.
- [Decidir la semántica de visto, leído y reconocimiento contextual](https://github.com/Bigelazo/u-roadmaps/issues/132) — visto por fila mostrada; leído al entrar al Roadmap para cambios generales o Nodos no abribles y al abrir cada Nodo accesible para sus avisos; diálogo después de navegar, Digest como unidad, avisos previos sin acceso conservados con destino al Resumen académico.
- [Probar la sincronización del Roadmap abierto a partir de Novu](https://github.com/Bigelazo/u-roadmaps/issues/130) — dos sesiones concurrentes probaron la señal de invalidación, nueva proyección HTTP y reconciliación de Nodo seleccionado ante edición, bloqueo, ocultamiento y eliminación; falta validar el callback WebSocket real de Novu.
- [Verificar la fuente programable del congelamiento de Roadmaps](https://github.com/Bigelazo/u-roadmaps/issues/133) — `roadmapFreezeDate` y su sincronización existen, pero todavía no hay ejecutor de cierre ni congelamiento persistido y atómico.

## Not yet specified

- No queda niebla identificada por ahora: las preguntas conocidas viven como tickets hijos abiertos y podrán revelar nuevas decisiones al resolverse.

## Out of scope

- Reconsiderar Novu o comparar proveedores.
- Implementar una tabla local de notificaciones, historial exhaustivo u outbox en el MVP.
- Consolidación semántica propia, reducción de cambios al estado neto o edición de notificaciones ya entregadas.
- Preferencias configurables por usuario y canales adicionales distintos del Inbox del MVP y el futuro correo de congelamiento.
- Ejecutar la implementación productiva dentro de este mapa; el destino es dejarla completamente especificada.


Sin comentarios al recopilar.


## #127 — Verificar el contrato operativo de Novu para el MVP

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/127
- Etiquetas: wayfinder:research

### Cuerpo original

Part of #126

## Question

¿Qué garantizan actualmente las APIs y SDK oficiales de Novu que condicionan el MVP: autenticación segura del suscriptor, Topics y fan-out, Inbox para Next.js/React, Digest y datos agregados, estados seen/read, filtros y conteos, timestamps, eventos en tiempo real, retención, regiones y límites? La investigación debe distinguir capacidades documentadas de supuestos que requieran prototipo, verificar compatibilidad con la versión actual del proyecto y dejar una nota enlazable basada solo en fuentes primarias.


### Comentario de Bigelazo (2026-09-17T20:58:21Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/127#issuecomment-5721133477

## Resolución

Novu cubre el contrato base del MVP sin persistencia paralela: Inbox seguro con HMAC, fan-out mediante Topics, estados seen/read, filtros y conteos por `data`, timestamps y actualización realtime del feed y sus contadores.

Hallazgos que condicionan el diseño:

- U-Roadmaps debe usar el UUID autenticado como `subscriber`, generar `subscriberHash` en servidor y mantener la Secret Key fuera del navegador. No corresponde usar un subscriber fallback.
- `@novu/nextjs` 3.19.2 declara compatibilidad con Next 16 y React 19; `@novu/api` es el SDK server-side para triggers, subscribers y Topics.
- Un Topic soporta hasta 100.000 subscribers, hace fan-out por subscriber y deduplica destinatarios presentes en varios Topics del mismo trigger. U-Roadmaps sigue siendo responsable de sincronizar la membresía con participaciones activas.
- Digest es un paso opcional del workflow, no un comportamiento automático. Los eventos agregados quedan disponibles para pasos posteriores, pero el cliente Inbox no recibe automáticamente esa lista: recibe el mensaje renderizado y el `data` explícito, limitado a 10 escalares y strings de 256 caracteres.
- El cliente permite filtrar y contar por `roadmapId`/`nodeId` en `data`, y marcar por IDs o filtros. Esto habilita reconocimiento granular sin tabla local.
- El realtime de Novu actualiza Inbox y conteos; no refresca el Roadmap. La conexión entre `notification_received` y el refetch local requiere ADR/prototipo.
- `createdAt` pertenece a la notificación de Novu. Para una hora de cambio de dominio debe proyectarse `occurredAt` al `data`; un Digest no expone todas las horas individuales al cliente por defecto.
- La guía actual para EU usa `apiUrl=https://eu.api.novu.co` y `socketUrl=wss://eu.socket.novu.co`. `backendUrl` aún aparece en una guía, pero está deprecado en los tipos publicados.
- La retención del Inbox es 30/90/90 días en Free/Pro/Team. Con Novu como única persistencia, los indicadores pendientes también quedan sujetos a esa retención.

La incertidumbre principal es la granularidad nativa de Digest: agrupar por Roadmap conserva su indicador pero puede perder los nodos afectados en cliente; agrupar por nodo conserva el reconocimiento granular pero produce un digest por nodo. Debe cerrarse con el prototipo descrito en la nota, junto con HMAC, región, Topics, filtros/conteos, dos sesiones realtime y fallos best-effort.

Nota completa: [`docs/research/novu-mvp-contract.md`](https://github.com/Bigelazo/u-roadmaps/blob/research/novu-mvp-contract-127/docs/research/novu-mvp-contract.md)
Commit: [`69c65a7`](https://github.com/Bigelazo/u-roadmaps/commit/69c65a7c04cdee0bcdcf9fb4f2880175e5b548dc)


## #128 — Cerrar el catálogo de Cambios del Roadmap y su matriz de entrega

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/128
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

¿Cuál es el catálogo exhaustivo de Cambios del Roadmap que merecen notificación, cómo se agrupan en clases comprensibles, qué Participaciones los reciben según visibilidad y acceso, qué información mínima y deep link lleva cada workflow, y cuándo una mutación técnica o puramente visual debe quedar excluida? La decisión debe cubrir creación, contenido, visibilidad, eliminación, bloqueos, Dependencias, Recursos, archivos y efectos transitivos sin convertir cada escritura interna en un evento de producto.


### Comentario de Bigelazo (2026-09-28T17:42:11Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/128#issuecomment-5875373166

## Resolución

Un **Cambio del Roadmap** se determina por el efecto confirmado de una acción docente sobre el contenido, la estructura o el acceso comprensible para una Participación, no por cada escritura técnica que la implementa.

### Audiencia

- Reciben cambios todas las Participaciones activas del Curso —estudiantiles, observadoras y docentes— excepto la Participación autora.
- Estudiantes y observadores se evalúan según su acceso individual.
- Para cambios de contenido y Recursos, el equipo docente recibe el aviso cuando el Nodo está visible y no tiene Bloqueo docente; no se consultan Completions ni prerrequisitos del alumnado.
- Una activación posterior no recibe historial y una desactivación posterior no retracta entregas previas.

### Catálogo y matriz de entrega

| Clase | Variantes notificables | Condición principal | Destino |
| --- | --- | --- | --- |
| Disponibilidad del Roadmap | Roadmap disponible | Creación inicial confirmada | Roadmap |
| Cambio de Nodo | Nodo disponible | Creación visible, publicación o transición Bloqueado → accesible | Nodo seleccionado |
| Cambio de Nodo | Nodo actualizado | Cambio de título, descripción o tipo asignado en un Nodo accesible; para docentes, visible y sin Bloqueo docente | Nodo seleccionado |
| Cambio de Nodo | Nodo retirado | Transición visible → oculto; conserva el título anterior | Roadmap |
| Cambio de Nodo | Nodo bloqueado | Transición accesible → bloqueado | Nodo seleccionado |
| Cambio de Nodo | Nodo eliminado | Eliminación de un Nodo visible, aunque estuviera bloqueado; conserva título y tipo | Roadmap |
| Cambio de ruta | Ruta del Roadmap actualizada | Dependencia agregada o eliminada entre Nodos visibles; indica «X ahora requiere Y» o «X ya no requiere Y» | Roadmap |
| Cambio de Recurso | Recurso agregado, actualizado o eliminado | Cambio confirmado en un Nodo accesible; para docentes, visible y sin Bloqueo docente | Nodo propietario |
| Cambio de clasificación | Clasificación de Nodos actualizada | Renombre de un Tipo utilizado por al menos un Nodo visible | Roadmap |

Reglas de impacto:

- Crear un Nodo oculto y eliminar un Nodo oculto no notifican. Publicarlo sí comunica **Nodo disponible** sin revelar que antes estaba oculto.
- Cambiar la causa subyacente de un Nodo que continúa bloqueado no notifica. Quitar un Bloqueo solo comunica **Nodo disponible** cuando la Participación recupera acceso.
- Cada Nodo cuyo acceso cambie por un efecto directo o transitivo obtiene su propia notificación para conservar indicadores y reconocimiento granular por `nodeId`. Las escrituras internas que materializan ese efecto no son eventos adicionales.
- Una Dependencia comunica siempre el cambio de ruta. Sus efectos de acceso se comunican además por cada Nodo cuya condición cambió para la Participación.
- Eliminar un Nodo no emite avisos separados por las Dependencias, Recursos, archivos o Completions eliminados en cascada.
- Los archivos no forman una clase aparte: subir, reemplazar o retirar uno se expresa como cambio del Recurso correspondiente.
- Crear o eliminar un Tipo sin uso no notifica. Cambiar solo su ícono o color tampoco; cambiar el tipo asignado a un Nodo es **Nodo actualizado**.

### Agrupación y entrega

- Novu agrupa por suscriptor, Roadmap, Nodo afectado y clase de cambio. Los cambios sin Nodo se agrupan por Roadmap y clase.
- Digest regular usa **When events repeat** con una ventana de 60 segundos: el primer cambio se entrega inmediatamente y las repeticiones se entregan después como Resumen de cambios. No se edita ni reemplaza la primera notificación.
- U-Roadmaps no implementa consolidación semántica, reducción a estado neto ni persistencia paralela para el MVP.
- La entrega ocurre después del commit y es best effort. Un fallo de Novu no revierte el Cambio del Roadmap; los reintentos usan una clave idempotente para no duplicarlo.

### Información mínima y navegación

Cada entrega conserva quién realizó el cambio, fecha y hora efectiva, código del Ramo, año y semestre, clase y descripción breve, identidad y título conservado de la entidad afectada y, cuando corresponda, cantidad y resumen del impacto. No se copian descripciones completas, URLs de Recursos ni archivos a Novu.

- Un Nodo existente abre el Roadmap con ese Nodo seleccionado.
- Un Recurso abre su Nodo propietario.
- Una Dependencia abre solo el Roadmap.
- La creación del Roadmap, el renombre de un Tipo y el retiro o eliminación de un Nodo abren el Roadmap.
- Si el destino dejó de existir o la Participación perdió acceso, la navegación degrada al Roadmap o al Resumen académico sin mostrar un error técnico.

### Exclusiones explícitas

No son Cambios del Roadmap notificables: mover Nodos; cambiar zoom, selección o disposición del canvas; cambiar solo ícono o color de un Tipo; abrir o cancelar previsualizaciones y confirmaciones; escrituras idénticas; validaciones fallidas; reintentos y mantenimiento técnico; operaciones físicas de archivos sin cambio confirmado de Recurso; Completions; autenticación y navegación; sincronización de participantes y cambios de actividad o rol; ediciones que permanezcan inaccesibles según las reglas anteriores; y el futuro workflow de congelamiento.

Esta resolución reemplaza la audiencia anterior de #126, que excluía al equipo docente.


## #129 — Prototipar la campana, el diálogo y los indicadores contextuales

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/129
- Etiquetas: wayfinder:prototype

### Cuerpo original

Part of #126

## Question

¿Cómo deben verse y comportarse la campana en la navegación, el Inbox, el diálogo de cambios, los indicadores en Nodo y Roadmap y el feedback del Resumen académico para que una persona comprenda qué cambió sin perder contexto? El prototipo debe cubrir escritorio, móvil, teclado, lector de pantalla, estados vacíos, timestamps, pocos cambios frente a cambios agregados por Novu y navegación hacia un Nodo existente o hacia un Roadmap cuando el Nodo ya no existe.


### Comentario de Bigelazo (2026-09-28T18:39:47Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/129#issuecomment-5876239822

## Resolución del prototipo

Artefactos en el repositorio: `docs/prototypes/issue-129-notifications.html` (prototipo interactivo con cinco escenarios) y `docs/prototypes/issue-129-notifications.md` (decisiones y contrato para implementación).

- La campana muestra avisos pendientes de todos los Roadmaps. El Resumen académico y el Roadmap muestran el total de su Curso; cada Nodo muestra solo sus avisos. El indicador del Nodo queda separado del Estado del nodo.
- Abrir Inbox o diálogo no reconoce el aviso. «Marcar como revisado» o navegar desde él reconoce únicamente esa notificación de Novu; los demás avisos e indicadores permanecen.
- El diálogo explica el cambio con Curso, autor y fecha/hora efectiva. Un Nodo o Recurso abre el Nodo propietario; Dependencias, creación, cambios de Tipo y Nodo retirado/eliminado abren el Roadmap. Si se pierde acceso, se vuelve al Resumen académico con explicación. El título de un Nodo eliminado se conserva en el aviso.
- El primer cambio inmediato y un Resumen de cambios posterior de Novu son dos filas. El resumen muestra solo la cantidad y los detalles que Novu entregue; no inventa cronología ni estado neto. Cada fila es una unidad de reconocimiento.
- El Inbox es acotado en escritorio y ocupa la pantalla en móvil. Hay estado vacío, controles de teclado, retorno de foco, nombres accesibles, anuncios de reconocimiento y fecha/hora absoluta en la zona local.

Se verificó el prototipo en Chromium para reconocimiento granular, digest, destinos alternativos, estado vacío y ancho móvil. Queda por validar con personas si dos filas cercanas para el mismo Nodo se comprenden bien y con Novu qué detalle exacto expone el digest; esas verificaciones están documentadas en la especificación.


## #130 — Probar la sincronización del Roadmap abierto a partir de Novu

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/130
- Etiquetas: wayfinder:prototype

### Cuerpo original

Part of #126

## Question

¿Qué estrategia concreta permite que una sesión estudiantil abierta reciba el evento de Novu, vuelva a solicitar la proyección autoritativa del Roadmap y preserve una interacción coherente cuando el Nodo seleccionado cambia, se bloquea, se oculta o se elimina? El prototipo debe usar dos sesiones concurrentes, separar actualización del Inbox de actualización del canvas y producir evidencia suficiente para redactar el ADR de sincronización en tiempo real.


### Comentario de Bigelazo (2026-09-29T15:22:34Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/130#issuecomment-5893235472

## Resolución del prototipo

Evidencia y decisiones en `docs/prototypes/issue-130-realtime-sync.md`. El prototipo incorporó una señal cliente aislada (`change-signal.ts`), una nueva lectura HTTP autoritativa de la Sesión del canvas del roadmap (`session.tsx`, `cache: 'no-store'`) y reconciliación de la selección (`RoadmapCanvasView.tsx`).

La estrategia para el ADR es: `notifications.notification_received` invalida la sesión estudiantil abierta del mismo Curso; el canvas vuelve a solicitar su proyección autorizada al servidor. El payload de Novu no dibuja contenido ni marca el aviso como leído. Si el Nodo sigue accesible, se conservan selección y detalle con datos nuevos. Si se bloquea, se cierra el detalle pero permanece como Nodo bloqueado. Si se oculta o elimina, se limpia la selección, se cierra el detalle, se devuelve el foco al lienzo y se informa lo ocurrido. Un contador de versiones descarta respuestas antiguas cuando se cruzan lecturas.

La prueba `tests/e2e/roadmap-realtime-prototype.spec.ts` abrió dos contextos autenticados simultáneos contra Next/PostgreSQL: docente y estudiante. Verificó edición, bloqueo, desbloqueo, ocultamiento, publicación y eliminación, esperando cada GET del Roadmap estudiantil posterior a la señal. Resultado: **1 E2E aprobado en Chrome**. La suite de sesión confirmó filtrado por Curso y orden de respuestas: **14 pruebas unitarias aprobadas**. TypeScript, ESLint y Prettier pasaron.

Límite explícito: no hay credenciales de Novu configuradas en este checkout. La prueba inyecta una `CustomEvent` determinista que representa el callback del SDK; **no valida la entrega real por WebSocket, su latencia ni el `data` efectivo de Novu**. La nota enumera esos pasos de validación para la integración posterior y los casos de reintento/reconexión que el ADR debe decidir.


## #131 — Decidir el límite arquitectónico del módulo de notificaciones

- Estado al recopilar: OPEN (sin resolución).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/131
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

¿Dónde debe vivir el módulo de notificaciones, qué interface profunda ofrece a las mutaciones del Roadmap y a sus superficies de lectura, cómo representa un trigger best effort después del commit, y cómo evita que Novu, React o los Route Handlers contaminen el modelo de dominio? La decisión debe respetar que Novu sea la única persistencia del MVP y definir contratos navegables para Inbox, Resumen académico y sesión del canvas.


Sin comentarios al recopilar.


## #132 — Decidir la semántica de visto, leído y reconocimiento contextual

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/132
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

¿Cómo se mapean los estados nativos de Novu a la experiencia acordada: abrir el Inbox, abrir el diálogo, seguir una notificación, entrar al Roadmap, abrir el Nodo y reconocer cambios agregados por Digest? La decisión debe evitar que una visita superficial borre indicadores de Nodos no revisados y establecer qué ocurre con notificaciones cuyo Nodo fue ocultado o eliminado.


### Comentario de Bigelazo (2026-09-30T17:06:50Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/132#issuecomment-5915994911

## Resolución

**Visto** y **leído** son estados distintos del aviso de Novu. Mostrar una fila del Inbox marca como visto solo ese aviso; abrir el Inbox, abrir el diálogo o cerrarlo no lo marca como leído. Los indicadores de campana, Curso, Roadmap y Nodo cuentan avisos **no leídos**, aunque ya estén vistos. La integración usa IDs concretos: Novu permite marcar como vistos varios `notificationIds` y marcar como leído un aviso por ID. No se usan `seenAll` ni `readAll` para estas interacciones.

### Navegación y reconocimiento

- Seleccionar una notificación navega primero al Roadmap y **después** abre allí su diálogo. Abrir el diálogo no reconoce el aviso. No habrá acción «Marcar como revisado».
- Entrar al Roadmap reconoce sus avisos generales: disponibilidad, Dependencias, cambios de Tipo y cualquier aviso cuyo Nodo no pueda abrirse por estar bloqueado, oculto o eliminado. El diálogo conserva el título anterior de un Nodo retirado. Esta entrada no reconoce avisos de Nodos accesibles.
- Abrir un Nodo accesible, directamente en el canvas o desde el diálogo, reconoce **todos** sus avisos pendientes, incluidos los de Recursos. No hace falta partir de una notificación.
- Cada Resumen de cambios de Novu es una unidad de reconocimiento. Si corresponde a un Nodo, se reconoce junto con sus demás avisos cuando se abre ese Nodo; si corresponde al Roadmap en general, al entrar al Roadmap. No se inventa reconocimiento por cambio interno de un Digest.
- Un aviso nuevo que llega mientras su Roadmap o Nodo ya está abierto permanece pendiente hasta una **nueva apertura** del destino correspondiente. Esto incluye un Digest entregado después de su ventana de agrupación.

### Pérdida de acceso

Después de perder acceso a un Roadmap no se entregan avisos nuevos a esa Participación. Los avisos entregados antes se conservan, como estableció #128. Si la persona interactúa con uno de ellos, se la lleva al Resumen académico, se explica que ya no tiene acceso y se reconoce ese aviso al llegar. No se abre el diálogo del Roadmap porque ese destino ya no está disponible.

Esta resolución reemplaza la semántica de reconocimiento y el orden de navegación del prototipo #129. Quedó registrada en `docs/adr/0011-acknowledge-roadmap-change-notices-in-context.md`; `docs/prototypes/issue-129-notifications.md` y su prototipo interactivo fueron actualizados. Se comprobaron los cinco escenarios del prototipo en Chromium, incluido el ancho móvil.

Documentación de Novu: [marcar avisos concretos como vistos](https://docs.novu.co/api-reference/subscribers/mark-notifications-as-seen) y [marcar un aviso como leído](https://docs.novu.co/api-reference/subscribers/mark-a-notification-as-read).


## #133 — Verificar la fuente programable del congelamiento de Roadmaps

- Estado al recopilar: CLOSED (COMPLETED).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/133
- Etiquetas: wayfinder:research

### Cuerpo original

Part of #126

## Question

¿Cuál es el estado real del ciclo de congelamiento basado en el calendario académico, qué datos y procesos existen hoy, qué transición sigue pendiente y qué señal programable y verificable podría iniciar un aviso previo? La investigación debe contrastar código, ADR-0001, ADR-0007 y pruebas, sin implementar el congelamiento ni su notificación.


### Comentario de Bigelazo (2026-09-17T20:54:49Z)

Fuente: https://github.com/Bigelazo/u-roadmaps/issues/133#issuecomment-5721093721

## Resolución

El ciclo de congelamiento está parcialmente implementado.

- La fuente autoritativa ya existe: `AcademicTerm.roadmapFreezeDate`, obtenida del calendario oficial FCFM y fijada al último día de exámenes. El modelo conserva además las fechas académicas, URLs de procedencia y `syncedAt`.
- Existe un workflow activo de GitHub Actions que sincroniza el calendario el 15 de abril y el 15 de octubre, además de `workflow_dispatch`. Sin embargo, el historial consultado el 2026-09-17 contiene cero ejecuciones, por lo que no hay evidencia operativa de una sincronización exitosa en producción.
- La aplicación deriva `historical` al cruzar la fecha, vuelve read-only la UI docente y rechaza en servidor las Completaciones y mutaciones de Previsualización del canvas.
- No existe la transición de cierre definida por ADR-0007: ningún job corre en la fecha, no se eliminan atómicamente los Bloqueos docentes, no se persiste un estado de congelamiento y las mutaciones editoriales de Nodos, Dependencias, Tipos de nodo y Recursos no validan el Período académico en servidor.
- La base local contiene cuatro Cursos y cero Períodos académicos; los fixtures no crean `AcademicTerm`, así que ningún Roadmap local llega a ser histórico por calendario.

La señal programable para el aviso futuro es `noticeAt = roadmapFreezeDate - anticipación`. Puede consumirse programando después del `upsert` exitoso o mediante un job periódico que consulte fechas próximas. Ninguna opción está implementada; la decisión posterior debe fijar anticipación, idempotencia, reprogramación/cancelación, hora y zona del corte.

La evidencia completa, fuentes y verificaciones reproducibles están en [Fuente programable del congelamiento de Roadmaps](https://github.com/Bigelazo/u-roadmaps/blob/39c24b1cae4a0082c4a7423b39c3e93543c9400a/docs/research/roadmap-freeze-source.md), commit [39c24b1](https://github.com/Bigelazo/u-roadmaps/commit/39c24b1cae4a0082c4a7423b39c3e93543c9400a).


## #134 — Decidir el workflow futuro de aviso previo al congelamiento

- Estado al recopilar: OPEN (sin resolución).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/134
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

Una vez conocida la fuente ejecutable del congelamiento, ¿con cuánta anticipación y repetición debe notificarse, cómo se corrige o cancela el aviso si cambia la fecha, qué Participaciones activas reciben Inbox y correo, y qué contenido y navegación necesita cada rol? El resultado debe dejar el workflow futuro especificado sin incorporarlo al MVP.


Sin comentarios al recopilar.


## #135 — Definir la validación, observabilidad y despliegue del MVP de notificaciones

- Estado al recopilar: OPEN (sin resolución).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/135
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

¿Qué combinación de pruebas contractuales, unitarias y E2E demuestra los workflows, destinatarios, timestamps, reconocimiento, feedback contextual y sincronización concurrente sin hacer la suite dependiente de Novu? ¿Qué ambientes, monitoreo de triggers best effort, límites, fallos y pasos de despliegue deben quedar visibles antes de habilitar el MVP?


Sin comentarios al recopilar.


## #136 — Decidir los cortes y la secuencia de implementación del módulo de notificaciones

- Estado al recopilar: OPEN (sin resolución).
- Fuente original: https://github.com/Bigelazo/u-roadmaps/issues/136
- Etiquetas: wayfinder:grilling

### Cuerpo original

Part of #126

## Question

Con las decisiones técnicas, de producto, UX y validación resueltas, ¿qué cortes verticales independientemente verificables convierten la especificación en una secuencia de implementación, cuáles pertenecen al MVP y cuáles al aviso futuro de congelamiento, y qué dependencias deben respetar? La resolución debe dejar tickets de ejecución listos sin implementar el módulo dentro de este mapa.


Sin comentarios al recopilar.
