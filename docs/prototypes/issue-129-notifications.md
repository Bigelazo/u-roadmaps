# Prototipo #129: Cambios del Roadmap

[Abrir el prototipo interactivo](./issue-129-notifications.html). Es un artefacto de diseño con datos ficticios; los controles superiores cambian entre cinco escenarios. No conecta con Novu ni modifica el producto.

## Decisión de interfaz

Una persona reconoce un **Cambio del Roadmap** por el mismo acento azul en cuatro lugares: campana, fila del Curso en el **Resumen académico**, aviso del **Roadmap** e indicador del **Nodo**. Cada lugar muestra la cantidad de avisos sin revisar que le corresponde. El indicador del Nodo va en la esquina superior izquierda, separado del **Estado del nodo** de la esquina inferior derecha. Los Nodos ocultos no reciben indicador para estudiantes y observadores porque no aparecen en su Roadmap.

La campana abre el Inbox de todos los Roadmaps; el indicador del Curso o Roadmap abre el Inbox filtrado a ese Roadmap; el indicador de un Nodo abre el Inbox filtrado a ese Nodo. El filtro solo afecta la presentación. Un aviso conserva su identidad y estado al cambiar de superficie. Abrir el Inbox, abrir un aviso o cerrar el diálogo **no** lo marca como revisado. «Marcar como revisado» y la navegación explícita desde el aviso reconocen únicamente ese aviso. El contador y los indicadores se recalculan de los avisos restantes. Un Resumen de cambios de Novu es una unidad de reconocimiento; el prototipo no inventa controles por evento interno que Novu no entregue.

El Inbox muestra primero el contexto legible («Límites fue actualizado»), luego una frase de impacto y la fecha y hora. El diálogo conserva título, descripción breve, Curso, persona autora y momento del cambio. El botón de destino usa «Ver nodo», «Ver roadmap» o «Ir al Resumen académico». Un Nodo existente abre el Roadmap con el Nodo seleccionado; el Recurso abre su Nodo propietario; el Nodo oculto o eliminado, una Dependencia, la disponibilidad del Roadmap y un cambio de Tipo abren el Roadmap. Si la Participación ya no da acceso al Roadmap, se vuelve al Resumen académico con una explicación breve. El título conservado de un Nodo retirado sigue visible en Inbox y diálogo.

## Estados del prototipo

| Escenario         | Qué muestra                                                                           | Decisión que permite evaluar                                   |
| ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Pocos cambios     | Dos avisos separados: Nodo actualizado y Dependencia nueva                            | Lectura rápida, reconocimiento granular y destino Nodo/Roadmap |
| Cambios agrupados | Primer aviso inmediato de Recurso y segundo Resumen de cambios del mismo Nodo y clase | Se aceptan dos filas; el segundo aviso no reemplaza el primero |
| Sin cambios       | Campana sin contador e Inbox vacío con explicación                                    | Estado vacío y ausencia de indicadores contextuales            |
| Nodo eliminado    | Título conservado y destino Roadmap                                                   | El enlace no termina en un Nodo inexistente                    |
| Sin acceso        | Aviso conservado y destino Resumen académico                                          | Pérdida posterior de acceso sin error técnico                  |

