# Reducción de líneas en notificaciones

Fecha: 2026-11-16. Investigación del árbol de trabajo actual, sin aplicar cambios a código ni pruebas.

Hay una primera reducción concreta de **50 líneas de producción**, medida en dos prototipos formateados fuera del repositorio. La preparación compartida de pruebas ofrece aproximadamente **35–60 líneas adicionales**. No encontré fundamento para una reducción grande mediante eliminación de funcionalidad obsoleta: las partes más extensas conservan reglas de dominio, concurrencia y rendimiento.

Las cifras de los prototipos miden tamaño; no prueban equivalencia funcional. Antes de aplicarlos hacen falta tipos, lint y las pruebas indicadas abajo.

## Alcance y medidas

Se consultó Graphify y se contrastaron sus ubicaciones con el código actual. Se revisaron los archivos de la feature, sus exportaciones y consumidores, los seis archivos de rutas HTTP, los modelos de persistencia pertinentes, el glosario, el ADR de carga de Avisos y las pruebas de los comportamientos que condicionan las propuestas. También se buscaron bloques repetidos en producción y pruebas.

Las medidas cuentan líneas físicas, incluidos blancos e imports:

| Área | Archivos | Líneas |
| --- | ---: | ---: |
| Aplicación de notificaciones | 19 | 1.240 |
| Infraestructura de notificaciones | 16 | 2.431 |
| Componentes de notificaciones | 8 | 847 |
| Contratos de notificaciones | 3 | 43 |
| Entradas `server.ts`, `client.ts`, `index.ts` | 3 | 85 |
| **Producción dentro de la feature** | **49** | **4.646** |
| `tests/features/notifications` | 13 | 1.073 |
| `tests/notifications-integration` | 38 | 4.797 |

El total de pruebas incluye fixtures, helpers y benchmarks. No incluye E2E ni pruebas relacionadas en otras carpetas. Tampoco se incluyen en producción las rutas, adaptadores y consumidores externos a la feature.

## Comportamiento que debe conservarse

El flujo principal es:

1. El adaptador de cambios recibe hechos del Roadmap y llama a `recordNoticeTargets` dentro de la transacción de edición.
2. Los diez descriptores determinan Objeto del aviso, Valor conocido y destinatarios. Algunos hechos traen sus destinatarios; otros los calculan desde el Roadmap.
3. Se registran los Valores conocidos y los cambios propios del actor. La entrega se devuelve para ejecutarse después de confirmar la edición, con un planificador distinto para peticiones HTTP y trabajos programados.
4. La entrega verifica Participación e idempotencia, bloquea por destinatario y Roadmap y reconcilia el estado actual con lo que ese destinatario conoce.
5. Al entrar al Roadmap se captura una apertura y luego se reconoce. La secuencia de aperturas protege contra reconocimientos antiguos y la captura impide reconocer cambios posteriores por accidente.
6. La bandeja usa una instantánea de carga; el cliente descuenta los Roadmaps reconocidos. Las marcas de cambios del Nodo mantienen su propio ciclo de revisión.

El [ADR de carga de Avisos](adr/0037-los-avisos-aparecen-al-cargar-la-pagina.md) conserva SSE para cambios del Roadmap y pérdida de acceso. El nombre `OwnInboxRealtime` no significa que su implementación siga actualizando la bandeja en vivo.

## 1. Construir una sola vez el resultado de registro

Ubicaciones: [record.ts](../src/features/notifications/infrastructure/notice-lifecycle/record.ts), `recordNoticeTargets` en la línea 45 y `recordFactRecipientTargets` en la 174.

Los hechos sin destinatarios explícitos construyen `own` y `target` dentro del bucle principal. Los que tienen `factRecipients` se apartan y construyen esencialmente esos mismos objetos al final. Esa separación también requiere guardar `order` y ordenar ambos grupos después.

La propuesta mantiene los dos mecanismos de persistencia, pero construye `own` y `target` una sola vez, dentro del bucle de hechos:

- La audiencia sale de `factRecipients` cuando existe; en los demás casos se sigue calculando con el descriptor.
- Los Valores conocidos de los hechos con destinatarios explícitos siguen escribiéndose juntos al terminar el bucle.
- `recordFactRecipientTargets` queda dedicado a esa escritura por lotes.
- Como todos los resultados se agregan durante el recorrido original, desaparecen `order` y el ordenamiento posterior.

**Ahorro medido: 26 líneas**, de 297 a 271, después de aplicar Prettier. El prototipo está en `/tmp/notifications-line-audit/record.ts`.

Alcance de implementación: este archivo; se mantienen sus firmas públicas, adaptadores y consumidores. No requiere cambios de esquema, fixtures ni exportaciones.

Hay que conservar la exclusión del actor, los `ownTargets`, la retirada de creaciones desconocidas, `requireKnowers`, el orden de hechos y la escritura por lotes. En los descriptores actuales solo `node-access` implementa `factRecipients`; su `factContext` no tiene efectos que deban ejecutarse después de escribir los Valores conocidos. Una futura ampliación de ese contrato deberá respetar esta condición.

