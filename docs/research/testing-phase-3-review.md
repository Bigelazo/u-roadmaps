# Revisión de etapa 3: semántica SQL

Investigación de lectura del 2026-11-05 sobre el checkout actual. No se modificaron
producción, pruebas ni configuración y no se ejecutaron suites. Se usaron Graphify,
código del repositorio y documentación primaria. Las cantidades son estimaciones
de implementación futura, no líneas escritas ni resultados de ejecución.

## Decisión

Conservar la infraestructura y reducir la propuesta a un archivo nuevo de casos
SQL discriminantes y dos ampliaciones pequeñas. DISTINCT ya tiene una prueba
real explícita; visibilidad de docentes, bloqueo y ocultación también. Los huecos
más claros son los límites temporales exactos, fallback de claves nulas, separación
entre dos Nodos al revisar y aislamiento con datos asimétricos. No cambiar SQL para
hacerlo testeable ni repetir en PostgreSQL la identidad de sesión del handler.

## Evidencia y cambios respecto del plan

| Decisión | Evidencia vigente | Consecuencia |
| --- | --- | --- |
| Conservar DISTINCT existente | `tests/notifications-integration/title-lifecycle.test.ts:118`: renombra, reconoce, vuelve a renombrar el mismo destino y exige marca 1 en línea 129. El reconocimiento conserva filas históricas. | Quitar de la lista de tests nuevos el caso histórico + pendiente del mismo target. Extender ese mismo test con otro target del mismo Nodo y exigir 2. |
| Conservar paridad de visibilidad | `tests/notifications-integration/inbox-visibility.test.ts:114` recorre cuatro estados y dos roles; líneas 136–145 usan `participantNodeAccess` e `isNoticeVisible` reales para formar el oráculo. | Útil como paridad; no presentarlo como oráculo independiente de reglas compartidas. |
| No duplicar matriz docente | `tests/notifications-integration/teaching-staff-notices.test.ts:121` ya exige resultados literales: docente 2 y estudiante 1 para descripción pendiente cuando se oculta o bloquea el Nodo. | Eliminar la nueva matriz genérica de ocultos/bloqueados/docente. Ya hay conteos y marcas independientes, además de la paridad. |
| Conservar ausencia de Nodo | `tests/notifications-integration/absorption-lifecycle.test.ts:77` borra un Nodo y exige Inbox vacío, count 0 y ausencia de marca. | No crear otro caso de Nodo eliminado; un caso de fixture inicialmente vacía solo acredita las formas públicas completas. |
| Ampliar revisión selectiva | `tests/e2e/own-node-counts.spec.ts:33` cubre coalescencia, reconocimiento, revisión y nuevo cambio; líneas 41 y 54 usan un segundo Nodo sin cambios. | Falta un segundo Nodo con marca positiva que sobreviva a revisar el primero. Agregar esa diferencia en integración, sin copiar el recorrido visual E2E. |
| Añadir tiempo exacto | `src/features/notifications/infrastructure/inbox-query.ts:42` usa `availableAt > noticeResetAt`; línea 46 excluye `reviewedAt >= availableAt`. No hay fixtures explícitas de igualdad en integración. | Dos casos separados con tres instantes y targets distintos para impedir que DISTINCT esconda errores. |
| Añadir fallback explícito | `inbox-query.ts:148` usa `DISTINCT COALESCE(targetKey, id::text)`. La paridad actual crea claves nulas pero no compara dos avisos del mismo destino visible con expectativa literal independiente. | Dos filas sin clave del mismo Nodo deben producir marca 2. |
| Afinar aislamiento | La paridad en `inbox-visibility.test.ts:97` entrega a estudiante/docente la misma matriz y el mismo instante. `own-inbox.ts:94` también precarga acceso por participación. | Preparar cardinalidades diferentes y distractores que realmente sobrevivan a filtros previos; un 0 de usuario ajeno sin filas propias no basta para probar el predicado de destinatario. |
| Separar HTTP | `tests/app/api/notification-counts.test.ts:65` busca fragmentos de SQL; líneas 37–69 sintetizan sus resultados. | Etapa 1 conserva identidad, validación y serialización con feature simulada. Retirar únicamente las dos aserciones SQL tras validar los casos reales; no borrar el archivo. |

La interfaz pública mantiene acceso real: `src/features/notifications/server.ts:26–39`
delega a `readParticipantAccess`. Conteos pendientes usan `count(*)`, no DISTINCT
(`inbox-query.ts:137`); solo marcas agrupan por Nodo y deduplican target. Reconocer
no es revisar: son ramas SQL distintas (líneas 39–46). No escribir expectativas
que exijan que un reset filtre también Inbox pendiente: hoy ese límite solo está
en la rama de marcas; la retirada de pendientes pertenece al trigger.