El escenario agrupado representa **Regular / When events repeat** de Novu con una ventana de 60 segundos y la clave acordada en [#128](https://github.com/Bigelazo/u-roadmaps/issues/128): suscriptor, Roadmap, Nodo y clase. El primer evento aparece inmediatamente; el segundo aviso agrupa las repeticiones posteriores. El diálogo solo enumera cambios individuales si el payload de Novu los trae de forma segura. Si llega únicamente una cantidad y un resumen, muestra eso y dice que no hay detalle individual en el aviso. No calcula un estado neto ni presenta el Inbox como historial exhaustivo.

## Comportamiento adaptable y accesible

- **Escritorio:** campana en la navegación global; Inbox como diálogo acotado junto a la campana; Roadmap y Nodos permanecen reconocibles detrás. El diálogo de detalle aparece centrado.
- **Móvil:** la campana conserva el mismo contador; Inbox ocupa la pantalla y la secuencia de Nodos se apila verticalmente. Los botones mantienen al menos 44 px de altura o superficie de toque.
- **Teclado:** Tab llega a campana, filtros del prototipo, indicadores, filas y acciones; Enter/Espacio activan los botones. Los diálogos nativos contienen el foco; Escape los cierra. Al cerrar el detalle abierto desde Inbox se vuelve al Inbox; al cerrar el Inbox se devuelve el foco al control que lo abrió. Tras navegar, el foco va al título del destino o al Nodo seleccionado.
- **Lector de pantalla:** la campana anuncia la cantidad; cada Nodo anuncia título, cantidad pendiente y Estado del nodo por separado. El punto de color se oculta de la lectura; la cifra se expone en el nombre del control. El diálogo tiene título y descripción asociados. Las confirmaciones de reconocimiento se anuncian en una región `role="status"` sin interrumpir la lectura.
- **Movimiento y color:** el color azul acompaña textos y números; nunca es la única señal. Las transiciones se omiten cuando `prefers-reduced-motion` lo solicita.

La fecha visible es **absoluta** y usa la zona horaria local de la persona. Para un aviso individual representa el momento efectivo del Cambio del Roadmap. Para un Resumen de cambios se etiqueta «Último cambio» y representa el último momento efectivo incluido. No se usa `createdAt` de Novu como sustituto del momento del cambio: Novu puede crear el aviso agrupado más tarde. El formato del prototipo usa `Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })`.

## Contrato para la implementación posterior

El prototipo deja una correspondencia, no una implementación de integración:

| Dato o acción de interfaz                                                   | Fuente o consecuencia esperada                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Contador y lista                                                            | Avisos Inbox del suscriptor en Novu, con actualización en tiempo real                                              |
| Identidad del aviso                                                         | `notificationId` de Novu; permite reconocer una fila sin afectar las demás                                         |
| Clase, `roadmapId`, `nodeId`, título conservado, destino y momento efectivo | Campos mínimos del payload del workflow acordado en #128; sin descripciones completas, URL de Recurso ni archivos  |
| «Marcar como revisado» o navegar desde el aviso                             | Actualizar el estado del aviso correspondiente en Novu; mantener sin revisar los demás                             |
| Indicadores del Curso, Roadmap y Nodo                                       | Proyección de avisos pendientes del suscriptor, agrupados por Roadmap y Nodo; una digest cuenta como un aviso      |
| Destino                                                                     | Resolver acceso y existencia contra el estado actual del servidor antes de abrir Nodo, Roadmap o Resumen académico |

La implementación debe usar la terminología de #128: **Cambio del Roadmap** para el hecho de dominio y **Resumen de cambios** para un aviso agregado. El documento de investigación [novu-notification-consolidation.md](../research/novu-notification-consolidation.md) explora alternativas previas con persistencia local y reducción de estado neto; en este prototipo prevalece la decisión posterior de [#126](https://github.com/Bigelazo/u-roadmaps/issues/126) y #128 de usar solo Novu como persistencia de avisos del MVP.

## Validación pendiente con personas y Novu

1. Comprobar si dos filas próximas para el mismo Nodo (primera inmediata y resumen posterior) se entienden sin parecer un duplicado accidental.
2. Confirmar qué campos expone efectivamente Novu al renderizador del Inbox para una digest y ajustar el diálogo a esos datos; no prometer una cronología que no exista.
3. Probar con teclado y lector de pantalla reales la secuencia campana → Inbox → detalle → destino, el retorno de foco y las actualizaciones del contador.
4. Probar con dos sesiones que un aviso nuevo actualiza Inbox e indicadores, y que el Roadmap abierto recupera el contenido vigente del servidor. El realtime del Inbox no actualiza por sí solo el contenido del Roadmap.