Validación necesaria: `actor-rule`, `access-lifecycle`, `absorption-lifecycle`, `concurrent-delivery`, `completion-promotion` y el contrato del adaptador `tests/app/api/roadmap-change-port.test.ts`. Revisar también una edición que mezcle hechos de acceso y contenido para verificar el orden conservado.

## 2. Usar la escritura por lotes también para un Valor conocido

Ubicaciones: [known-values.ts](../src/features/notifications/infrastructure/notice-lifecycle/known-values.ts), `setKnownValue` en la línea 152 y `setKnownValues` en la 179; [recognize.ts](../src/features/notifications/infrastructure/notice-lifecycle/recognize.ts), llamada en la línea 262.

`setKnownValue` hace un `upsert` de Prisma. `setKnownValues` ya expresa en SQL la misma escritura para una colección: inserta la identidad del Objeto del aviso y, en conflicto, actualiza únicamente `knownValue` y `context`.

La búsqueda de llamadas encontró un solo consumidor de la variante individual. Puede pasar una colección de un elemento a `setKnownValues` y eliminar la función individual. Debe pasar `context: input.context ?? {}` para conservar el valor predeterminado.

**Ahorro medido: 24 líneas netas** entre ambos archivos, incluido el ajuste de imports y el formato. Los prototipos están en `/tmp/notifications-line-audit/known-values.ts` y `/tmp/notifications-line-audit/recognize.ts`.

Alcance de implementación: estos dos archivos. No cambia firmas públicas de la feature, fixtures, configuración ni esquema.

Se compararon las columnas y la clave compuesta: ambas variantes conservan `currentValue` y los campos de identidad cuando actualizan una fila existente. La equivalencia de resultados parece directa, pero sustituye una operación del ORM por SQL; hay que verificar inserción y actualización con PostgreSQL real, incluido el contexto vacío y la preservación de `currentValue`.

Validación necesaria: reconocimiento de título, descripción, tipo, recurso y acceso; `type-lifecycle` para los nombres de tipos capturados; `absorption-lifecycle` para capturas amplias. Los escenarios E2E de orden de reconocimiento y operaciones de apertura completan la validación de extremo a extremo.

No extendería esta unificación a `advanceKnownValue`, que hace una actualización condicional, ni a las escrituras de `currentValue` capturado al editar. Sus condiciones de conflicto son diferentes.

## 3. Compartir la preparación repetida de las pruebas de SSE

Ubicaciones:

- [roadmap-load-benchmark.test.ts](../tests/notifications-integration/roadmap-load-benchmark.test.ts): `outsiders`, línea 47; `openStreams`, línea 65; `countingQueries`, línea 21.
- [notification-stream.test.ts](../tests/notifications-integration/notification-stream.test.ts): `visitors`, línea 45; `openStreams`, línea 61; `countingLookups`, línea 28.
- [dependency-edit-benchmark.test.ts](../tests/notifications-integration/dependency-edit-benchmark.test.ts): `countingQueries`, línea 91; `median`, línea 117.

`outsiders` y `visitors` tienen cuerpos idénticos de 15 líneas. Las dos funciones `median` también son idénticas. Los lectores `openStreams` repiten apertura, cancelación, decodificación y espera de `ready`; sus proyecciones finales son distintas. Los tres contadores repiten la instrumentación de `pg.Client.prototype.query`, con diferencias en filtro y restauración.

**Ahorro estimado: 35–60 líneas netas**, incluyendo el helper compartido y los imports nuevos. No se ha construido un prototipo de este grupo.

La solución debe seguir siendo pequeña: compartir creación de visitantes y el lector de SSE; añadir un contador común solo si el resultado completo sigue siendo más corto y claro. El benchmark puede contar eventos desde el texto recibido sin obligarlo a decodificar todos los mensajes JSON dentro del período medido.

Alcance: los tres archivos y un helper del harness. Mantener la limpieza por test y la restauración del método de PostgreSQL. La creación de estudiantes en `roadmap.ts` no es equivalente: además de crear Usuarios, crea Participaciones.

Validación necesaria: las pruebas de `notification-stream` y las dos variantes de benchmark cuando sus variables de activación están presentes. Una ejecución ordinaria de integración no ejecuta esos benchmarks. Mantener límites y mediciones comparables antes y después.

El simulador de `tests/support/notification-stream.ts` sirve para pruebas de navegador; no reemplaza un lector de SSE conectado al servidor real.

## 4. Eliminaciones pequeñas, de prioridad secundaria

`getInboxIdentity` en [server.ts](../src/features/notifications/server.ts), línea 55, solo devuelve `{ userId }`. Tiene un consumidor productivo, `src/app/layout.tsx`, y un test que reproduce esa construcción. Se puede construir el objeto en el layout y retirar la función y ese test mecánico. Mantendría el tipo `InboxIdentity` y la cobertura de SSR y cambio de Usuario. El ahorro es de pocas líneas; no justifica ampliar el alcance a la identidad de todo el sistema.

