# Pruebas para agentes

## Estado actual

La configuración E2E está en [playwright.config.ts](../../playwright.config.ts).
Usa Chromium y Firefox con `fullyParallel: true`, workers fijos, `retries: 0`
y `maxFailures: 3`. La selección de workers y la validación vigente de #168 se
registran al final de esta guía; las validaciones anteriores son antecedentes.

Todos los specs mutables usan datos propios por test del
[ADR-0013](../adr/0013-enable-parallel-e2e-tests.md). Solo
`development-fixture.spec.ts` consulta las identidades del catálogo sembrado,
que queda de solo lectura. `fixtures.ts` usa el catálogo como plantilla para
crear copias con IDs nuevos, sin modificarlo. El helper compartido conserva
únicamente las identidades que necesita el spec del catálogo.

## Preparación y aislamiento

Usar el servicio PostgreSQL local existente. Configurar `E2E_DATABASE_URL` en
`.env` con una conexión a `roadmap_e2e_db`. La configuración rechaza destinos que
no sean locales o que tengan otro nombre de base. Instalar los navegadores una
vez:

```sh
pnpm exec playwright install chromium firefox
```

Playwright carga `.env` y configura el mismo entorno para el runner y sus
procesos hijos. Su `webServer` ejecuta, en orden:

1. `prisma migrate deploy` contra la base E2E.
2. El script existente `scripts/reset-development-data.ts` para restaurar fixtures.
3. `next build`.
4. `next start -p 3200`.

Antes de arrancar los workers, el `globalSetup` de Playwright
([tests/e2e/global-setup.ts](../../tests/e2e/global-setup.ts)) elimina los datos
propios de tests que haya dejado una ejecución interrumpida. No hay scripts
adicionales de orquestación. El build usa el modo de producción de Next.js con
datos y secretos de prueba.

| Recurso          | Desarrollo              | E2E                     |
| ---------------- | ----------------------- | ----------------------- |
| Base PostgreSQL  | `roadmap_dev_db`        | `roadmap_e2e_db`        |
| URL habitual     | `http://localhost:3000` | `http://localhost:3200` |
| Compilación      | `.next`                 | `.next-e2e`             |
| Archivos subidos | `uploads`               | `uploads-e2e`           |

Los helpers SQL y el servidor apuntan a la misma base E2E. La ejecución habitual
usa fixtures académicos y tokens de autenticación locales; no necesita VTI,
U-Campus ni Novu Cloud disponibles.

## Datos propios por test

Los specs migrados importan `test` y `expect` desde
[tests/e2e/fixtures.ts](../../tests/e2e/fixtures.ts) en lugar de
`@playwright/test`:

- `course`: un Curso propio con la forma del Roadmap CC1002 del catálogo (Nodos,
  Tipos de nodo, Dependencias, Recursos de enlace y progreso de estudiantes),
  sus Usuarios por rol (`course.users.teacher`, `studentWithProgress`,
  `multiCourseStudent`, etc.), `course.nodes`, `apiPath()` y `pagePath()`.
- `createCourse(opciones)`: Cursos adicionales sin Roadmap, de otro Período
  académico, del mismo Ramo que otro Curso del test (`sameCourseAs`) o con
  Usuarios de `course` como participantes.
- `rejectNoticeInserts({ roadmapId })` o `({ courseOfferingId })`: un fallo real
  de PostgreSQL solo para los Avisos de ese Roadmap, o del Roadmap que el test
  creará en ese Curso. Puede filtrar `noticeClass` y devuelve `wasAttempted()`;
  sus triggers, funciones y secuencias se eliminan por el mismo ciclo de fixtures.
- `createUser()`: un Usuario propio sin Participaciones, para comprobar aislamiento.
- `apiAs(usuario)`: un cliente de API autenticado como ese Usuario, que se cierra
  al terminar el test.

Todo se elimina al terminar el test, también si falla, incluidos los archivos
subidos a sus Roadmaps. Los Ramos usan el prefijo `E2E-` y los Usuarios el
dominio `@e2e.u-roadmaps.test`; el `globalSetup` usa esas marcas para limpiar
huérfanos y nunca toca el catálogo sembrado.

