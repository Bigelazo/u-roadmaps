# Avisos por Objeto y Resumen de cambios

El modelo de [ADR-0014](adr/0014-target-based-notice-grouping.md) está implementado.
No hay ventanas de 60 segundos, temporizadores de agrupación ni un Aviso separado
al cerrarse una ventana. Los Avisos pendientes y el último estado conocido de
cada destinatario se conservan en PostgreSQL, incluso tras reiniciar Node.

## Agrupación durable por Objeto del aviso

Cada Aviso compara un único Objeto con lo que el destinatario conocía: título,
descripción, tipo o acceso de un Nodo; un Recurso; un par dirigido de Dependencias;
el nombre de un Tipo de nodo; creación o eliminación de Nodo; disponibilidad del
Roadmap. Distintos aspectos del mismo Nodo son Objetos independientes. Cambios
posteriores al mismo Objeto actualizan el Aviso pendiente con el estado actual;
volver al valor conocido lo retira, sin importar cuánto tiempo haya transcurrido.
El acceso se compara por destinatario entre Disponible, Bloqueado y Retirado,
incluidas las cascadas y los Desbloqueos programados.

Un Recurso agregado y luego editado sigue siendo nuevo; agregado y eliminado
antes del reconocimiento no deja Aviso. Quitar y restaurar una Dependencia conocida
no deja Aviso; invertirla afecta dos pares distintos. Un Nodo nuevo absorbe sus
cambios de contenido, acceso y Recursos; ocultarlo o eliminarlo retira su creación.
Eliminar un Nodo conocido absorbe sus Objetos pendientes. Un Aviso pendiente de
Roadmap disponible absorbe los demás cambios de ese Roadmap.

Solo se muestran y cuentan Objetos visibles para el destinatario. Contenido y
Recursos de Nodos bloqueados se ocultan; título y tipo siguen visibles mientras
el Nodo sea visible. Los Avisos ocultos permanecen pendientes y pueden reaparecer.
La pérdida de Participación los retira definitivamente, incluidas las aperturas
pendientes de reconocimiento.

## Aviso agrupado del roadmap

Con tres o más Objetos visibles pendientes del mismo Roadmap, el Inbox presenta
una fila «El Roadmap de CC1002 ha recibido cambios» con «N cambios». Con uno o dos
presenta Avisos individuales. Cada Roadmap se agrupa por separado y disponibilidad
queda fuera de esta proyección. No se crea otra fila persistida de resumen.
Los contadores suman Objetos, no filas. Se agrupa antes de paginar; la fecha y el
cursor provienen del Objeto más reciente y la lista se ordena por esa fecha e ID.

## Reconocimiento y Resumen de cambios

Entrar al Roadmap captura y reconoce todos sus Avisos pendientes, incluidos los
que no son visibles, sin exponer su contenido oculto. En la primera entrada no se
muestra Resumen de cambios. En entradas posteriores con cambios visibles se muestra
un único dialog: Nodos agrupados bajo su título actual, ordenados por el cambio más
reciente, con Ruta y clasificación al final. No muestra autores, fechas ni enlaces;
Entendido solo cierra el dialog. Sin cambios pendientes no aparece.

Abrir el Inbox o un Nodo no reconoce nada; no existe estado «visto». El clic en un
Aviso navega al Roadmap sin abrir el Nodo. El conjunto y los valores capturados
pertenecen a una operación idempotente: una actualización posterior permanece
pendiente, incluso si se reintenta reconocer la operación anterior. Prefetch no
crea una visita. Salir o refrescar descarta el dialog y las respuestas tardías.

Inbox y contadores se actualizan en vivo para todos los roles. Solo las sesiones
docentes actualizan contenido del Roadmap en vivo. Estudiantes y observadores
cargan el estado nuevo al volver a entrar; una llegada de Avisos no abre un dialog
en medio de su sesión. La revocación de acceso sí verifica y retira contenido
protegido en cualquier rol. Véase [SSE](notifications-sse.md).

## Verificación

`own-notice-absorption.spec.ts` conserva el recorrido de entrega sin Inbox abierto,
absorción de cambios y reconocimiento con corte idempotente. El antiguo spec
`own-notification-summaries.spec.ts` de ventanas se retiró; su cobertura útil se
conserva bajo ese nombre nuevo. `roadmap-entry-summary.spec.ts` verifica el dialog.
Los specs de Objetos, agrupación, visibilidad y SSE complementan esos recorridos.

Las pruebas no esperan tiempo real para agrupar Avisos: esperan el estado guardado
con aserciones y consultas repetidas. Los temporizadores simulados de tests SSE
verifican coalescencia y reconexión, no agrupación de Avisos. La espera real de
200 ms en `own-realtime.test.tsx` verifica descarte tras desmontar; la de layout
verifica interacción del canvas. Ninguna define una ventana de agrupación.
Véanse [operaciones](notifications-operations.md) y [guía de pruebas](agents/testing.md).