`CourseOfferingIdentity` en `infrastructure/own-inbox.ts`, línea 169, repite los campos de `CourseOfferingIdentifier`, ya disponible en `src/shared/course-offering.ts`. `OfferingFilter` repite esa forma en el cliente. Reutilizar el tipo existente elimina unas pocas líneas y evita definiciones divergentes, conservando `Readonly` donde corresponde.

No sumo estas propuestas al ahorro principal: su beneficio en líneas es pequeño y el layout ya tiene cambios previos en este árbol de trabajo.

## Recortes que descartaría

| Candidato | Motivo para conservarlo |
| --- | --- |
| Caché de `roadmap-view.ts` | Sus 300 líneas incluyen consultas por elemento y precarga con índices. Reemplazarlo por una carga total cambia el costo de las entregas; reemplazar índices por búsquedas repetidas empeora las aperturas. La abstracción de caché tendría un ahorro incierto después de contar sus tipos y configuración. |
| Un descriptor genérico para todos los campos del Nodo | Título y tipo llegan a quienes ven el Nodo bloqueado; descripción y recursos requieren acceso para mostrarse. El tipo guarda nombres históricos, el acceso conserva el valor al editar y creación/eliminación absorben otros Objetos del aviso. |
| Una sola implementación de visibilidad en JavaScript | SQL filtra y agrupa antes de paginar y contar. Filtrar después puede cambiar páginas, conteos y volumen transferido. Las dos implementaciones comparten la clasificación `shownTo`, pero sirven a operaciones distintas. |
| Combinar las dos consultas de `readOwnInbox` a partir de las filas visibles | Una fila agrupada representa varios Objetos del aviso. Contar filas no reproduce el total pendiente. Cualquier combinación requeriría conservar explícitamente esa cardinalidad. |
| Eliminar la API paginada porque la UI usa una instantánea | Sigue siendo una interfaz HTTP existente, con filtros, cursor y pruebas. La extensión de U-Cursos también necesita el endpoint de conteo por Curso, conservado por el ADR. |
| Tratar reconocimiento y revisión del Nodo como una sola operación | Las marcas del Nodo incluyen cambios cuyos Avisos ya fueron reconocidos. Entrar al Roadmap no las limpia. |
| Simplificar `useInboxSnapshot` a leer siempre la última promesa | La implementación mantiene la instantánea de sesión, admite recuperar una carga fallida y evita que una promesa del Usuario anterior contamine al siguiente. La resolución también debe conservar el estado local de la página. |
| Sustituir el lector de promesas por suspensión de toda la página | Cambia la interactividad durante la carga y puede reiniciar estado local; existe una prueba explícita de preservación del borrador. |
| Quitar rotación y recuperación de SSE | El sucesor se abre antes de cerrar la conexión anterior. Reconexión, pérdida de acceso y recuperación del Roadmap siguen siendo funcionalidad vigente. |
| Eliminar el planificador de entrega | Las peticiones usan `after`; los trabajos programados esperan la ejecución directamente. Hay dos consumidores productivos con necesidades distintas. |
| Borrar locks, recibos o secuencias de apertura | Protegen idempotencia, pérdida de Participación, entregas concurrentes y aperturas reconocidas fuera de orden. |
| Parametrizar todos los tests de ciclo de vida | Muchos escenarios parecidos contienen expectativas distintas. Una tabla de callbacks y configuraciones puede ahorrar menos de lo que añade y ocultar esas diferencias. |
| Comprimir JSX, fusionar archivos o quitar validaciones | Cambia presentación del código o garantías; no elimina una responsabilidad duplicada. |

## Orden propuesto y estado de validación

Aplicaría primero la construcción común de resultados de registro y después la reutilización de `setKnownValues`, en cambios separados. El ahorro conjunto medido es **50 líneas de producción**, aproximadamente el **1,1 %** de esta feature. Luego compartiría la preparación de pruebas, si conserva una reducción neta después del formato y no altera las mediciones.

Para implementar: preparar un worktree, respetar los cambios previos y ejecutar las suites consecutivamente mediante `pnpm test:unit:locked`, `pnpm test:integration:locked` y, para los escenarios de reconocimiento relevantes, `pnpm test:e2e:locked`, según [las instrucciones del repositorio](agents/testing.md). Ejecutar formato, lint y tipos; actualizar Graphify después de modificar código.

En esta investigación solo se construyeron copias temporales de las dos primeras propuestas, se aplicó el Prettier instalado y se comprobó su sintaxis con TypeScript. **No se ejecutaron suites, comprobación de tipos, lint ni benchmarks, y no se afirma todavía equivalencia funcional.** No se modificaron código, tests, migraciones ni datos.