Las consultas SQL usan el único helper `psql` de
[tests/e2e/database.ts](../../tests/e2e/database.ts), con la misma validación de
base local. El cliente Prisma generado no carga dentro de Playwright (issue #164),
por lo que se aplicó el plan B del ADR. Todos los specs acceden a SQL mediante
el helper compartido; no quedan copias locales de `psql`.

Playwright administra el servidor y lo cierra al terminar. No reutiliza uno
existente (`reuseExistingServer: false`). Puede coexistir con desarrollo, pero
**no deben ejecutarse dos invocaciones E2E simultáneas**, porque comparten base,
puerto, compilación y fixtures. Las invocaciones consecutivas preparan sus datos
y arrancan su servidor automáticamente.

## Comandos

Suite completa:

```sh
pnpm test:e2e
```

La salida habitual conserva el listado de tests y el resumen final, y oculta
stdout del servidor (preparación, build y avisos guardados). stderr permanece
visible para advertencias y errores, incluidos los fallos de entrega provocados
deliberadamente por algunos tests. Para ver también stdout al diagnosticar:

```sh
DEBUG=pw:webserver pnpm test:e2e
```

Antecedente del 2026-10-02, conservado solo como historial (no es la
verificación vigente y referencia un archivo Cloud retirado):

```sh
pnpm test:e2e --grep-invert 'own-.*notifications|roadmap-(novu-websocket|realtime-prototype)'
```

El filtro excluye los tres archivos de avisos y los dos de señales Novu.

Reproducción de un caso en un navegador:

```sh
pnpm test:e2e tests/e2e/roadmaps.spec.ts --project=firefox --workers=1 --grep 'normalized Course offering'
```

La suite se detiene tras tres fallos. Para recoger todos los fallos en una
auditoría explícita, usar `pnpm test:e2e --max-failures=0`. Los casos que no llegaron
a ejecutarse no cuentan como pruebas aprobadas.

El ensayo Cloud y su activación fueron retirados en #161. La suite vigente
comprueba SSE propio y resúmenes contra Node y PostgreSQL sin credenciales
externas ni omisiones por falta de Novu. Las omisiones Cloud de las evidencias
anteriores se conservan como antecedentes, no como configuración actual.

## U-Campus local para permisos institucionales

Desde #191, `globalSetup` inicia un servidor HTTP de U-Campus en
`127.0.0.1:3201`, cerrado por su teardown. Playwright configura ese origen y un
token de prueba para el servidor de la aplicación. Las respuestas se registran
por RUT propio de cada test con `reportPosition`; su fixture elimina los registros
al terminar. Los Usuarios sin respuesta registrada reciben un 503 institucional
y mantienen el comportamiento local. `createCourse({ roadmap: false })` registra
como profesor de cátedra a sus Participations docentes activas para los tests de
creación; los casos de otros cargos sobrescriben ese dato explícitamente.

No se infiere un cargo institucional desde un rol guardado en la aplicación.
Desde #187, la creación usa el cargo confirmado por U-Campus o, ante una respuesta
fallida o parcial, el cargo de profesor de cátedra guardado en una Participation
activa. Un cargo desconocido nunca autoriza crear. Una respuesta fallida o parcial
no reescribe Participations. La proyección de los datos válidos
parciales sigue disponible sin reemplazar el rol local guardado.

## Límites y evidencias de fallo

| Operación                                        | Límite                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Preparación, build y disponibilidad del servidor | 180 s                                                              |
| Lanzamiento de cada navegador                    | 10 s                                                               |
| Test                                             | 30 s por defecto de Playwright; algunos casos declaran otro límite |
| Acción del navegador                             | 10 s                                                               |
| Navegación                                       | 15 s                                                               |
| Conexión de `psql`                               | 5 s                                                                |
| Consulta / espera de lock de `psql`              | 10 s / 5 s                                                         |
| Proceso auxiliar `psql` en helpers               | 15 s                                                               |
| Suite completa                                   | 25 min                                                             |
| Cierre del servidor con SIGTERM                  | 5 s antes del cierre forzado                                       |

La suite conserva un límite global de 25 minutos para preparación y ejecución
paralela en ambos navegadores. La entrega es inmediata y ya no hay esperas de
ventanas de agrupación de 60 segundos. Los límites por caso y por infraestructura
no se ampliaron.

El lanzamiento del navegador ocurre en un fixture de worker y tiene su propio
plazo: el timeout normal del test no lo sustituye. Los límites SQL indicados
corresponden a los helpers `psql`, no a todas las consultas Prisma del servidor.

El reporte HTML queda en `playwright-report/` y las trazas de fallos en
`test-results/`. La ejecución no abre automáticamente el visor: debe devolver un
código de salida y terminar por sí sola. Guardar las evidencias necesarias antes
de volver a ejecutar tests, porque los resultados pueden reemplazarse.

Para inspección manual:

```sh
pnpm exec playwright show-report
pnpm exec playwright show-trace test-results/<caso>/trace.zip
```

Estos visores son interactivos y deben cerrarse manualmente; no forman parte del
comando de validación de los agentes.

## Diagnosticar antes de cambiar tests

Identificar la fase que falla: preparación, arranque del navegador, ejecución del
caso o limpieza. Conservar el error exacto, el nombre del caso y la duración.
Contrastar la expectativa con el comportamiento requerido antes de modificar el
test o la implementación. Un timeout no es una prueba aprobada y no justifica
por sí solo aumentar los plazos ni añadir reintentos.

- **Prisma `P1001` dentro de un sandbox:** puede deberse a restricciones de acceso
  al PostgreSQL local. Repetir el mismo comando mediante la herramienta de
  permisos ampliados para PostgreSQL, HTTP local y navegadores. Registrar el
  error o cualquier rechazo de permisos; no reiniciar PostgreSQL como recuperación.
- **Puerto 3200 ocupado:** identificar el proceso y comprobar si existe otra
  corrida. No reutilizar ni terminar indiscriminadamente un servidor ajeno.
- **`browserType.launch` en Firefox:** revisar el log del navegador y el entorno
  de ejecución antes de investigar selectores o reglas del producto. El reporte
  del usuario mostró una espera de 180 s con errores de permisos de macOS y del
  renderizador, antes de entrar al test. El límite actual de 10 s evita esa espera
  excesiva; no demuestra que se haya reparado la causa intermitente del navegador.
- **Error de aserción o acción:** reproducir el caso individualmente y revisar su
  traza. Separar selectores o expectativas desactualizadas de regresiones reales
  y de interferencias entre fixtures.

En la investigación de Firefox, un arranque dentro del sandbox abortó; cinco
arranques con permisos ampliados tardaron entre 0,99 y 1,68 s y el caso original
pasó. Un proceso deliberadamente no responsivo agotó el nuevo plazo y se cerró
en 10,02 s. No se desactiva el sandbox interno de Firefox ni se atribuyen todos
los errores gráficos a las restricciones del agente.

## Alcance de la validación

Antes del ajuste de lanzamiento, dos corridas completas consecutivas terminaron
con **108 passed y 2 skipped**, en **2,6 y 2,4 minutos**, sin limpieza manual entre
ellas. Se comprobó el cierre del puerto E2E y que la base de desarrollo conservaba
la misma huella. Son antecedentes de repetibilidad, no una validación nueva de
notificaciones con la configuración posterior.

La validación de la rama de **#159**, basada en **8b184e9**, del **2026-10-04**
ejecutó `pnpm test:e2e` completo en Chromium y Firefox: **124 aprobados, 0 fallidos
y 2 omitidos** (las integraciones Cloud optativas), en **2,4 minutos**, con salida
0. Incluye SSE propio real, cambios de acceso, borradores, sincronización entre
pestañas y reconexión. El servidor cerró el puerto E2E al terminar. Tipos, ESLint
y Prettier de los archivos modificados también pasaron. Esta evidencia sustituye
la selección anterior de 80 casos sin notificaciones; no valida el comando
agregado `pnpm test` por los fallos unitarios documentados a continuación.

## Suite unitaria y comando agregado

`pnpm test:unit` ejecuta Vitest con `globals: true`, que permite a React Testing
Library registrar la limpieza automática del DOM. Ya no referencia el archivo
eliminado `vitest.setup.ts`. Los tests mantienen sus imports explícitos de Vitest;
los escenarios que necesitan un viewport deben declarar y restaurar su
`matchMedia` localmente, y los contratos HTTP sin consultas deben aislar Prisma.

La validación de la rama de **#159**, basada en **8b184e9**, del **2026-10-04**
ejecutó toda la suite: **56 archivos aprobados y 7 fallidos; 269 pruebas aprobadas
y 38 fallidas**, en **58,41 s**, con salida 1. Los fallos ajenos al SSE corresponden
principalmente a `matchMedia` ausente en cuatro suites de UI, inicialización de
Prisma en un contrato HTTP y una expectativa antigua de entrega Novu. El test de
arquitectura agotó su plazo durante esa corrida; una reproducción focalizada
posterior pasó sin cambiarlo. SSE propio, sesión del canvas y arquitectura sumaron
**27 pruebas aprobadas** en **16,13 s**, con salida 0.

`pnpm test` ejecuta tipos, unitarios y E2E en secuencia. Con los fallos existentes
de unitarios, **no se considera validado** el comando agregado. Usar
`pnpm test:e2e` para la comprobación E2E y `pnpm typecheck` para comprobar tipos;
una selección unitaria aprobada no sustituye la suite completa.

## Validación de #160 del 2026-10-04

La reimplementación de Resúmenes de cambios, basada en `3ceb351`, pasó
`pnpm typecheck`, ESLint y Prettier de los archivos modificados. Se ejecutó
`code-review` una sola vez y se resolvió su sugerencia de extraer la preparación
repetida de Nodos existentes al helper SQL `tests/e2e/existing-node.ts`.

La suite unitaria completa terminó con **64 archivos y 330 pruebas aprobadas**,
sin fallos ni omisiones, en **26,78 segundos** y con salida 0. Esta evidencia
sustituye los fallos unitarios de la validación anterior de #159 para este estado
del código.

La suite E2E completa terminó con **126 aprobados, cero fallos y dos omitidos**,
correspondientes a las integraciones Cloud optativas, en **12,6 minutos** y con
salida 0. Incluye Chromium y Firefox, la ventana de producción de 60 segundos,
primer aviso inmutable, resumen separado, reconocimiento indivisible, llegada
posterior a una apertura, SSE entre pestañas y paginación conservada. Las suites
se ejecutaron por separado; no se ejecutó el comando agregado `pnpm test`.

## Revisión única de #161

Se ejecutó `code-review` una sola vez, sobre los cambios desde `ad02f3c`, y se
aplicaron todas sus sugerencias antes de la validación final.

### Standards

- Los specs migrados de clasificación y Dependencias duplicaban el runner SQL.
  Ahora usan el helper compartido `tests/e2e/database.ts`, con validación de base
  local y límites de conexión, consulta y proceso.
- Sus fallos de PostgreSQL tenían triggers privados ligados al texto del aviso.
  Ahora usan `rejectNoticeInserts` ligado al Roadmap, filtro opcional por clase y
  evidencia de inserción intentada. Triggers, funciones y secuencias participan
  en el teardown y la limpieza de huérfanos del ADR-0013.

### Spec

- Faltaba comprobar el aislamiento del transporte SSE real para un Usuario ajeno
  al Curso. El nuevo recorrido abre dos `EventSource` nativos autenticados,
  espera `ready`, realiza una edición docente real y comprueba señales Inbox y
  Roadmap del destinatario, sin señales para el Usuario ajeno durante una
  observación acotada. No se inyectan eventos ni se simula el transporte.

Hallazgos resueltos: dos de Standards (helper y ciclo de vida de fixtures) y uno
de Spec (aislamiento SSE real).

## Validación final de #161 del 2026-10-04

`pnpm test` completo terminó con salida 0: tipos aprobados, **57 archivos y 302
pruebas unitarias aprobadas** en **22,09 segundos**, y **136 E2E aprobadas, cero
fallos y cero omisiones**, en **19,2 minutos**. La suite E2E ejecutó Chromium y
Firefox secuencialmente contra el PostgreSQL local existente y un servidor Node
de producción. Esta evidencia valida el comando agregado y sustituye las
omisiones Cloud de los antecedentes para el estado vigente.

Incluye primera entrega, ventana real de 60 segundos, primer aviso inmutable,
resúmenes separados de Recursos, clasificación y Dependencias, SSE entre
sesiones y pestañas, actualización del Roadmap y contadores, reconocimiento
indivisible, aislamiento de un Usuario ajeno al Curso, acceso revocado, audiencia,
paginación, reconexión, escritorio/móvil, teclado, foco, carga/error y reintento.
Los fallos reales de PostgreSQL conservaron los cambios docentes confirmados.

`pnpm install --frozen-lockfile` pasó después de retirar los SDK; el build y
arranque de producción forman parte de la preparación E2E. La comprobación
`NEXT_DIST_DIR=.next-e2e pnpm check:notification-bundle` inspeccionó **569 artefactos
de navegador y servidor**, además de manifiesto y lockfile, sin SDK ni
configuración de Novu. ESLint de los archivos modificados terminó sin errores y
con tres advertencias de condicionales de tests; Prettier y `git diff --check`
pasaron. `graphify update .` actualizó el grafo AST sin llamadas externas.

El despliegue documentado usa Node y el servicio PostgreSQL existente. No se
validó Docker ni se añadieron archivos de contenedores; el README anterior
mencionaba archivos de empaquetado ausentes y se corrigió.

Al terminar no quedaron Ramos `E2E-*`, Usuarios del dominio reservado, triggers
ni secuencias de fallos; las cuatro consultas de limpieza devolvieron cero.


## Validación de #166 del 2026-10-04

Los specs de layout, Visibilidad y Dependencias, acceso estudiantil a Nodos y
Recursos, Previsualización del canvas y simulación usan ahora `course`, `apiAs`
y, para Cursos adicionales, `createCourse`. El spec de actualización por SSE
ya usaba datos propios y se incluyó en toda la validación. Las Completaciones,
simulaciones y archivos subidos se eliminan con el Curso mediante el teardown
compartido. Las aserciones de producto se conservaron.

La invocación conjunta con `--workers=3 --fully-parallel --repeat-each=5`, en
Chromium y Firefox, terminó con **170 aprobados, cero fallos y cero omisiones**,
en **3.3m**, con salida 0:

| Spec | Casos | Ejecuciones repetidas aprobadas |
| --- | ---: | ---: |
| `roadmap-layout.spec.ts` | 7 | 70 |
| `roadmap-visibility-dependencies.spec.ts` | 4 | 40 |
| `student-node-access.spec.ts` | 2 | 20 |
| `roadmap-canvas-preview.spec.ts` | 1 | 10 |
| `roadmap-simulation.spec.ts` | 1 | 10 |
| `roadmap-realtime-prototype.spec.ts` | 2 | 20 |

Cada uno de los **17 casos** también pasó en una invocación individual con
`--grep`, en ambos navegadores: **34 ejecuciones aprobadas**, todas con salida 0.
El filtro usa el título escapado y `$` al final; Playwright antepone proyecto y
archivo al título completo, por lo que `^` delante del título corto no coincide.
Después de la corrida paralela y de cada invocación individual, las consultas
acotadas devolvieron cero Ramos `E2E-*`, Usuarios del dominio reservado,
Completaciones, simulaciones, Recursos de archivo propios y triggers de fallo;
el directorio de uploads no contenía archivos sin referencia en la base.

El ensayo paralelo inicial expuso conflictos reales de serialización entre
Cursos independientes: el adaptador pg podía propagar `TransactionWriteConflict`
directamente al confirmar la transacción, mientras el editor solo reconocía
`P2034`. La regresión de Dependencias concurrentes falló en sus tres primeras
ejecuciones antes del arreglo. Ahora el editor reconoce ambas formas y limita
la operación a cinco intentos con espera exponencial y jitter; la regresión
pasó antes de la validación completa y está incluida en sus 170 ejecuciones.
El escenario realtime revoca su Participación real en PostgreSQL, evitando que
una respuesta 403 simulada de una sola petición dependa del orden de señales SSE.

Se ejecutó `code-review` **una sola vez**, desde `7193ad0e`, y se aplicaron sus
dos sugerencias: Standards pidió extraer la preparación repetida de Nodos por
HTTP a `tests/e2e/create-node.ts`; Spec pidió demostrar la limpieza de una
simulación persistida, porque los escenarios ordinarios reinician el progreso.
Los probes temporales crearon y verificaron una simulación antes del fallo.

Un fallo deliberado de aserción produjo **2 fallidos esperados y 2 aprobados**
concurrentes, salida 1, y dejó todos los conteos de limpieza en cero. Terminar
con SIGKILL únicamente el worker del probe dejó **1 Ramo, 7 Usuarios, 31
Completaciones, 1 simulación y 1 archivo subido**. La siguiente invocación normal
pasó **2 casos**, salida 0, y el `globalSetup` eliminó esos residuos sin limpieza
manual. Los probes se retiraron antes de ejecutar la suite completa.

Finalmente, `pnpm test` terminó con salida 0: tipos aprobados, **58 archivos y
305 pruebas unitarias aprobadas**, y **138 E2E aprobadas, cero fallos y cero
omisiones**, en **19.1m** para E2E. Se mantuvo la configuración provisional
de un worker. La auditoría posterior volvió a devolver cero en todos los
conteos. ESLint no encontró errores y conserva una advertencia previa por la
espera fija de una animación en layout; Prettier y `git diff --check` pasaron.
`graphify update .` actualizó el grafo AST.

## Paralelismo y mediciones de #168 — 2026-10-06

La configuración ordinaria usa **dos workers** y `fullyParallel: true` en
Chromium y Firefox; conserva `retries: 0`, `maxFailures: 3` y el límite global
de 25 minutos. Los 17 specs usan datos propios por test salvo el spec del
catálogo, que solo lo consulta. La migración a datos propios queda verificada:
las corridas completas de 2, 3 y 4 workers pasaron consecutivamente con **140
aprobados, cero fallos y cero omisiones** cada una, sin limpieza manual.

Se midió en un Apple A18 Pro de 6 núcleos y 8 GiB, con Node 26.10.0,
pnpm 12.6.0 y PostgreSQL 18.6 local. Los tiempos incluyen migraciones, reset,
build cacheado, arranque, tests y cierre del servidor. Las invocaciones fueron
secuenciales. El estado medido incluye la retirada autorizada del agrupador
de 60 segundos y entrega inmediata de cada repetición; no se compara ese cambio
con las esperas de 19,1 minutos de #166 como si toda la mejora fuera paralelismo.

| Workers | Duración | CPU media / pico (% de un núcleo) | RSS máximo (MiB) | Conexiones PostgreSQL total / E2E | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 (control) | 174,82 s | 140,8 / 329,7 | 1900,1 | 17 / 17 | 140 aprobados |
| 2 | 143,53 s | 239,2 / 414,3 | 2026,1 | 19 / 19 | 140 aprobados |
| 3 | 136,41 s | 292,3 / 449,9 | 3133,5 | 20 / 20 | 140 aprobados |
| 4 | 148,31 s | 308,0 / 470,9 | 3965,0 | 22 / 22 | 140 aprobados |

Se elige **2**: subir a 3 ahorra `(143,53 - 136,41) / 143,53 = 4,96 %`,
inferior al umbral aproximado del 10 %. Con 4 se tarda más que con 2 o 3 y
se consume más memoria. Son mediciones locales de una corrida por candidato,
no una estimación estadística ni un presupuesto certificado para otra máquina.

El script [measure-e2e.mjs](../../scripts/measure-e2e.mjs) escribe un `.log` y
un `.json` con muestras y resumen. Muestrea aproximadamente cada segundo:
suma `%CPU` y RSS del árbol de procesos de `pnpm`, incluido Next y navegadores,
y cuenta los client backends de PostgreSQL sin su conexión de observación.
`%CPU` es el valor de `ps`, con su promedio temporal propio; no es CPU
instantánea. RSS suma procesos y puede contar memoria compartida más de una vez;
no mide RAM física del sistema ni incluye el servicio PostgreSQL. Los máximos
son máximos observados entre muestras, no picos continuos. Una muestra fallida
se registra y hace fallar la medición, sin abandonar el runner. Se conservaron
los [resúmenes de evidencia](../measurements/issue-168.json).

Para repetir las mediciones, ejecutar estos comandos consecutivamente (en macOS,
`caffeinate -i` evita suspensión por inactividad; puede omitirse si no aplica):

```sh
caffeinate -i node scripts/measure-e2e.mjs 2 /tmp/e2e-workers2
caffeinate -i node scripts/measure-e2e.mjs 3 /tmp/e2e-workers3
caffeinate -i node scripts/measure-e2e.mjs 4 /tmp/e2e-workers4
```

El script también exige `DATABASE_URL` local de `roadmap_dev_db` para comprobar
la huella antes y después: MD5 por tabla de sus filas JSONB ordenadas, agregado
por nombre de tabla, dentro de una instantánea repeatable read. En las cuatro
mediciones de workers la huella fue `bae937b922d7fa123f1dc01ae609abd0`, sin
cambios dentro de cada invocación. Las validaciones posteriores comparan su
propia huella de entrada, porque desarrollo puede cambiar entre invocaciones. Los
conteos posteriores de Ramos `E2E-*`, Usuarios `@e2e.u-roadmaps.test` y triggers
de rechazo E2E fueron **0 / 0 / 0**. El trigger permanente `own_inbox_changed`,
instalado por la migración `20261003000000_own_notification_sse`, permanece:
es parte del transporte SSE de producción, no un residuo de pruebas.

Para reproducir un solo caso con un worker:

```sh
pnpm test:e2e tests/e2e/own-node-notifications.spec.ts --project=firefox --workers=1 --grep 'content notices follow'
```

La validación inicial detectó dos supuestos de tiempo: `seen` podía cambiar al
mostrar una fila, y los avisos de acceso por Dependencias llegaban después de
la respuesta HTTP. El spec ahora conserva la comparación de contenido e
identidad, y espera la entrega antes de capturar su baseline. Los dos casos
pasaron 12 ejecuciones repetidas entre ambos navegadores. El antiguo recorrido
omitido de resumen temporal se adaptó a entrega inmediata, llegada posterior a
una apertura y reintento del reconocimiento anterior; pasó en ambos navegadores
sin omisiones. Un ensayo de 3 workers se descartó por timeout de la observación
SQL; no se cuenta como medición aprobada ni justifica aumentar límites de tests.

El control con un worker sobre el mismo código pasó los 140 casos, sin
omisiones, en **174,82 s**. Dos workers reducen esa duración en **17,90 %**
(31,29 s). El control se ejecutó después de los candidatos 2, 3 y 4; todos
usaron preparación y build cacheado, sin limpieza manual entre invocaciones.

La revisión única de #168 encontró **3 sugerencias de Standards y 2 hallazgos
de Spec**, todos resueltos: módulos renombrados `notice-delivery.ts` y
`notice-effect.ts`, lookup de Usuario del catálogo centralizado con error
explícito, títulos y comentario de tests actualizados, navegación con identidad
normalizada trasladada del catálogo a un Curso propio, y explicación vigente del
límite global corregida. Las mediciones anteriores preceden esta última
corrección de datos del test de navegación; los recorridos y número de casos
se conservan. La validación final del estado revisado se registra a continuación.

La comprobación adicional de catálogo compara la cantidad y la huella de
`NoticeAcknowledgement` de los Usuarios sembrados antes y después de cada
validación. No exige borrar sus 826 filas históricas: la garantía de solo lectura
consiste en conservarlas sin crear ni modificar ninguna. La comprobación inicial
que exigía cero filas históricas se corrigió; esa invocación tuvo 140 tests
aprobados pero no se cuenta como una validación del wrapper con salida 0.

La primera invocación agregada posterior a la revisión pasó tipos y **302
unitarios**, pero E2E terminó con **139 aprobados y un fallo** en Firefox:
el recorrido SSE no observó su error transitorio de proyección. La traza mostró
un 503 seguido por un 200 del mismo contexto 124 ms después. El fallo HTTP se
mantiene ahora hasta observar el error y el detalle conservado, se retira, y se
comprueba la recuperación automática. Se retiró el evento `online` sintético:
la edición docente produce la señal SSE real. No se ampliaron timeouts ni se
activaron reintentos del runner. Esa corrida fallida no cuenta como aceptación.

El recorrido SSE corregido pasó **10 ejecuciones repetidas** (5 por navegador)
con dos workers, salida 0. La primera aceptación completa del código final,
después de incorporar `bd3d939` del remoto, pasó **140 E2E**, sin fallos ni
omisiones, en **159,75 s**, salida 0. Los conteos de limpieza volvieron a cero;
la huella de desarrollo `1ac558d2cb366285e2bdef5529079188` y las 826 filas de
reconocimiento históricas del catálogo (huella
`9de8e5a3ddd91c4136db4e829a216321`) quedaron iguales antes y después.

## Resultado final de #168

`pnpm test` completo terminó con **salida 0**: tipos aprobados, **58 archivos
y 302 pruebas unitarias aprobadas**, y **140 E2E aprobadas, cero fallos y cero
omisiones**, en **2,8 minutos** para E2E. Es la segunda corrida completa
consecutiva del código final con dos workers, después de los 140 aprobados en
159,75 s; no hubo limpieza manual entre ambas. La auditoría posterior conservó
la huella de desarrollo y la cantidad y huella de reconocimientos del catálogo,
y devolvió cero Ramos y Usuarios E2E y cero triggers de rechazo.

ESLint de todo el código modificado pasó sin errores, con cuatro advertencias
preexistentes por condicionales de `roadmaps.spec.ts`; Prettier y
`git diff --check` pasaron. `graphify update .` actualizó el grafo AST sin
llamadas externas. Se usó `code-review` una sola vez y se aplicaron todas sus
cinco sugerencias. ADR-0014 sigue pendiente: el commit incluye su documentación
y la entrega inmediata transitoria autorizada, no su rediseño completo.

## Validación de #191 del 2026-10-08

Se ejecutó `code-review` una sola vez sobre el trabajo desde `8d3cd9a`.

### Standards

Sin hallazgos accionables. Se conserva el aislamiento por test de ADR-0013 y
la composición entre features mediante un adaptador de aplicación.

### Spec

Sin hallazgos accionables. El usuario excluyó explícitamente la implementación
nueva de Student progress tracking, que este estado del repositorio todavía no
incluye. La corrección conserva Completions reales pero la proyección docente
las ignora; retira avisos de acceso del antiguo rol estudiante y reinicia esos
baselines, conservando avisos de contenido de colegas.

Hallazgos: cero de Standards y cero de Spec. Después de la revisión, una prueba
HTTP adicional reprodujo la degradación del rol docente ante una respuesta
institucional parcial; se corrigió preservando el rol local y evitando la
materialización desde datos incompletos. No se ejecutó otra revisión.

`pnpm test` completo pasó con salida 0: tipos, **71 archivos y 388 pruebas
unitarias aprobadas** en **24,95 s**, y **130 E2E aprobados** en **1,4 minutos**,
sin fallos ni omisiones. E2E usa Chromium, el único proyecto configurado en este
estado de la rama, y PostgreSQL local real. Incluye cargos docentes, creación
exclusiva de cátedra, indisponibilidad institucional completa y parcial,
corrección por entrada y sincronización personal, avisos pendientes, Canvas
preview, rechazo de Completion real para docentes, observador y catálogo MA1001.
ESLint terminó sin errores; conserva cuatro advertencias anteriores en
`roadmaps.spec.ts`. Prettier de los archivos modificados también pasó.

## Validación de #187 del 2026-10-08

Se ejecutó `code-review` una sola vez contra `8a54851` y se aplicaron sus dos
sugerencias: materializar el cargo confirmado antes de rechazar una creación y
conservar los Cursos locales ausentes en una respuesta institucional parcial.
Ambos defectos se reprodujeron por HTTP antes de corregirse.

El comando agregado `pnpm test` terminó con salida 0: tipos aprobados,
**72 archivos y 459 pruebas unitarias aprobadas**, y **139 pruebas E2E aprobadas**
en **1,4 minutos**, sin fallos ni omisiones. La configuración de Playwright en
esta revisión contiene únicamente Chromium; esta evidencia no incluye Firefox.
ESLint y Prettier de todos los archivos modificados también pasaron.

La cobertura incluye cargos guardados, creación sin U-Campus, rechazo de cargo
nulo y de profesor coordinador, actualización y preservación del cargo en
sincronizaciones, despromoción antes de un rechazo de creación, edición del
ayudante sin U-Campus, Cursos retenidos ante respuestas parciales, backfill de
Participations anteriores y los cargos declarados por todo el catálogo local.

## Validación de #192 del 2026-10-08

El cierre del Roadmap se valida con nueve pruebas unitarias de resolución de
fecha e instante chileno, incluidas ambas transiciones de horario de verano, y
cinco recorridos de `roadmap-closure.spec.ts`. Los recorridos comprueban el cierre
silencioso, la conservación de avisos pendientes, ambos respaldos sin fila de
Academic term, idempotencia, acceso estudiantil, rechazo de Completions y
previsualización histórica. Un trigger propio del test rechaza el registro del
cierre: se espera su intento con polling, se verifica que los Teacher blocks y
Scheduled unlocks siguen intactos, y se retira para comprobar la recuperación.

`createTerm()` reserva años **1000–1999**, con hasta 99 términos por worker y
identidades distintas entre workers. La fecha inicial mantiene el término abierto;
`setFreezeDate(day)` permite hacerlo vencer y `setFreezeDate(null)` elimina la
fila para probar el respaldo. `waitForClosure()` usa `expect.poll`, sin pausas
fijas. El servidor usa `ROADMAP_CLOSURE_INTERVAL_MS=1000`; en producción el
intervalo por defecto es cinco minutos. El teardown y la limpieza de huérfanos
retiran estos términos y los triggers de fallo junto con los datos propios.

Se ejecutó `code-review` **una sola vez** desde `2f5bc9f`: Standards encontró una
sugerencia de duplicación del ciclo periódico; se aplicó mediante
`startPeriodicPass`, compartido por cierre y Scheduled unlock release. Spec no
encontró hallazgos. La protección general de las mutaciones docentes pertenece
al issue #193.

La suite completa `pnpm test` posterior a la revisión terminó con salida 0:
tipos aprobados, **73 archivos / 468 pruebas unitarias** y **144 E2E en Chromium**,
sin fallos ni omisiones, en **1,5 minutos** para E2E. También pasaron ESLint sobre
el código modificado, Prettier y `git diff --check`. `graphify update .` actualizó
el grafo AST sin llamadas externas.
La auditoría posterior encontró **0 Cursos E2E, 0 Usuarios E2E, 0 términos
sintéticos y 0 triggers de rechazo**.
