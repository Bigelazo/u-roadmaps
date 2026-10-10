---
status: accepted
date: 2026-10-02
---

# Ejecutar las pruebas E2E en paralelo

Se acuerda refactorizar la suite E2E para ejecutar varios workers con casos independientes y datos aislados. Se acepta el coste de refactorización; mantener permanentemente un único worker no satisface el objetivo. La estrategia concreta se eligió en la sesión de grilling del 2026-10-03 y se describe en [Estrategia elegida](#estrategia-elegida).

Este ADR contempla únicamente la paralelización. Recuperar ahora el entorno E2E aislado, corregir los cuelgues y permitir ejecuciones consecutivas fiables forma parte de la sesión actual y no se posterga a este plan. Su configuración operativa se documentará en `docs/agents/testing.md`.

## Contexto

La configuración anterior al reset ejecutaba la suite con un worker. La reinstalación activó `fullyParallel: true`, pero los tests conservan supuestos de ejecución secuencial: usuarios y nodos con identidades compartidas, mutaciones sobre los mismos roadmaps y limpiezas globales.

La inspección encontró interferencias concretas:

- `tests/e2e/helpers.ts` expone identidades fijas utilizadas por varios archivos.
- `own-notifications.spec.ts` borra todos los avisos y reconocimientos antes de cada caso.
- Un test de ese archivo instala un trigger que rechaza cualquier inserción en `RoadmapNotice`, afectando potencialmente a otros workers. Otros tres archivos de avisos instalan triggers similares, acotados por datos del aviso.
- Progreso, simulaciones, avisos y archivos pueden sobrevivir a un caso y cambiar las precondiciones de otro.

Habilitar workers adicionales no resuelve estas dependencias. La revisión del 2026-10-01 descubrió 55 casos en Chromium y Firefox: 110 ejecuciones potencialmente competidoras. Este inventario es orientativo, no un contrato sobre el tamaño de la suite.

## Decisión

Cada test preparará el estado necesario y podrá ejecutarse individualmente, sin depender de otro caso ni de su posición en la suite. Sus mutaciones, consultas y limpiezas no afectarán al estado de otros tests.

El aislamiento deberá cubrir workers, proyectos de navegador, reintentos y reinicios de workers después de un fallo. Los datos estrictamente de lectura podrán compartirse si ninguna prueba los modifica. No se resolverá el problema introduciendo grupos seriales extensos que eliminen el paralelismo esperado.

La configuración final usará varios workers; el número se elegirá mediante mediciones de duración, CPU, memoria y conexiones a PostgreSQL. Las reproducciones individuales podrán usar un worker como herramienta de diagnóstico. La configuración provisional para recuperar el entorno se acuerda fuera de este ADR.

## Alternativas para el aislamiento

| Alternativa | Ventajas | Costes y límites |
| --- | --- | --- |
| Un servidor y una base E2E con datos exclusivos por caso | Menos procesos y configuración sencilla | Sustituir IDs compartidos, acotar consultas y limpiezas, y rediseñar efectos globales como el trigger de fallo |
| Base o esquema por worker, con servidor conectado a su partición | Aísla operaciones globales entre workers | Aprovisionamiento, migraciones y conexión coherente de aplicación y helpers; aún requiere independencia entre casos del mismo worker |
| Combinación para escenarios excepcionales | Reserva aislamiento costoso para los casos que lo necesitan | Más de un ciclo de preparación y mayor coste de mantenimiento |

Crear un esquema por worker es insuficiente si las peticiones llegan a un servidor conectado al mismo esquema. Mantener permanentemente un worker se descarta como solución final por decisión explícita del usuario. Compartir datos mutables y confiar en el orden de ejecución también se descarta: impide independencia y hace que el paralelismo produzca resultados no reproducibles.

## Estrategia elegida

Se elige la primera alternativa: **un servidor y una base E2E, con datos exclusivos por test**. El objetivo es reducir la latencia de una invocación; los agentes ejecutan la suite de forma secuencial, por lo que no se aíslan invocaciones simultáneas.

La medición del 2026-10-03, con un worker, Chromium y Firefox, dio 120 aprobados y 2 omitidos en 136,8 s: 15,5 s de `webServer` con build cacheado y 120,6 s de tests en serie. Paralelizar tests es, por tanto, la palanca principal.

Se descartó una base y un servidor por worker. Habría evitado reescribir la preparación de los casos, pero exigía varios procesos `next start`, aprovisionar bases y resolver `baseURL` y conexiones por worker, y seguía requiriendo independencia entre casos del mismo worker.

- **Fixture por test.** Un fixture de Playwright crea antes de cada test un curso propio con la forma del roadmap CC1002 del catálogo, con código `E2E-*`, IDs nuevos y usuarios propios para los roles que usan los tests. Lo elimina al terminar, también cuando el test falla. Se eligió el alcance por test frente al de worker porque el coste de inserción es despreciable frente a la duración de los casos y elimina la dependencia de orden dentro de un worker.
- **Cursos adicionales.** Un segundo fixture crea, dentro del mismo test, cursos extra sin roadmap, de otro semestre o con usuarios compartidos con el curso principal, para escenarios multicurso.
- **Usuarios propios.** Los destinatarios de avisos son exclusivos de cada test, porque la bandeja de un usuario agrega avisos de todos sus roadmaps.
- **Acceso a datos.** Los fixtures escriben con un cliente Prisma propio del proceso de tests, uno por worker, con la misma validación de base local. No se añaden endpoints de prueba a la aplicación. Si el cliente generado no cargara en Playwright, se usaría un único helper `psql` compartido. El piloto (#164) comprobó que el cliente generado no carga en Playwright y aplicó ese helper.
- **Fallos deliberados de PostgreSQL.** Un helper compartido instala triggers con nombre único que rechazan solo las inserciones de avisos del roadmap del test. Cuando el test crea ese roadmap durante el escenario y aún no conoce su ID, el filtro usa el curso del test, que tiene a lo sumo un roadmap. El escenario conserva el fallo real de PostgreSQL. Si el DDL concurrente produjera bloqueos, la alternativa es un trigger permanente controlado por una tabla de fallos solicitados.
- **Archivos.** El curso clonado omite los recursos de archivo del catálogo, porque borrar un nodo borra sus archivos y los del catálogo están compartidos. La limpieza del fixture elimina del disco los archivos subidos a su roadmap.
- **Datos compartidos.** El catálogo sembrado queda de solo lectura y solo lo consultan las pruebas del propio catálogo.
- **Huérfanos.** Un `globalSetup` de Playwright elimina, antes de cada invocación, los cursos `E2E-*` y los usuarios del dominio de prueba que hayan dejado ejecuciones interrumpidas.
- **Configuración final.** `fullyParallel: true`, número fijo de workers elegido midiendo 2, 3 y 4, sin reintentos y con el límite actual de fallos. La configuración cambia solo cuando toda la suite esté migrada; durante la migración los archivos migrados se validan en paralelo mediante opciones de CLI.

## Etapas para el plan posterior

1. **Inventariar interferencias** _(completada el 2026-10-03)_. Clasificar fixtures, mutaciones, limpiezas, archivos y efectos globales. Identificar casos que compiten por usuarios, roadmaps, avisos y progreso.
2. **Resolver el aislamiento mediante grilling** _(completada el 2026-10-03)_. Comparar las alternativas con escenarios concretos de edición concurrente, avisos por destinatario y fallo deliberado de PostgreSQL. Elegir una estrategia y documentar el ciclo de vida de sus recursos.
3. **Implementar un piloto paralelo.** Migrar casos representativos con mutaciones y efectos globales. Ejecutarlos con al menos dos workers y ambos navegadores, también individualmente y después de un fallo controlado.
4. **Migrar la suite.** Extender el patrón validado, sustituir identidades compartidas y eliminar limpiezas incompatibles. Conservar las aserciones de producto.
5. **Validar y medir.** Ejecutar la suite completa con concurrencia efectiva, comprobar independencia del orden y de ejecuciones anteriores, medir recursos y actualizar las instrucciones para agentes.

La recuperación operativa de la sesión actual será el punto de partida. Estas etapas no aplazan esa recuperación ni sus comprobaciones de terminación y repetibilidad.

## Respuestas de la sesión de grilling

- **Aislamiento mínimo para avisos y fallos de PostgreSQL:** datos y destinatarios propios por test, y triggers acotados al roadmap del test, con un solo servidor.
- **Datos por test y datos compartidos:** cada test posee su curso, roadmap y usuarios; solo el catálogo sembrado se comparte, en modo lectura.
- **Trigger de fallo:** helper compartido con filtro por roadmap y nombre único.
- **Limpieza tras fallo o reinicio de worker:** el teardown del fixture se ejecuta aunque el test falle; las interrupciones duras se limpian con `globalSetup` en la siguiente invocación.
- **Invocaciones simultáneas:** no se necesitan; los agentes ejecutan la suite de forma secuencial.
- **Presupuesto de workers:** solo local (6 núcleos, 8 GB, 100 conexiones PostgreSQL); no hay CI E2E. Se medirán 2, 3 y 4 workers.

## Criterios de aceptación

- La suite ordinaria pasa con varios workers y los proyectos Chromium y Firefox. Las integraciones externas opcionales mantienen exclusiones explícitas; no se añaden omisiones para ocultar interferencias.
- Cada caso puede ejecutarse por separado y en otro orden, con resultados independientes de los tests anteriores.
- Los casos que antes compartían registros o efectos globales pasan concurrentemente y después de un fallo controlado.
- La preparación y limpieza de un caso o worker no altera los recursos de otro.
- La suite paralela termina, puede ejecutarse de nuevo y conserva el aislamiento respecto del entorno de desarrollo ya establecido.
- La documentación registra estrategia, comandos, número de workers y mediciones reales, sin declarar la migración completa antes de verificarlos.

## Referencias

- [Playwright: buenas prácticas y control de los datos](https://playwright.dev/docs/best-practices).
- [Playwright: paralelismo y aislamiento del estado compartido](https://playwright.dev/docs/test-parallel#avoiding-shared-state-in-parallel-tests).
- [Playwright: fixtures y ciclo de vida de recursos](https://playwright.dev/docs/test-fixtures).

## Medición final de #168 — 2026-10-06

La suite completa de Chromium y Firefox, con datos propios por test, pasó
consecutivamente con 2, 3 y 4 workers, sin limpieza manual: **140 aprobados,
cero fallos y cero omisiones** en cada invocación. Se activa `fullyParallel:
true` y se fijan **2 workers**, manteniendo `retries: 0` y `maxFailures: 3`.
La migración se declara completa después de estas comprobaciones.

| Workers | Duración completa | CPU media / pico (% de un núcleo) | RSS máximo (MiB) | Conexiones PostgreSQL total / E2E |
| --- | ---: | ---: | ---: | ---: |
| 1 (control) | 174,82 s | 140,8 / 329,7 | 1900,1 | 17 / 17 |
| 2 | 143,53 s | 239,2 / 414,3 | 2026,1 | 19 / 19 |
| 3 | 136,41 s | 292,3 / 449,9 | 3133,5 | 20 / 20 |
| 4 | 148,31 s | 308,0 / 470,9 | 3965,0 | 22 / 22 |

Subir de 2 a 3 mejora solo **4,96 %**, por debajo del umbral aproximado del
10 %; con 4 aumenta la duración y la memoria. Se elige el menor candidato en
ese punto: 2. Se midió en Apple A18 Pro, 6 núcleos y 8 GiB, con build cacheado.
La CPU y RSS corresponden al árbol de procesos de la invocación; las conexiones
son muestras de client backends y excluyen la observación. Las cifras no son
picos continuos ni mediciones estadísticas de varias repeticiones.

Todas las invocaciones dejaron cero Ramos y Usuarios E2E y cero triggers de
rechazo de avisos; conservaron la huella completa de filas de `roadmap_dev_db`.
El trigger permanente de Inbox de la aplicación se conserva para SSE.
El [historial de validación](../testing-validation-history.md#paralelismo-y-mediciones-de-168--2026-10-06)
y los [resúmenes medidos](../measurements/issue-168.json) registran metodología,
comandos, estado transitorio de avisos y límites de la evidencia.

El control con un worker sobre el mismo código pasó los 140 casos, sin
omisiones, en **174,82 s**. Dos workers reducen esa duración en **17,90 %**
(31,29 s). El control se ejecutó después de los candidatos 2, 3 y 4; todos
usaron preparación y build cacheado, sin limpieza manual entre invocaciones.

La aceptación final, después de resolver los cinco hallazgos de la revisión
única e incorporar `bd3d939` del remoto, ejecutó dos suites completas
consecutivas con la configuración elegida: **140 E2E aprobadas** en **159,75 s**
y **140 E2E aprobadas** en **2,8 minutos**, sin fallos, omisiones ni limpieza
manual. La segunda fue `pnpm test`, que también aprobó tipos y **302 unitarios**.
Las auditorías conservaron desarrollo y los reconocimientos históricos del
catálogo y no dejaron datos propios ni triggers de fallo. Estas comprobaciones
validan el estado final; las mediciones de selección se hicieron sobre la base
`2ebba0d` antes de los ajustes de revisión, manteniendo los mismos recorridos.
