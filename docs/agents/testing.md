# Pruebas para agentes

## Preparación y comandos

Usar el servicio PostgreSQL local existente y configurar `.env` desde
[.env.example](../../.env.example). Las bases de pruebas tienen destinos
independientes de desarrollo:

- `E2E_DATABASE_URL`: `roadmap_e2e_db` para Playwright.
- `NOTIFICATIONS_DATABASE_URL`: `roadmap_notifications_test_db` para el harness
  de notificaciones y los tests unitarios de operaciones del Roadmap. El rol
  local necesita permiso `CREATEDB`; el harness crea la base si falta.

La validación agregada se ejecuta con:

```sh
pnpm test
```

Los comandos y su orden están definidos en [package.json](../../package.json).
`pnpm test:unit` también contiene pruebas con PostgreSQL real: consultar
[roadmap-change-port.md](../roadmap-change-port.md) para su preparación y adapter.
Para los unitarios que comparan distintos orígenes de NextAuth, cargar el entorno
y retirar el origen fijo:

```sh
pnpm exec dotenv -e .env -- env -u NEXTAUTH_URL pnpm test:unit
```

Para ejecutar solo el harness de notificaciones:

```sh
pnpm test:integration
pnpm test:integration tests/notifications-integration/participation-loss.test.ts
```

Instalar el navegador una vez y ejecutar E2E:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Consultar [playwright.config.ts](../../playwright.config.ts) para los navegadores,
workers, reintentos y límites vigentes. Una selección focalizada no sustituye la
suite completa. Un fallo, timeout o caso sin ejecutar no cuenta como aprobación.
Los [resultados históricos](../testing-validation-history.md) sirven para auditar
aceptaciones y mediciones anteriores, no para decidir cómo ejecutar la suite hoy.
Registrar nuevas validaciones en `docs/issue-<n>-validation.md`, con el commit,
los comandos y sus resultados. Esta guía conserva la preparación y las
convenciones de ejecución; la configuración conserva sus valores vigentes.

## Preparación y aislamiento E2E

Playwright carga `.env` y aplica el entorno de pruebas al runner y sus procesos
hijos. Su `webServer` migra la base E2E, restaura las fixtures del catálogo,
compila Next.js en producción e inicia el servidor; la secuencia exacta está en
[playwright.config.ts](../../playwright.config.ts).

| Recurso          | Desarrollo              | E2E                     |
| ---------------- | ----------------------- | ----------------------- |
| Base PostgreSQL  | `roadmap_dev_db`        | `roadmap_e2e_db`        |
| URL habitual     | `http://localhost:3000` | `http://localhost:3200` |
| Compilación      | `.next`                 | `.next-e2e`             |
| Archivos subidos | `uploads`               | `uploads-e2e`           |

[tests/e2e/database.ts](../../tests/e2e/database.ts) valida el destino local.
Los helpers SQL y el servidor usan la misma base E2E.
[global-setup.ts](../../tests/e2e/global-setup.ts) limpia los datos propios que
haya dejado una ejecución interrumpida. La suite usa autenticación y respuestas
institucionales locales; no necesita VTI, U-Campus ni Novu Cloud disponibles.

Playwright administra y cierra su servidor, sin reutilizar uno existente.
Puede coexistir con desarrollo. Ejecutar las invocaciones E2E consecutivamente:
comparten base, puerto, compilación y fixtures. No iniciar una segunda corrida
mientras la primera siga activa.

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

## Harness de notificaciones con PostgreSQL real

La configuración está en
[vitest.notifications.config.mts](../../vitest.notifications.config.mts).
[global-setup.ts](../../tests/notifications-integration/global-setup.ts) crea la
base dedicada si falta, aplica migraciones y limpia datos huérfanos antes de los
workers. [database.ts](../../tests/notifications-integration/database.ts) rechaza
hosts no locales, otra base y parámetros que sobrescriban el destino. Nunca usa
las bases de desarrollo o E2E ni inicia o reinicia PostgreSQL.

[fixtures.ts](../../tests/notifications-integration/fixtures.ts) da a cada test
su Ramo, Curso, Roadmap, Nodos, Tipos de nodo, Participations y Usuarios, y limpia
en `finally`, también ante fallos. Los huérfanos se identifican por `NT-` y
`notifications.u-roadmaps.test`, reservados para este harness.

Las invocaciones que usan esta base se ejecutan consecutivamente, incluidas
`pnpm test:unit` y `pnpm test:integration`: la limpieza inicial es global.
Dentro de una invocación, los workers usan datos independientes.

Los tests de notificaciones llaman a sus interfaces públicas y observan
`listOwnNotices`, sin simular Prisma ni inspeccionar filas de avisos. La pérdida
de Participation se provoca con una actualización real y se observa después de
reactivarla, para distinguir retirada de filtrado por acceso. La concurrencia
incluye eventos repetidos y eventos distintos para el mismo Notice target.

Los unitarios registran la limpieza automática del DOM mediante `globals: true`
en [vitest.config.mts](../../vitest.config.mts). Los escenarios de UI que necesitan
un viewport declaran y restauran su `matchMedia`; los contratos HTTP sin consultas
pueden aislar Prisma. La suite unitaria excluye los specs del harness, pero los
tests de operaciones del Roadmap reutilizan sus fixtures y preparación.

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

## Evidencias y diagnóstico

La salida habitual muestra los casos y el resumen, y oculta stdout del servidor.
Para diagnosticar también su preparación, build y avisos guardados:

```sh
DEBUG=pw:webserver pnpm test:e2e
```

stderr permanece visible, incluidos los errores provocados deliberadamente por
pruebas de fallo. Conservar el error exacto, el nombre del caso y la duración, y
localizar la fase: preparación, arranque, ejecución o limpieza. Contrastar la
expectativa con el comportamiento requerido antes de cambiar tests o código.
Un timeout no justifica por sí solo ampliar plazos o añadir reintentos.

- **Prisma `P1001` dentro de un sandbox:** puede deberse a restricciones de acceso
  al PostgreSQL local. Repetir el mismo comando con permisos para PostgreSQL,
  HTTP local y navegadores, registrando el error o rechazo. Conservar el servicio
  existente, sin reiniciarlo como recuperación.
- **Puerto 3200 ocupado o build en curso:** identificar el proceso y comprobar
  si existe otra corrida. Esperar a que termine la invocación propietaria;
  conservar los servidores ajenos.
- **Error de aserción o acción:** reproducir el caso individualmente y revisar
  su traza. Distinguir expectativas desactualizadas, regresiones reales e
  interferencias entre fixtures.

Ejemplo de reproducción focalizada:

```sh
pnpm test:e2e tests/e2e/roadmaps.spec.ts --project=chromium --workers=1 --grep 'normalized Course offering'
```

La configuración habitual limita los fallos. Para recoger todos los casos en
una auditoría explícita, usar `pnpm test:e2e --max-failures=0`.

El reporte HTML queda en `playwright-report/` y las trazas en `test-results/`.
Guardar las evidencias necesarias antes de repetir pruebas: otra invocación
puede reemplazarlas. El runner debe terminar por sí solo con su código de salida.
Los visores siguientes son interactivos y se cierran manualmente:

```sh
pnpm exec playwright show-report
pnpm exec playwright show-trace test-results/<caso>/trace.zip
```

Consultar los límites de runner y navegador en
[playwright.config.ts](../../playwright.config.ts), los de SQL E2E en
[database.ts](../../tests/e2e/database.ts), y los del harness de notificaciones en
su [configuración](../../vitest.notifications.config.mts) y
[cliente SQL](../../tests/notifications-integration/database.ts).
