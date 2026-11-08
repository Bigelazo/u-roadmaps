---
status: proposed
date: 2026-11-08
---

# Los comportamientos ocultos y los casos raros necesitan un pulido

Descubrimos por casualidad que el lienzo permite eliminar varias Dependencias a la vez, y eso mostró que la aplicación tiene más comportamientos que nadie diseñó como funcionalidad visible: gestos sin pista, procesos automáticos silenciosos, interfaz que solo aparece en ciertos estados y casos de datos poco frecuentes. Una revisión del código, sin cambios, encontró los que se listan aquí. Los atajos de teclado están en el ADR 0035 y no se repiten. Proponemos que un pulido posterior decida, para cada uno, si se hace visible, se corrige, se documenta o se elimina, y que agregue pruebas a los que se conserven. Las referencias apuntan al estado de la rama `feat/roadmap-dialog-polish`.

## Probables defectos

1. Arrastrar varios Nodos seleccionados guarda solo la posición del Nodo agarrado; los demás vuelven a su lugar al recargar, porque `onNodeDragStop` persiste solo ese Nodo (`src/features/roadmap/graph/RoadmapGraph.tsx:1145`). Requiere verificación manual.
2. La selección por área con Shift también selecciona Dependencias hacia Nodos fuera del recuadro, y Backspace las elimina junto con las demás.
3. Programar un desbloqueo para una hora ya pasada de hoy deja «Programar» habilitado y el envío no hace nada (`src/features/roadmap/editor/NodeDetailsEditor.tsx:188,195`).
4. «Crear nodo» falla sin mensaje cuando no hay espacio libre en la vista, por ejemplo con mucho zoom sobre una zona llena (`src/features/roadmap/session/RoadmapCanvasView.tsx:519-526`, `src/features/roadmap/editor/NodeCreator.tsx:183-190`).
5. Una descripción con solo espacios llega al servidor y se rechaza con «description debe ser un texto no vacío.» (`src/features/roadmap/canvas/commands/commands.ts`, `src/features/roadmap/application/validation.ts:32-37`).
6. Un título de más de 240 caracteres no tiene límite en el cliente, y el servidor responde «title debe ser un texto no vacío.», con una razón equivocada y el campo en inglés (`validation.ts:12-21`).
7. Entre el instante de Cierre del Roadmap y la siguiente pasada del cierre, hasta cinco minutos o más si el servidor estaba caído, la vista académica ya muestra «Solo lectura» pero el Roadmap sigue editable (`src/features/academic-overview/components/AcademicOverview.tsx:271`, `src/features/roadmap/domain/roadmap-capability.ts:56`).
8. El diálogo de creación no advierte los efectos de la copia: todos los Nodos visibles quedan con Bloqueo docente, no se copian los Desbloqueos programados y se descartan sin aviso los archivos que ya no existen en disco (`src/features/roadmap/domain/roadmap-copy.ts:82-83`, `src/features/roadmap/infrastructure/resources/lifecycle.ts:68-69`).
9. En la práctica docente, todos los Nodos nuevos aparecen en la misma posición fija y se superponen (`src/features/roadmap/practice/practice-roadmap.ts:27`). Sus marcas de cambios nunca se limpian.
10. Los enlaces profundos se pierden al iniciar sesión: tras el login siempre se llega a `/academic-overview` (`src/features/institutional-access/application/login.ts:78`).
11. El 6 de septiembre de 2026 no existe la hora 00:00–00:59 en America/Santiago; elegir 00:00, 00:15 u 00:45 resulta en 23:xx del día anterior. Al volver al horario de invierno no se puede elegir la segunda hora 23:xx (`src/shared/zoned-time.ts:37-41`, `src/shared/ui/date-time-picker.tsx:84-98`).
12. La invitación posterior a la creación dice «repetir» el tutorial, pero su botón siempre dice «Hacer tutorial» (`src/features/roadmap/ui/PostCreationInvitationDialog.tsx:25-28`). La campana por curso dice «avisos sin leer», aunque los Avisos no tienen estado de leído (`src/features/notifications/components/NotificationsInbox.tsx:53`).
13. Código muerto: el reintento del reconocimiento de Avisos al entrar (`NotificationsInbox.tsx:84-85,362-369`); el manejo de `?notice=` y `?targetNode=`, que ninguna parte de la interfaz genera (`NotificationsInbox.tsx:228`); la rama `hideOnPersonaPage` de `src/development/components/DevelopmentBar.tsx:20,40`, que apunta a una ruta inexistente; y `notificationsEnabled`, siempre verdadero (`src/features/notifications/server.ts:51-53`).
14. GLOSSARY.md enlaza `docs/notifications-operations.md`, que no existe, y menciona una actualización explícita de la nómina por el profesor de cátedra que no tiene control en `src/`.