## Paquete mínimo exacto

1. **Modificar `title-lifecycle.test.ts`, caso de línea 118.** Tras el `byNode: 1`
   existente, cambiar descripción del mismo Nodo con `teacherEdits().update` y
   exigir la entrada `[nodeId]: 2` con `toMatchObject`. Hacerlo al final, después
   del conteo 3 y de la agrupación existente: los otros dos Nodos siguen teniendo
   marcas y no se debe exigir un mapa que los omita. Son 2–4 instrucciones nuevas;
   no añadir otro test DISTINCT.
2. **Nuevo `inbox-counts.test.ts`: fallback y vacío.** Antes de sembrar: `{ count: 0 }`
   y `{ byNode: {} }`. Insertar dos avisos pendientes `node-title` para el mismo
   Nodo, IDs/eventIds diferentes, `targetKey: null`; exigir pendientes 2 y marca 2.
   No usar el productor de cambios: crea claves modernas y no ejercita fallback.
3. **Nuevo: reconocimiento y revisión selectiva.** Dos Nodos visibles, cambios
   públicos antiguos (títulos) y marcas literales A:1/B:1. `enterRoadmap` deja
   pendientes 0 y conserva ambas marcas. `reviewOwnNode(studentId, { roadmapId,
   nodeId: A })` devuelve reviewed y deja exactamente B:1. Otro destinatario con
   marca en A permanece intacto. Cambios sembrados con fecha fija pasada evitan
   igualdad accidental con el `new Date()` de revisión. No probar aquí transporte.
4. **Nuevo: límite de revisión.** Crear tres avisos reconocidos, targets diferentes,
   mismo Nodo y `availableAt = t−1 ms, t, t+1 ms`; upsert directo de
   `NodeChangeReview.reviewedAt = t`. Exigir marca 1; luego actualizar review a
   `t+1 ms` y exigir `{ byNode: {} }`. Esto distingue `>=` de `>` y la dirección
   temporal. `noticeResetAt` queda null; no mezclar ambos límites.
5. **Nuevo: límite de reset.** Sin review, `noticeResetAt = t` sobre participación
   activa (sin cambiar `isActive`), tres avisos reconocidos y targets diferentes
   en t−1/t/t+1. Exigir marca 1, no 2. Quitar reset deja marca 3. Son snapshots
   válidos para leer la consulta; la transición real del trigger se prueba aparte.
6. **Nuevo: destinatario y Roadmap asimétricos.** En curso A, estudiante con 1
   target y compañero con 2, todos visibles; exigir count/marcas 1 frente a 2.
   Con `otherCourse`, dar al mismo estudiante participación activa y un target en
   su Nodo; exigir que consultar A no incluya B y consultar B devuelva su propio
   mapa. La participación en B hace que el aviso distractor sea elegible sin el
   filtro de Roadmap; los UUIDs deben pertenecer a sus fixtures. No hace falta
   probar parámetros de sesión aquí.
7. **Modificar `participation-deactivation.test.ts`, caso de línea 130.** Antes de
   desactivar, generar y reconocer un cambio con marca positiva. Después de
   desactivar, comprobar pendientes 0, marcas `{}` y que la fila histórica
   reconocida sigue en DB. Tras reactivar, marcas siguen vacías; un cambio nuevo
   genera marca 1. Esto agrega cobertura del reset real sin duplicar la sincronización.
8. **Nuevo, aislador de participación activa.** Desactivar primero, luego insertar
   directamente una fila pendiente y una reconocida con `availableAt` posterior
   al reset leído. Consultar funciones públicas: pendientes 0/marcas `{}`; reactivar
   sin cambios devuelve pendientes 1/marca 1 (mismo target para ambas filas).
   La fila pendiente insertada después del trigger es intencionalmente imposible
   por el productor normal: aisla defensa de lectura ante datos rezagados. La
   fila reconocida y fecha posterior impiden que el trigger o reset vuelvan el
   test vacuo. Si no se acepta este estado defensivo en fixtures, documentar que
   no se acredita sensibilidad del JOIN activo: el caso público anterior no basta.

No crear helpers globales. Un constructor local tipado de avisos (curso, destinatario,
Nodo, target/fecha/reconocimiento) y un lector local de resultados bastan. Para
los casos temporales, tres `targetKey` distintos deben corresponder a targets
válidos (por ejemplo título, descripción y tipo) y Nodos abiertos; no inventar
`noticeTarget` desconocidos que `shownToCase` excluye. No computar la expectativa
con ese descriptor ni con un predicado SQL copiado.

