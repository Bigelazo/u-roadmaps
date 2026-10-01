# Prototipo #129: Cambios del Roadmap

[Abrir el prototipo interactivo](./issue-129-notifications.html). Es un artefacto de diseño con datos ficticios; los controles superiores cambian entre cinco escenarios. No conecta con Novu ni modifica el producto. La semántica de reconocimiento fue actualizada por [#132](https://github.com/Bigelazo/u-roadmaps/issues/132) y [ADR-0011](../adr/0011-acknowledge-roadmap-change-notices-in-context.md).

## Decisión de interfaz

Una persona reconoce un **Cambio del Roadmap** por el mismo acento azul en cuatro lugares: campana, fila del Curso en el **Resumen académico**, aviso del **Roadmap** e indicador del **Nodo**. Cada lugar muestra la cantidad de avisos sin revisar que le corresponde. El indicador del Nodo va en la esquina superior izquierda, separado del **Estado del nodo** de la esquina inferior derecha. Los Nodos ocultos no reciben indicador para estudiantes y observadores porque no aparecen en su Roadmap.

La campana abre el Inbox de todos los Roadmaps; el indicador del Curso o Roadmap abre el Inbox filtrado a ese Roadmap; el indicador de un Nodo abre el Inbox filtrado a ese Nodo. El filtro solo afecta la presentación. Un aviso conserva su identidad y estado al cambiar de superficie. Cada fila mostrada queda **vista** en Novu, pero abrir el Inbox o el diálogo no la marca como **leída**. Seleccionar un aviso lleva primero al Roadmap y abre allí el diálogo; no hay control «Marcar como revisado». Entrar al Roadmap reconoce solo los cambios generales y los avisos de Nodos cuyo detalle no se puede abrir; abrir un Nodo accesible reconoce todos sus avisos pendientes. El contador y los indicadores se recalculan de los avisos no leídos. Un Resumen de cambios de Novu es un aviso indivisible para reconocimiento.

El Inbox muestra primero el contexto legible («Límites fue actualizado»), luego una frase de impacto y la fecha y hora. Al seleccionar una fila se navega al Roadmap y se abre el diálogo allí, con título, descripción breve, Curso, persona autora y momento del cambio. Para un Nodo o Recurso accesible, «Abrir nodo» abre el Nodo propietario y reconoce todos sus avisos pendientes; la persona también puede abrirlo directamente en el canvas con el mismo efecto. Para una Dependencia, disponibilidad del Roadmap, cambio de Tipo o un Nodo cuyo detalle esa Participación no puede abrir por bloqueo, ocultamiento o eliminación, entrar al Roadmap reconoce el aviso; el diálogo conserva el título anterior del Nodo retirado. Si la Participación perdió acceso después de recibir el aviso, se navega al Resumen académico, se reconoce ese aviso y se explica el destino alternativo. La pérdida de acceso impide entregas futuras, pero no retracta avisos entregados antes.

## Estados del prototipo

| Escenario         | Qué muestra                                                                           | Decisión que permite evaluar                                   |
| ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Pocos cambios     | Dos avisos separados: Nodo actualizado y Dependencia nueva                            | Entrar al Roadmap reconoce la Dependencia; abrir el Nodo reconoce su cambio |
| Cambios agrupados | Primer aviso inmediato de Recurso y segundo Resumen de cambios del mismo Nodo y clase | Abrir el Nodo reconoce ambas filas; el segundo aviso no reemplaza el primero |
| Sin cambios       | Campana sin contador e Inbox vacío con explicación                                    | Estado vacío y ausencia de indicadores contextuales            |
| Nodo eliminado    | Título conservado y destino Roadmap                                                   | Entrar al Roadmap reconoce el aviso sin abrir un Nodo inexistente |
| Sin acceso        | Aviso conservado y destino Resumen académico                                          | Interactuar con el aviso lo reconoce sin mostrar un error técnico |

El escenario agrupado representa **Regular / When events repeat** de Novu con una ventana de 60 segundos y la clave acordada en [#128](https://github.com/Bigelazo/u-roadmaps/issues/128): suscriptor, Roadmap, Nodo y clase. El primer evento aparece inmediatamente; el segundo aviso agrupa las repeticiones posteriores. El diálogo solo enumera cambios individuales si el payload de Novu los trae de forma segura. Si llega únicamente una cantidad y un resumen, muestra eso y dice que no hay detalle individual en el aviso. No calcula un estado neto ni presenta el Inbox como historial exhaustivo. Si un Resumen de cambios llega cuando su Nodo ya está abierto, permanece pendiente hasta que el Nodo se vuelva a abrir; lo mismo rige para cambios generales que llegan con el Roadmap abierto.

## Comportamiento adaptable y accesible

- **Escritorio:** campana en la navegación global; Inbox como diálogo acotado junto a la campana; Roadmap y Nodos permanecen reconocibles detrás. El diálogo de detalle aparece centrado.
- **Móvil:** la campana conserva el mismo contador; Inbox ocupa la pantalla y la secuencia de Nodos se apila verticalmente. Los botones mantienen al menos 44 px de altura o superficie de toque.
- **Teclado:** Tab llega a campana, filtros del prototipo, indicadores, filas y acciones; Enter/Espacio activan los botones. Los diálogos nativos contienen el foco; Escape los cierra. Al cerrar el Inbox sin navegar se devuelve el foco al control que lo abrió. Tras seleccionar un aviso, el diálogo aparece sobre el Roadmap y al cerrarlo el foco vuelve al título del Roadmap; al abrir el Nodo va al Nodo seleccionado.
- **Lector de pantalla:** la campana anuncia la cantidad; cada Nodo anuncia título, cantidad pendiente y Estado del nodo por separado. El punto de color se oculta de la lectura; la cifra se expone en el nombre del control. El diálogo tiene título y descripción asociados. Las confirmaciones de reconocimiento contextual se anuncian en una región `role="status"` sin interrumpir la lectura.
- **Movimiento y color:** el color azul acompaña textos y números; nunca es la única señal. Las transiciones se omiten cuando `prefers-reduced-motion` lo solicita.

La fecha visible es **absoluta** y usa la zona horaria local de la persona. Para un aviso individual representa el momento efectivo del Cambio del Roadmap. Para un Resumen de cambios se etiqueta «Último cambio» y representa el último momento efectivo incluido. No se usa `createdAt` de Novu como sustituto del momento del cambio: Novu puede crear el aviso agrupado más tarde. El formato del prototipo usa `Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })`.

## Contrato para la implementación posterior

El prototipo deja una correspondencia, no una implementación de integración:

| Dato o acción de interfaz                                                   | Fuente o consecuencia esperada                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Contador y lista                                                            | Avisos Inbox del suscriptor en Novu, con actualización en tiempo real                                              |
| Identidad del aviso                                                         | `notificationId` de Novu; permite reconocer una fila sin afectar las demás                                         |
| Clase, `roadmapId`, `nodeId`, título conservado, destino y momento efectivo | Campos mínimos del payload del workflow acordado en #128; sin descripciones completas, URL de Recurso ni archivos  |
| Mostrar la fila de un aviso                                                 | Marcar como visto solo ese aviso en Novu; no cambiar su estado de leído ni los indicadores                          |
| Entrar al Roadmap                                                            | Marcar como leídos sus avisos generales y los de Nodos que no pueden abrirse; conservar los de Nodos accesibles    |
| Abrir un Nodo                                                                | Marcar como leídos todos los avisos pendientes de ese Nodo, incluido cada Resumen de cambios como una unidad       |
| Indicadores del Curso, Roadmap y Nodo                                       | Proyección de avisos no leídos del suscriptor, agrupados por Roadmap y Nodo; una digest cuenta como un aviso       |
| Destino                                                                     | Resolver acceso y existencia contra el estado actual del servidor; si se perdió acceso, reconocer el aviso al llegar al Resumen académico |

Novu permite marcar como vistos [IDs concretos de avisos](https://docs.novu.co/api-reference/subscribers/mark-notifications-as-seen) y [marcar como leído un aviso por ID](https://docs.novu.co/api-reference/subscribers/mark-a-notification-as-read). La integración debe operar sobre los IDs visibles o correspondientes al contexto abierto y evitar acciones globales como `seenAll` o `readAll`: estas borrarían estados de avisos que la persona todavía no vio o de Nodos que no abrió. La lista y los indicadores usan `isRead`/`readAt`, no `isSeen`/`firstSeenAt`; el prototipo conserva ambos estados solo en memoria ficticia.

La implementación debe usar la terminología de #128: **Cambio del Roadmap** para el hecho de dominio y **Resumen de cambios** para un aviso agregado. El documento de investigación [novu-notification-consolidation.md](../research/novu-notification-consolidation.md) explora alternativas previas con persistencia local y reducción de estado neto; en este prototipo prevalece la decisión posterior de [#126](https://github.com/Bigelazo/u-roadmaps/issues/126) y #128 de usar solo Novu como persistencia de avisos del MVP.

## Validación pendiente con personas y Novu

1. Comprobar si dos filas próximas para el mismo Nodo (primera inmediata y resumen posterior) se entienden sin parecer un duplicado accidental.
2. Confirmar qué campos expone efectivamente Novu al renderizador del Inbox para una digest y ajustar el diálogo a esos datos; no prometer una cronología que no exista.
3. Probar con teclado y lector de pantalla reales la secuencia campana → Inbox → detalle → destino, el retorno de foco y las actualizaciones del contador.
4. Probar con dos sesiones que un aviso nuevo actualiza Inbox e indicadores, y que el Roadmap abierto recupera el contenido vigente del servidor. El realtime del Inbox no actualiza por sí solo el contenido del Roadmap.