## Gestos y comportamiento del puntero

- La Dependencia se crea arrastrando desde una superficie invisible alrededor del Nodo, que se activa al pasar por su cuerpo; arrastrar el cuerpo mueve el Nodo. Solo una sombra difusa lo insinúa (`src/features/roadmap/graph/RoadmapNode.tsx:568-606,673-688`, `src/features/roadmap/graph/use-whole-node-connection.ts:162-230`).
- Al hacer clic en una Dependencia aparece una X roja para eliminarla; el hover solo la colorea (`src/features/roadmap/graph/FloatingEdge.tsx:41-74`).
- En escritorio, las conexiones inválidas (a sí mismo, duplicadas, hacia Nodos ocultos o que forman ciclos) se rechazan sin mensaje; solo el modo flecha explica el motivo (`use-whole-node-connection.ts:87-104`).
- Si se eliminan varias Dependencias y algunas fallan, se informa el éxito de las eliminadas y la confirmación se reabre con las restantes (`commands.ts:574-593`).
- Doble clic en el fondo acerca el zoom; la rueda, el pellizco y el doble clic se desactivan con el menú radial abierto (`RoadmapGraph.tsx:1108-1112`).
- Al abrir el menú radial cerca del borde derecho o inferior, el lienzo se desplaza solo (`RoadmapGraph.tsx:546-580`). Sus íconos cambian del estado actual a la acción al pasar el cursor, y el disparador cambia de tamaño con el zoom (`RoadmapNode.tsx:236-258,390-412`).
- Los títulos largos se cortan en dos líneas y el título completo solo aparece en un tooltip nativo, invisible en pantallas táctiles (`RoadmapNode.tsx:657-662`).
- Las posiciones se ajustan a una cuadrícula de 20 px; arrastrar requiere más de 5 px y un clic tolera 6 px. Arrastrar un Nodo u ordenar termina al instante la animación de entrada.
- Superponer Nodos muestra «Hay dependencias sin espacio para trazarse. Separa los nodos superpuestos.» y esas Dependencias no se dibujan; si el ruteo falla, el aviso pide volver a abrir el mapa (`src/features/roadmap/graph/routing/DependencyRouting.tsx:196-205`).
- Si el motor de ruteo tarda o falla, aparece «Preparando dependencias…» y luego una alerta con «Reintentar»; hasta entonces no se dibujan Dependencias (`DependencyRouting.tsx:89-157`).
- Un estudiante que hace clic en un Nodo bloqueado ve un popover con el motivo (`RoadmapGraph.tsx:1371-1473`).

## Pantallas táctiles y diseño compacto

- Modo flecha: mantener un Nodo 450 ms, sin moverse más de 8 px, y tocar el destino. Se cancela con «Cancelar», Esc, un toque en el fondo, un segundo dedo o si el origen se oculta. Un destino inválido mantiene el modo con un mensaje (`use-whole-node-connection.ts:28-31,128-161,232-307`; cubierto por `tests/e2e/mobile-arrow-mode.spec.ts`).
- Bajo 1024 px: el menú del Nodo es una hoja inferior, la barra de herramientas muestra solo íconos y se desplaza, el título se oculta con 500 px de alto o menos, tocar el fondo cierra el panel lateral y la bandeja se abre a pantalla completa (`src/features/roadmap/graph/NodeActionSheet.tsx`, `RoadmapGraph.tsx:437,461-490,617-662,1131-1135`).
- La vista inicial compacta usa un zoom fijo (0,8 para estudiantes y 0,7 para el equipo docente) y centra en el primer Nodo disponible o en el Nodo superior izquierdo (`RoadmapGraph.tsx:115-210`).
- El ancho del panel lateral se guarda en el navegador, por separado para el editor y el detalle del estudiante, entre 320 y 560 px (`src/features/roadmap/ui/ResizablePanel.tsx:5-55`).
- Un Nodo nuevo aparece en el espacio libre de la cuadrícula más cercano al centro de la vista (`RoadmapGraph.tsx:403-418`).

## Archivos que se sueltan

- Soltar un único `.md` o `.markdown` sobre la descripción reemplaza el texto tras confirmar; otros archivos muestran un error (`src/features/roadmap/editor/MarkdownEditor.tsx:36-41,116-172`).
- Soltar varios archivos en los recursos conserva solo el primero, sin aviso; el servidor rechaza archivos vacíos o de más de 25 MB (`src/features/roadmap/editor/ResourceComposer.tsx:76-99`).