## Índices, triggers, tiempo y limpieza

El índice parcial `RoadmapNotice_pending_target_key` cubre solo filas no reconocidas
con clave no nula (`prisma/migrations/20261006150000_node_title_notice_targets/migration.sql:7`).
Así, las repeticiones históricas reconocidas son legales; dos pendientes con
misma clave no lo son. Las claves nulas del caso heredado quedan fuera del índice.
Esto coincide con [PostgreSQL: índices parciales](https://www.postgresql.org/docs/18/indexes-partial.html),
que permite restringir unicidad al subconjunto definido por su predicado.

`withdraw_participation_notices` borra pendientes y fija el reset al desactivar,
no borra históricos (`prisma/migrations/20261009150000_participation_loss_known_values/migration.sql:4`).
El trigger se instala BEFORE UPDATE OF isActive
(`prisma/migrations/20261007151000_withdraw_inactive_participation_notices/migration.sql:20`).
Preparar una fila y desactivar después no aísla el filtro activo del lector.

Los tres campos usan precisión de milisegundos (`prisma/schema.prisma:192`,
`:255`, `:268`). Elegir UTC explícito, por ejemplo `2026-01-01T00:00:00.000Z`, y
±1 ms; no microsegundos JS, sleep ni fake timers del driver. El reloj de la
transición pública no se fija: leer su reset persistido y sembrar después, o
usar fechas históricas. `clock_timestamp()` y `CURRENT_TIMESTAMP` tienen
semánticas diferentes según [PostgreSQL: fecha/hora actual](https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT);
no asumir que el trigger y `new Date()` de revisión comparten un instante.

Reutilizar `course` y `otherCourse`: IDs aleatorios y `finally` en
`tests/notifications-integration/fixtures.ts:83`. La limpieza elimina avisos por
curso antes de eliminar cursos y usuarios, con rollback y cierre de conexión
(`tests/notifications-integration/database.ts:31`). Las participaciones adicionales
usan exclusivamente esos usuarios y cursos: no crear usuarios externos sin
registrarlos en limpieza. Reviews se eliminan por relaciones al borrar usuarios/Nodos;
no introducir transacción exterior que no abarque conexiones de aplicación.

El significado de DISTINCT procede de [PostgreSQL: agregados](https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-AGGREGATES).
Estas fuentes justifican fixtures legales y expectativas; no prueban que la suite
actual detecte una mutación. Verificar esa sensibilidad durante implementación,
un cambio por vez: quitar DISTINCT (caso existente), cambiar >= o > (temporales),
quitar recipient/Roadmap (asimétrico), quitar participación activa (aislador).
La consulta debe producir un valor incorrecto y fallar una aserción; un timeout,
un error de índice o un fallo de acceso previo no acredita el filtro mutado.

## Estimación LOC de implementación

Líneas físicas incluidas líneas en blanco/imports; no contar archivos completos
como adiciones. Los rangos cubren los ocho cambios anteriores, sin HTTP de etapa 1,
mutaciones temporales ni documentos de investigación. Son escenarios propuestos,
no un requisito de cantidad de tests.

| Categoría | Adiciones | Eliminaciones | Qué comprende |
| --- | ---: | ---: | --- |
| Producción | 0 | 0 | Consultas, acceso, esquema e índices actuales |
| Tests: casos/aserciones | 145–205 | 0–4 | Seis casos nuevos y ampliaciones de título/participación |
| Fixtures/helpers locales | 35–55 | 0 | Constructor de aviso, parámetros y lectura; dentro del archivo nuevo |
| Configuración/infraestructura | 0 | 0 | Fixtures, runner y limpieza existentes |
| Documentación de implementación | 8–15 | 3–8 | Ajustar etapa 3 del plan y registrar garantías sin repetir este informe |
| **Total etapa 3** | **188–275** | **3–12** | Neto aproximado +176–272 |

Las dos aserciones SQL retiradas en `notification-counts.test.ts:66–67` pertenecen
al cambio HTTP, no se suman nuevamente aquí. Si el aislador defensivo de participación
se omite, restar 20–30 líneas de casos; explicar la garantía que queda sin demostrar.
No agregar Testcontainers, SQLite, otro runner, suite E2E ni cambios a CI para esta
etapa. La validación futura sigue la guía del repo y sus locks; este informe no
reporta suites aprobadas ni sensibilidad ejecutada.
