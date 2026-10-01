# Sistema de notificaciones de U-Roadmaps con Novu

Especificación generada con `to-spec`, a partir del mapa [#126](https://github.com/Bigelazo/u-roadmaps/issues/126) y de las resoluciones completas de #127, #128, #129, #130, #132 y #133. Fecha de síntesis: 2026-09-30.

## Problem Statement

Las Participaciones de un Curso no tienen una forma integrada de enterarse de cambios docentes relevantes en su Roadmap. Una persona puede mantener abierto un Nodo que ya cambió o dejó de ser accesible, perder cambios entre visitas o confundir haber mostrado un aviso con haber revisado su contexto. El equipo docente también necesita conocer las modificaciones realizadas por otras Participaciones docentes.

El proyecto dispone de investigación y prototipos, pero todavía no de una integración productiva con Novu. La planificación debe convertirse en un contrato implementable que respete el acceso individual y conserve las decisiones ya tomadas, sin prometer un historial exhaustivo ni entrega garantizada.

## Solution

Incorporar una campana e Inbox de Novu para las personas autenticadas, indicadores de avisos no leídos en Resumen académico, Roadmap y Nodo, y un diálogo que explique cada aviso después de navegar a su Roadmap. Reconocer los cambios al entrar a su contexto: Roadmap para cambios generales o Nodos no abribles, y apertura de un Nodo accesible para todos sus avisos pendientes, incluidos los de Recursos.

Entregar los Cambios del Roadmap después de confirmar la acción docente, a las Participaciones activas elegibles excepto la autora. Agrupar repeticiones con Digest nativo, manteniendo separadas la primera entrega inmediata y el Resumen de cambios posterior. Usar las notificaciones recibidas para volver a consultar la proyección autorizada del Roadmap abierto.

El MVP usa exclusivamente Inbox. El aviso previo al congelamiento, por Inbox y correo, queda registrado como trabajo futuro dependiente del ciclo de cierre académico.

## User Stories

1. Como Participación estudiantil, quiero enterarme cuando se crea el Roadmap de mi Curso para comenzar a recorrerlo.
2. Como Participación observadora, quiero recibir los mismos avisos compatibles con mi acceso estudiantil para seguir el Curso.
3. Como Participación docente, quiero conocer cambios de otras Participaciones docentes para coordinar el Roadmap compartido.
4. Como persona autora, quiero que mis propias acciones no me generen avisos redundantes.
5. Como Participación, quiero recibir avisos solo de Cursos donde mi Participación está activa.
6. Como Participación que se incorpora después, quiero recibir cambios futuros sin que se me envíe un historial anterior.
7. Como Participación, quiero saber cuándo un Nodo visible se crea o publica para descubrir contenido disponible.
8. Como Participación, quiero saber cuándo recupero acceso a un Nodo para continuar mi recorrido.
9. Como Participación, quiero conocer cambios de título, descripción o Tipo asignado de un Nodo que puedo consultar.
10. Como Participación, quiero saber que un Nodo fue retirado y conservar su título anterior para comprender su ausencia.
11. Como Participación, quiero saber cuándo un Nodo que podía consultar queda bloqueado.
12. Como Participación, quiero conocer la eliminación de un Nodo visible, incluso si estaba bloqueado.
13. Como Participación, quiero entender qué prerrequisito se añadió o retiró de una ruta.
14. Como Participación, quiero reconocer por separado cada Nodo cuyo acceso cambió por un efecto transitivo.
15. Como Participación, quiero enterarme de Recursos agregados, actualizados o eliminados en Nodos accesibles.
16. Como Participación, quiero comprender cambios de archivos mediante su Recurso correspondiente.
17. Como Participación, quiero conocer el renombre de un Tipo utilizado por Nodos visibles.
18. Como Participación, quiero evitar avisos por movimientos del canvas, cambios visuales, previsualizaciones o acciones fallidas.
19. Como Participación, quiero que las ediciones de contenido inaccesible no me revelen información restringida.
20. Como persona autenticada, quiero una campana con mis avisos pendientes de todos los Roadmaps.
21. Como Participación, quiero ver en el Resumen académico qué Cursos tienen avisos pendientes.
22. Como Participación, quiero consultar el Inbox filtrado al Roadmap que estoy revisando.
23. Como Participación, quiero ver los avisos de cada Nodo sin confundir su indicador con el Estado del nodo.
24. Como Participación, quiero que una fila mostrada quede vista sin reducir los avisos no leídos.
25. Como Participación, quiero seleccionar un aviso y llegar primero a su Roadmap, con el diálogo abierto allí.
26. Como Participación, quiero conocer el Curso, autor, título conservado y fecha y hora efectiva de cada cambio.
27. Como Participación, quiero entrar al Roadmap y reconocer sus cambios generales sin borrar avisos de Nodos accesibles que aún no abrí.
28. Como Participación, quiero abrir un Nodo directamente en el canvas y reconocer todos sus avisos pendientes, incluidos Recursos.
29. Como Participación, quiero que abrir o cerrar el diálogo por sí solo no reconozca avisos.
30. Como Participación, quiero que los cambios de Nodos bloqueados, ocultos o eliminados se reconozcan al entrar al Roadmap.
31. Como Participación, quiero que un aviso recibido con su destino ya abierto siga pendiente hasta volver a abrir ese destino.
32. Como Participación, quiero recibir el primer cambio inmediatamente y las repeticiones agrupadas después.
33. Como Participación, quiero que un Resumen de cambios conserve la granularidad del Nodo y se reconozca como un aviso indivisible.
34. Como Participación, quiero que el diálogo muestre únicamente el detalle que Novu realmente entregue.
35. Como Participación, quiero que mis fechas se muestren de forma absoluta en mi zona horaria local.
36. Como Participación, quiero que los cambios del mismo aviso se reflejen en sus contadores de todas las superficies y pestañas.
37. Como Participación, quiero que un aviso de un Recurso abra su Nodo propietario.
38. Como Participación, quiero que un destino eliminado o inaccesible tenga una alternativa comprensible.
39. Como Participación que perdió acceso, quiero conservar avisos anteriores y que seleccionarlos me lleve al Resumen académico con explicación.
40. Como Participación, quiero mantener abierto mi Roadmap y recibir su contenido actualizado sin recargar manualmente toda la página.
41. Como Participación, quiero conservar mi selección cuando el Nodo sigue accesible y cerrar su detalle si se bloquea o desaparece.
42. Como Participación, quiero que una respuesta antigua no reemplace un estado más reciente.
43. Como Participación, quiero recuperar el estado actual al volver a la pestaña o recuperar la conexión.
44. Como Participación, quiero distinguir un Inbox vacío de uno que no pudo cargarse y poder reintentar.
45. Como persona usuaria de móvil, teclado o lector de pantalla, quiero recorrer campana, Inbox, diálogo y destino con foco y nombres accesibles.
46. Como Participación docente, quiero que mis cambios confirmados permanezcan guardados aunque falle Novu.
47. Como responsable de operación, quiero identificar fallos de envío y verificar la integración real antes de habilitarla.
48. Como futura Participación, quiero recibir por Inbox y correo un aviso previo al congelamiento que corresponda a una fecha académica verificada; esta historia no pertenece al MVP.

## Implementation Decisions

### Autoridad y procedencia

- #128 fija el catálogo, audiencia y Digest. #132 y ADR-0011 fijan reconocimiento y sustituyen el comportamiento inicial de #129: no existe acción «Marcar como revisado» y el diálogo abre después de navegar.
- #130 prueba la invalidación y reconciliación locales; no prueba el callback WebSocket real. #133 prueba la disponibilidad de la fecha académica; no prueba la ejecución del cierre.
- Las decisiones de arquitectura, contratos concretos, recuperación de conexión y despliegue descritas a continuación completan esta especificación por síntesis. No se atribuyen a los issues eliminados ni se presentan como prototipos ya validados.
- Se respeta el glosario: Cambio del roadmap es el hecho de dominio; Resumen de cambios es un aviso agregado. Se respetan ADR-0001, ADR-0010 y ADR-0011; ADR-0007 mantiene su estado propuesto y sus capacidades pendientes.

### Catálogo y audiencia

| Clase | Variante notificable | Condición | Destino inicial |
| --- | --- | --- | --- |
| Disponibilidad del Roadmap | Roadmap disponible | Creación inicial confirmada | Roadmap |
| Cambio de Nodo | Nodo disponible | Creación visible, publicación o transición bloqueado a accesible | Nodo |
| Cambio de Nodo | Nodo actualizado | Título, descripción o Tipo asignado; contenido accesible | Nodo |
| Cambio de Nodo | Nodo retirado | Visible a oculto; conserva título anterior | Roadmap |
| Cambio de Nodo | Nodo bloqueado | Accesible a bloqueado | Nodo, con alternativa Roadmap |
| Cambio de Nodo | Nodo eliminado | Eliminación de Nodo visible, incluso bloqueado; conserva título y Tipo | Roadmap |
| Cambio de ruta | Ruta actualizada | Dependencia agregada o retirada entre Nodos visibles | Roadmap |
| Cambio de Recurso | Agregado, actualizado o eliminado | Recurso de un Nodo accesible | Nodo propietario |
| Cambio de clasificación | Clasificación actualizada | Renombre de Tipo usado por al menos un Nodo visible | Roadmap |

- Audiencia: todas las Participaciones activas del Curso salvo la autora, sin restringir por Sección. La identidad del suscriptor es el UUID canónico del Usuario, nunca RUT ni correo.
- Para estudiantes y observadores se reutiliza la proyección individual de acceso con sus Completaciones. Para docentes, la elegibilidad de contenido y Recursos exige visibilidad y ausencia de Bloqueo docente, sin consultar Completaciones. Los efectos de acceso docentes se comparan por visibilidad y Bloqueo docente.
- Se compara el efecto anterior y posterior de una acción confirmada. Cada Nodo con una transición de acceso, directa o transitiva, conserva su propio aviso y `nodeId`, incluidos Nodos supervivientes cuyo acceso cambia al retirar otro Nodo y sus Dependencias. Cambiar la causa de un bloqueo que continúa no produce aviso. Recuperar acceso comunica disponibilidad sin revelar ediciones anteriores inaccesibles.
- Publicar un Nodo comunica disponibilidad sin revelar que antes estuvo oculto. Crear, editar o eliminar un Nodo que permanece oculto no notifica.
- Agregar o quitar una Dependencia comunica «X ahora requiere Y» o «X ya no requiere Y», y además los cambios de acceso de cada Nodo afectado. Las eliminaciones en cascada por retirar o eliminar un Nodo forman parte de esa acción y no generan avisos independientes por cada escritura interna.
- Eliminar un Nodo no produce avisos separados por Dependencias, Recursos, archivos o Completaciones eliminados en cascada. Subir, reemplazar o retirar archivos solo notifica por el cambio confirmado de su Recurso.
- Renombrar un Tipo utilizado por Nodos visibles notifica una vez a nivel Roadmap. Crear o eliminar un Tipo sin uso o cambiar únicamente su icono o color no notifica. Cambiar el Tipo asignado a un Nodo sí es Nodo actualizado.
- Una activación posterior no recibe backfill. Una desactivación impide nuevos triggers y no retracta avisos anteriores. Se vuelve a comprobar actividad antes de enviar o reintentar; los workflows que Novu ya aceptó están sujetos a la limitación de entrega best effort, sin autorización transaccional compartida con PostgreSQL.

### Module e Interface

- El Module del Roadmap conserva la autorización, captura de estado anterior/posterior, reglas de acceso, catálogo y cálculo de audiencia. Genera descriptores independientes de Novu dentro de la transacción y los publica únicamente al confirmar el commit. Captura los títulos necesarios antes de eliminar entidades.
- Un Module de notificaciones ofrece una Interface pequeña: preparar la identidad autenticada del Inbox, entregar descriptores confirmados a destinatarios explícitos y ofrecer al cliente lectura/conteos y operaciones sobre IDs concretos. Su Implementation encapsula workflows, SDK, errores, límites, idempotencia y transporte. El dominio no importa Novu, React ni Route Handlers.
- El servidor usa `@novu/api`; el cliente usa el proveedor y hooks disponibles en `@novu/nextjs` para renderizar la interacción acordada. El modo headless evita el reconocimiento automático o acciones globales de la UI predeterminada. No se duplican clientes, sockets o stores por indicador.
- La composición de dependencias permite un Adapter real y uno determinista de pruebas en la Seam de transporte de notificaciones. Se reutilizan las Interfaces públicas del Roadmap y de la Sesión del canvas del roadmap. Los Route Handlers conservan la traducción HTTP y no calculan audiencia ni Cambios del Roadmap.
- Los imports entre features usan sus exports públicos. No se introduce un bus genérico de eventos ni una abstracción para proveedores hipotéticos. Una prefactorización necesaria se incluye en el primer corte funcional y conserva las respuestas existentes de las mutaciones.
- No hay tabla de notificaciones, outbox ni historial local. El modelo vigente no distingue todavía todos los cargos/roles del glosario: los observadores reciben el tratamiento de acceso estudiantil compatible con su representación actual. Este esfuerzo no completa el modelo institucional de ADR-0007.

### Entrega, suscriptores y workflows

- La mutación se confirma antes de cualquier llamada a Novu. Un fallo de creación de suscriptor, envío o timeout no revierte datos ni convierte una edición correcta en una respuesta de error. La respuesta de la mutación mantiene su contrato.
- Se materializan/actualizan suscriptores desde Usuarios autorizados, incluyendo participantes elegibles que aún no hayan abierto el Inbox. La sincronización institucional sigue siendo autoridad de la actividad; no emite avisos de contenido por sí misma.
- El fan-out del MVP usa destinatarios explícitos calculados por acción y Participación, divididos en lotes según el límite efectivo de la API fijada. Un Topic de Curso por sí solo no representa acceso individual a un Nodo. Topics quedan como optimización opcional para audiencias uniformes y solo se habilitan con membresía reconciliada y exclusión de la autora; la corrección no depende de esa optimización.
- Cinco workflows estables corresponden a las cinco clases del catálogo; las variantes viajan en el payload. Se configuran en Novu con un manifiesto reproducible y ejemplos de entradas/salidas mantenidos en el repositorio. El dashboard gestiona Digest e In-App; no se agrega Bridge al MVP. Si la configuración del dashboard no puede expresar la proyección acordada, se resuelve dentro del corte de Digest antes de habilitarlo, sin sustituirla por consolidación local.
- Cada acción confirmada recibe una identidad de evento estable durante sus intentos de envío; cada efecto/lote recibe una clave distinta. Se conserva la misma clave de idempotencia en reintentos del mismo envío. Dos acciones distintas nunca comparten clave, aunque afecten el mismo Nodo. El Adapter traduce esta identidad a la operación de idempotencia soportada por el SDK fijado; no confunde la clave de Digest con la de idempotencia.
- Se limita a dos intentos por envío, con timeout de 3 segundos por intento; 429 respeta `Retry-After` solo cuando cabe en ese presupuesto. Se reintentan fallos transitorios, no credenciales inválidas o payload inválido. Se espera el envío acotado tras el commit, evitando promesas sin esperar que puedan perderse al terminar la solicitud. No existe recuperación durable tras caída del proceso.

### Contrato de datos y Digest

- El descriptor de servidor incluye identidad de evento, instante efectivo UTC, autor, Curso, Roadmap, clase/variante, entidad y títulos conservados, impacto breve y destinatarios. No copia descripciones completas, URLs de Recursos, archivos ni datos institucionales innecesarios a Novu.
- `subject` conserva el título y `body` la descripción breve con contexto y autor. Se renderizan como contenido seguro. Los datos del aviso no autorizan el acceso ni se interpretan como URLs externas arbitrarias.
- El `data` cliente contiene como máximo diez escalares: `roadmapId`, `courseCode`, `year`, `semester`, `targetKind`, `nodeId` cuando corresponda, `changeKind`, `occurredAt`, `eventCount` y `actorName`. Los strings respetan 256 caracteres. Títulos y resumen van en el mensaje. El esquema y el workflow identifican su versión; no se embeben arrays serializados para eludir límites.
- `targetKind` distingue Roadmap y Nodo; `nodeId` se conserva cuando existe una entidad afectada, incluso si se retiró. El destino definitivo se resuelve contra el estado autorizado actual. `changeKind` identifica la variante y el workflow su clase.
- Digest agrupa por suscriptor —nativo de Novu—, Roadmap, Nodo y clase. Sin Nodo se agrupa por Roadmap y clase. Una clave compuesta de Roadmap/Nodo y la separación por workflow evitan mezclar Cursos, Nodos o clases. El autor no forma parte de la clave.
- Se configura Regular / **When events repeat**, con ventana personalizada de 60 segundos. El primer aviso se entrega inmediatamente; las repeticiones producen otra fila al cerrar su ventana. No se modifica ni reemplaza el primer aviso.
- El workflow proyecta al In-App la cantidad y resumen disponibles. En una entrega individual, `eventCount` es 1 y `occurredAt` es el momento efectivo de la acción. En una agregada, `eventCount` representa los eventos incluidos y `occurredAt` el último momento efectivo del grupo. El autor se etiqueta como autor del último cambio; el texto no atribuye todo el grupo a esa persona cuando hay varios autores.
- El diálogo no promete una lista de eventos internos ni un estado neto. Presenta únicamente lo entregado por Novu. Un Resumen de cambios cuenta como un aviso, independientemente de su `eventCount`.
- Se muestra fecha/hora absoluta en español y zona local. En resúmenes se etiqueta «Último cambio». `createdAt` de Novu no sustituye `occurredAt`; un dato inválido se trata como fallo de contrato, sin inventar una fecha efectiva.
- El Inbox y sus indicadores dependen de la retención del plan real de Novu: no son un registro permanente. La expiración puede retirar avisos no leídos.

### Seguridad y configuración

- El Inbox solo monta con Usuario autenticado y UUID confirmado por servidor. Se genera `subscriberHash` con HMAC-SHA256 en servidor y se habilita su validación en el proveedor In-App. La Secret Key y el SDK administrativo permanecen en servidor.
- Una persona no puede solicitar un hash para otro UUID. Al cerrar sesión o cambiar de Usuario se desmonta el proveedor, cierra su socket y descarta el estado anterior; nunca se usa un suscriptor fallback compartido.
- Development y producción usan environments y claves separados. Identificador público, servidor API y socket corresponden al mismo environment/región. Se usan las opciones vigentes `apiUrl`, `socketUrl` y `serverURL`, evitando props deprecadas.
- Las versiones investigadas en #127 son una referencia, no una promesa sobre el registro actual. El primer corte fija versiones compatibles con el stack instalado y comprueba sus contratos reales. No se selecciona región ni plan de pago por suposición.
- Toda navegación y lectura del Roadmap revalida acceso y existencia en servidor. La firma de Inbox protege al suscriptor, pero no otorga permisos sobre el Roadmap.

### Inbox, indicadores y reconocimiento

- Campana: total de avisos no leídos. Curso del Resumen académico y Roadmap: total por `roadmapId`. Nodo: total por `roadmapId` y `nodeId`. Los Nodos ocultos no se muestran al alumnado. El indicador de Nodo está separado del Estado del nodo.
- Los controles contextuales abren Inbox con su filtro; cambiarlo no cambia identidades ni estados. Mostrar realmente una fila marca visto solo su ID. Filas no cargadas o no mostradas no quedan vistas. Ni abrir Inbox ni marcar visto reduce los contadores de no leídos.
- Seleccionar una fila navega primero, y luego abre el diálogo sobre el Roadmap. Un diálogo por sí solo no reconoce nada; el acto independiente de entrar al Roadmap sí puede reconocer avisos elegibles.
- Una entrada al Roadmap reconoce sus avisos generales y los de Nodos actualmente no abribles por bloqueo, ocultamiento o eliminación. Conserva pendientes todos los avisos de Nodos accesibles que aún no se abrieron.
- Abrir un Nodo accesible reconoce todos sus avisos pendientes, de cualquier clase, incluidos Recursos y Resúmenes de cambios. Funciona también por apertura directa en el canvas. La previsualización no representa la apertura de una Participación real para este reconocimiento.
- Cada apertura captura una operación de reconocimiento con los IDs elegibles de ese momento, recorriendo todas las páginas necesarias y sin limitarse al feed visible. No se usa `readAll`/`seenAll`. La operación no se vuelve a ejecutar por refetch, rerender, actualización del contador o recepción de otro aviso. Debe excluir expresamente avisos que lleguen después de esa apertura; se prueba esta carrera con paginación y Digest.
- Un cambio o Digest que llega con su destino ya abierto continúa pendiente hasta una nueva apertura. La llegada, recarga del canvas y reconexión no marcan leído.
- Ante fallos de visto/leído, se conserva el estado pendiente y se ofrece reintento de los mismos IDs, sin incluir avisos posteriores. No se anuncia reconocimiento exitoso antes de la respuesta correspondiente. Novu propaga los estados y conteos entre pestañas del mismo suscriptor.
- Un Nodo existente y accesible o un Recurso abren el Nodo propietario. Dependencias, disponibilidad del Roadmap, renombres de Tipo y Nodos retirados/eliminados abren Roadmap. Un Nodo bloqueado conserva su representación sin abrir detalles protegidos.
- Si se perdió acceso al Curso o desapareció el Roadmap, se navega al Resumen académico y se explica la alternativa. Al llegar se reconoce únicamente el aviso seleccionado, sin diálogo del Roadmap. Los avisos anteriores no se retractan por perder acceso.

### Interacción y accesibilidad

- Escritorio: Inbox acotado junto a la campana y diálogo de detalle sobre el Roadmap. Móvil: Inbox a pantalla completa y controles con superficie de toque mínima de 44 px.
- Estados: carga, vacío, contenido paginado y error recuperable. Un error no aparece como cero avisos. Si Novu está deshabilitado o mal configurado, la navegación del producto sigue disponible.
- Campana, indicadores y filas tienen nombres accesibles con cantidades. Teclado activa controles; Escape cierra diálogos. Se contiene y devuelve el foco según el control que abrió el Inbox; después de navegar, el foco se resuelve dentro del Roadmap.
- Abrir el Nodo lleva foco al destino; ocultamiento/eliminación devuelve foco al lienzo. Reconocimiento y cambios de acceso se anuncian mediante una región de estado sin interrumpir lectura. Color no es la única señal y se respeta reducción de movimiento.

### Roadmap abierto y recuperación

- `notifications.notification_received` se valida y traduce a la señal de invalidación existente usando Identificador de curso y clase conocida. Solo la sesión activa del mismo Curso/Período consulta una nueva proyección HTTP autorizada, sin caché. El payload nunca dibuja contenido.
- El MVP extiende la estrategia de #130 a estudiantes, observadores y docentes destinatarios en sesiones actuales. En edición docente se conserva un borrador local sin guardarlo ni reemplazarlo silenciosamente; un cambio remoto incompatible se comunica y obliga a resolver antes de confirmar. La Previsualización del canvas conserva su identidad separada y no reconoce avisos del Usuario.
- Se conserva selección y detalle cuando el Nodo sigue accesible; al bloquearse se cierra el detalle y se mantiene el Nodo bloqueado. Al ocultarse o eliminarse se limpia selección, cierra detalle, devuelve foco y explica lo ocurrido.
- Un contador de versiones y la identidad de la sesión impiden que respuestas antiguas o de otro Curso sobrescriban el estado actual. Duplicados pueden provocar consultas adicionales, nunca reconocimiento ni contenido incorrecto.
- Al volver a primer plano, reconectar o solicitar reintento se consulta de nuevo el Roadmap activo y se reconcilian feed/conteos. Esto no constituye una nueva entrada o apertura para reconocimiento. No se añade polling permanente.
- Un fallo transitorio conserva la última proyección con estado de error y reintento. Una respuesta autoritativa de pérdida de acceso retira contenido y lleva al Resumen académico. Si Novu no entrega la señal, este mecanismo no garantiza actualización inmediata; una nueva lectura recupera el estado.

### Operación y habilitación

- Registrar por envío identidad de evento, workflow, Roadmap, cantidad de destinatarios, intento, duración y resultado. Distinguir aceptación del trigger de entrega efectiva. No registrar claves, hashes, payload completo, RUT, URLs de Recursos ni contenido pedagógico.
- Un interruptor de configuración permite deshabilitar la integración y sus superficies sin detener mutaciones. Se mantiene deshabilitada en producción hasta validar HMAC, aislamiento de suscriptores, fan-out, Digest, reconocimiento, regiones y socket reales.
- La promoción reproduce los cinco workflows y sus contratos en el environment destino. Se comprueban cuotas, retención, límites y versiones vigentes del plan contratado; el manifiesto operativo identifica esos valores reales.
- El ensayo real usa cuentas de prueba y dos sesiones concurrentes. El responsable de habilitación revisa errores de envío y actividad de Novu, y puede deshabilitar la integración conservando Roadmaps y avisos ya persistidos en Novu.

## Testing Decisions

- La Seam principal de aceptación, aprobada por el usuario durante esta síntesis, es el comportamiento observable mediante APIs autenticadas y navegador sobre PostgreSQL local. Se sustituye solo el transporte de notificaciones con un Adapter determinista; no se simulan las reglas de acceso o el commit de PostgreSQL.
- Reutilizar el patrón existente de E2E con dos contextos autenticados, fixtures de Curso/Participación y sesión del canvas. Una única suite E2E corre a la vez sobre el servicio local existente. Las pruebas de proyección/acceso y de sesión son antecedentes para casos focalizados.
- Cada corte añade pruebas de su comportamiento completo: acción docente, persistencia confirmada, audiencia exacta, mensaje, navegación, indicadores y reconocimiento. No se prueban detalles privados ni cada llamada interna al SDK.
- Matriz de acceso: estudiante con prerrequisitos pendientes/completos, observador con capacidades estudiantiles, docente sin consulta de Completaciones, autora excluida, otra Sección, Participación inactiva y otra de otro Curso. Verificar privacidad y exclusiones, así como títulos conservados tras eliminación.
- Fallos de entrega: timeout, 429, credenciales/payload inválidos y caída después del commit mantienen datos y respuesta correcta. Reintentos conservan clave por envío y no mezclan efectos/lotes. El Adapter determinista prueba el contrato requerido, no demuestra que Novu entregue.
- Reconocimiento: visto por fila visible; read por contexto; paginación completa; Nodo inaccesible; Digest indivisible; múltiples Cursos; llegada durante reconocimiento y después de apertura; fallo de read y reintento; pérdida de acceso con alternativa. Se demuestra que otros Nodos y avisos posteriores permanecen pendientes.
- Realtime: dos sesiones, edición y efectos de acceso directos/transitivos, respuestas fuera de orden, cambio de Curso, retorno a pestaña, reconexión, pérdida de acceso y borradores docentes. Una recarga automática nunca reconoce avisos.
- Contrato real en environment de pruebas: HMAC válido/inválido, aislamiento, versiones fijadas, mensajes y `data` efectivos, agrupación de 60 segundos, eventos de distintos autores/Nodos/Cursos/clases, conteos/read y callback WebSocket. Este ensayo se ejecuta de manera explícita con credenciales; CI cotidiana es independiente de Novu Cloud.
- Pruebas de accesibilidad e interacción cubren escritorio/móvil, teclado, foco, nombres accesibles y fecha efectiva en zona local. Se evalúa con personas la comprensión de primera fila más resumen posterior; no se presenta esa evaluación como completada.
- La evidencia previa se conserva como antecedente: #129 validó un prototipo ficticio; #130 informó un E2E y 14 pruebas de sesión aprobadas con señal inyectada. Esta síntesis no ejecuta ni certifica nuevas pruebas del producto.

## Out of Scope

- Cambiar o comparar el proveedor Novu.
- Persistencia local de avisos, outbox, auditoría exhaustiva, entrega garantizada o recuperación durable de envíos perdidos.
- Consolidación semántica, estado neto, reemplazo de avisos ya entregados o lectura de cambios internos de un Digest.
- Preferencias configurables por Usuario, acciones globales de reconocimiento y canales distintos del Inbox del MVP.
- Avisos por Completaciones, navegación, autenticación, sincronización institucional, cambios de actividad/rol o mantenimiento técnico.
- Ediciones idénticas, validaciones fallidas, previsualizaciones canceladas, movimiento/zoom/selección del canvas, cambios solo de icono/color y contenido que permanezca inaccesible.
- Implementar congelamiento, linaje/copia, sincronización completa del roster o modelado completo de cargos institucionales como parte de este MVP.
- Implementar avisos de congelamiento o correo en esta entrega.

## Further Notes

### Trabajo futuro: aviso previo al congelamiento

La fuente ya verificada es `AcademicTerm.roadmapFreezeDate`, derivada del último día de exámenes según ADR-0001. La señal propuesta es `noticeAt = roadmapFreezeDate - anticipación`. El aviso futuro alcanza todas las Participaciones activas de Cursos con Roadmap, incluida la persona docente que habría quedado excluida como autora de una edición, y usa Inbox y correo. Su navegación lleva al Roadmap autorizado o al Resumen académico si ya no hay acceso.

Este workflow no puede anunciar como existente un cierre que todavía falta: según #133, no hay ejecutor de cierre, eliminación atómica de Bloqueos docentes, estado persistido de congelamiento ni protección temporal completa de mutaciones editoriales. La UI histórica no acredita esas garantías.

Antes de implementar el aviso deben quedar acordados anticipación y repetición, hora/zona del corte, programación periódica o posterior a sincronización, idempotencia, cambios/cancelación de fecha y Roadmaps creados después de programar. Las resoluciones cerradas no fijaron esos valores; no se inventan en esta síntesis. Se conserva un corte futuro explícitamente bloqueado por esas decisiones y por el ciclo de congelamiento, sin bloquear el MVP.

### Trazabilidad

- Mapa original: [#126](https://github.com/Bigelazo/u-roadmaps/issues/126).
- Contrato Novu: [#127](https://github.com/Bigelazo/u-roadmaps/issues/127).
- Catálogo y audiencia: [#128](https://github.com/Bigelazo/u-roadmaps/issues/128).
- Interfaz: [#129](https://github.com/Bigelazo/u-roadmaps/issues/129).
- Realtime y límites del experimento: [#130](https://github.com/Bigelazo/u-roadmaps/issues/130).
- Reconocimiento definitivo: [#132](https://github.com/Bigelazo/u-roadmaps/issues/132).
- Fuente y brechas del congelamiento: [#133](https://github.com/Bigelazo/u-roadmaps/issues/133).

El repositorio conserva una recopilación íntegra de los cuerpos/comentarios y los documentos de investigación, prototipos y ADR originales. Los subissues pendientes #131, #134, #135 y #136 se eliminaron por instrucción del usuario; su texto original está respaldado. Esta especificación completa arquitectura/validación, y `to-tickets` prepara los cortes de ejecución. El mapa #126 y los seis hijos cerrados conservan sus cuerpos y estados.

La revisión documental actual confirma los límites de diez escalares y 256 caracteres en [Data Object](https://docs.novu.co/platform/inbox/configuration/data-object), la firma en servidor en [Prepare for Production](https://docs.novu.co/platform/inbox/prepare-for-production), el inicio por repetición en [Digest Step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest) y la separación de eventos internos en [Digest Reference](https://docs.novu.co/framework/typescript/steps/digest). Los hooks exponen filtros, paginación y acciones por aviso en [useNotifications](https://docs.novu.co/platform/sdks/react/hooks/use-notifications). Estas fuentes describen capacidades; la integración real sigue pendiente.