## Procesos automáticos y efectos silenciosos

- Las pasadas del Desbloqueo programado y del Cierre del Roadmap arrancan con el servidor y corren una vez al iniciar (`src/instrumentation.ts`). El desbloqueo corre cinco segundos después de cada cuarto de hora; el cierre, cada cinco minutos (`ROADMAP_CLOSURE_INTERVAL_MS`).
- Un Desbloqueo programado vencido espera mientras un prerrequisito conserve su Bloqueo docente. Programar un Nodo programa sus prerrequisitos bloqueados para el mismo momento, y una programación pendiente detiene un Desbloqueo de rama que llegue desde arriba.
- Bloquear un Nodo bloquea a sus dependientes visibles; conectar desde un Nodo bloqueado bloquea la rama del destino; desbloquear un Nodo con prerrequisitos bloqueados los desbloquea y consume sus programaciones.
- Ocultar un Nodo elimina sus Dependencias, su Bloqueo docente y su programación.
- El Cierre del Roadmap quita Bloqueos docentes y programaciones sin producir Avisos. Un lienzo docente abierto pasa a solo lectura cuando un guardado choca con el cierre (`src/features/roadmap/session/http-persistence.ts:32-34`).
- El progreso de la previsualización del lienzo se guarda por docente y persiste entre visitas hasta reiniciarlo; en Roadmaps cerrados no hay botón de reinicio.

## Avisos y tiempo real

- La primera visita reconoce los Avisos pendientes sin mostrar nada; desde la segunda aparece una vez el Resumen de cambios. La previsualización y la práctica no reconocen.
- La marca de cambios de un Nodo se limpia solo al abrir su panel y se oculta en Nodos bloqueados.
- La bandeja agrupa tres o más Avisos de un Roadmap; la campana por curso solo aparece con Avisos pendientes.
- El lienzo docente se recarga con señales de cambio, al volver a la pestaña o al recuperar la conexión. El lienzo del estudiante no se actualiza solo y queda desactualizado hasta recargar (`src/features/roadmap/session/session.tsx:173-218`).
- Perder el acceso redirige a `/academic-overview?accessLost=1` con una alerta.
- Si otro docente elimina o bloquea el Nodo abierto, el panel se cierra con un aviso; un borrador local muestra «Conservar mi borrador sobre la versión actual» (`src/features/roadmap/editor/NodeEditor.tsx:452-480`).
- Si el impacto cambió con la confirmación abierta, el diálogo se vuelve a presentar con los datos actuales en vez de aplicar (`src/features/roadmap/canvas/commands/use-canvas-commands.ts:189-200`).

## Interfaz según estado y rol

- Roadmap cerrado: Dependencias negras y no seleccionables, «Completar» deshabilitado y «Solo lectura» con historial de versiones en la vista académica.
- La previsualización del lienzo guarda y restaura la selección, el editor y la vista, y exige resolver el borrador antes de entrar.
- La vista previa como estudiante del editor proyecta cambios sin guardar, y su «Completar» no guarda nada.
- Solo el profesor de cátedra crea Roadmaps, y nadie después del día de congelamiento.
- La invitación posterior a la creación aparece solo con el primer Roadmap del usuario y una sola vez; la invitación de primera visita también una sola vez; al salir de un tutorial se destaca su ícono.
- Eliminar un tipo de Nodo en uso se rechaza recién después de confirmar.

## Rutas, parámetros y entorno

- Parámetros sin enlace en la interfaz: `?targetNode=`, `?notice=`, `?created=1`, `?origin=` en la práctica, `?accessLost=1`, `?noticeFallback=` y `/?error=Authentication`.
- Endpoints sin consumidor en el cliente: `GET /api/notifications/[noticeId]` y `GET /api/academic-overview`.
- Herramientas de desarrollo: el selector «Perfil», `POST /api/development/session` y `POST /api/development/reset`, este último sin enlace.
- `UPLOADS_DIRECTORY` y `ROADMAP_CLOSURE_INTERVAL_MS` cambian el comportamiento.
- El buscador de miembros ignora tildes y, sin nómina de U-Campus, usa las participaciones locales.

## Consecuencias

- Cada defecto confirmado necesita un issue y una prueba que lo reproduzca antes de corregirlo.
- Los gestos y los efectos silenciosos que se conserven deben poder descubrirse en la interfaz, con el mismo criterio que el ADR 0035 aplica a los atajos.
- El código muerto listado puede eliminarse sin cambiar el comportamiento visible.
