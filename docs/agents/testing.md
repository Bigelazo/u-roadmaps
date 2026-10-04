# Pruebas para agentes

## Estado actual

La configuración E2E está en [playwright.config.ts](../../playwright.config.ts).
Usa Chromium y Firefox, un worker provisional y ningún reintento automático.
La migración a datos propios por test del
[ADR-0013](../adr/0013-enable-parallel-e2e-tests.md) está en curso: solo
`own-notifications.spec.ts` y `roadmaps.spec.ts` están migrados; los demás specs
todavía comparten el catálogo sembrado y requieren el worker único.

Validación de `roadmaps.spec.ts` del **2026-10-04**, con Chromium y Firefox:
`--workers=3 --fully-parallel --repeat-each=5` terminó con **210 aprobados**, sin
fallos ni omisiones, en **5,2 minutos** y código de salida 0; cada uno de sus 21
casos también pasó por separado con `--grep`. Después no quedaron Ramos `E2E-*`,
Usuarios del dominio reservado, triggers de fallo ni archivos subidos huérfanos.

La última validación, del **2026-10-02**, ejecutó los **80 casos ajenos a
notificaciones**: todos pasaron en **1,5 minutos**, con código de salida 0.
Notificaciones quedó fuera de esa revisión por indicación del usuario. Sus tests
siguen incluidos en `pnpm test:e2e`; no se añadieron omisiones permanentes.

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
  creará en ese Curso.
- `apiAs(usuario)`: un cliente de API autenticado como ese Usuario, que se cierra
  al terminar el test.

Todo se elimina al terminar el test, también si falla, incluidos los archivos
subidos a sus Roadmaps. Los Ramos usan el prefijo `E2E-` y los Usuarios el
dominio `@e2e.u-roadmaps.test`; el `globalSetup` usa esas marcas para limpiar
huérfanos y nunca toca el catálogo sembrado.

Las consultas SQL usan el único helper `psql` de
[tests/e2e/database.ts](../../tests/e2e/database.ts), con la misma validación de
base local. El cliente Prisma generado no carga dentro de Playwright (issue #164),
por lo que se aplicó el plan B del ADR. Los specs de avisos aún no migrados
conservan sus propias copias de `psql`.

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

Revisión sin notificaciones, correspondiente al último alcance validado:

```sh
pnpm test:e2e --grep-invert 'own-.*notifications|roadmap-(novu-websocket|realtime-prototype)'
```

El filtro excluye los tres archivos de avisos y los dos de señales Novu.

Reproducción de un caso en un navegador:

```sh
pnpm test:e2e tests/e2e/development-fixture.spec.ts --project=firefox --grep 'normalized Course offering'
```

La suite se detiene tras tres fallos. Para recoger todos los fallos en una
auditoría explícita, usar `pnpm test:e2e --max-failures=0`. Los casos que no llegaron
a ejecutarse no cuentan como pruebas aprobadas.

El test real de WebSocket de Novu es optativo: requiere `RUN_NOVU_REALTIME=1` y
credenciales de un entorno de prueba. Sin esa activación se omite una vez por
navegador. Esto es independiente del filtro temporal de notificaciones anterior.

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
| Suite completa                                   | 15 min                                                             |
| Cierre del servidor con SIGTERM                  | 5 s antes del cierre forzado                                       |

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

Con los límites actuales, la comprobación vigente es **80 passed en 1,5 minutos**
sin notificaciones. El build incluyó comprobación de tipos; ESLint y Prettier de
la configuración también pasaron. Al informar resultados, indicar selección,
navegadores, aprobados, fallidos, omitidos, duración y código de salida.

## Suite unitaria y comando agregado

`pnpm test:unit` ejecuta Vitest. Actualmente
[vitest.config.mts](../../vitest.config.mts) referencia `vitest.setup.ts`, que fue
eliminado: la ejecución estándar falla antes de cargar los tests. Este bloqueo
está pendiente y es independiente de la recuperación E2E.

`pnpm test` ejecuta tipos, unitarios y E2E en secuencia; por ese bloqueo **no se
considera validado**. Usar `pnpm test:e2e` para la comprobación E2E y
`pnpm typecheck` para comprobar tipos. Una ejecución puntual de tests unitarios
sin setup no demuestra que la suite unitaria completa funcione.
