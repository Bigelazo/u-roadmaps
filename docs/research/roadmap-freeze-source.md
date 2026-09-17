# Fuente programable del congelamiento de Roadmaps

**Fecha de revisión:** 2026-09-17  
**Alcance:** estado ejecutable del cierre definido por ADR-0001 y ADR-0007, datos disponibles, cobertura de pruebas y señal que podría iniciar el futuro aviso previo. Esta nota no implementa el congelamiento ni su notificación.

## Conclusión

El ciclo está **parcialmente implementado**. U-Roadmaps ya obtiene y persiste una fecha oficial por Período académico, deriva de ella si un Roadmap es histórico y bloquea algunas operaciones. No existe, sin embargo, una transición de cierre que se ejecute en esa fecha, quite atómicamente todos los Bloqueos docentes y haga cumplir la inmutabilidad en todas las mutaciones del servidor.

La fuente programable disponible para el aviso es `AcademicTerm.roadmapFreezeDate`, no el cron de sincronización ni un estado del Roadmap. A partir de ella puede derivarse `noticeAt = roadmapFreezeDate - anticipación`. Hoy no se emite ningún evento al acercarse esa fecha. El mecanismo que consuma la señal —programación tras sincronizar o consulta periódica— y su política de reprogramación pertenecen al ticket de decisión posterior.

## Qué existe hoy

### Fuente y datos verificados

- ADR-0001 adopta el calendario oficial de FCFM y fija `roadmapFreezeDate` en el último día de exámenes. También prescribe conservar el último dato verificado si la fuente falla ([ADR-0001](../adr/0001-freeze-roadmaps-from-academic-calendar.md#L5-L9)).
- `AcademicTerm` persiste año, semestre, último día de clases, inicio y fin de exámenes, fecha de congelamiento, URLs de procedencia y `syncedAt`; su identidad es `(year, semester)` ([schema Prisma](../../prisma/schema.prisma#L41-L56), [migración](../../prisma/migrations/20260906000000_add_academic_terms/migration.sql#L1-L13)). No hay un `status` o `frozenAt` en `Roadmap`, ni una relación Prisma directa desde el Curso al Período académico: el cruce se hace por año y semestre ([CourseOffering y Roadmap](../../prisma/schema.prisma#L17-L39)).
- La integración selecciona el PDF dentro de la sección rotulada del semestre, exige el dominio HTTPS oficial, limita el PDF a 15 MB y extrae la primera ocurrencia del calendario principal, no un período de verano anexado ([selección y validación](../../src/integrations/academic-calendar/server.ts#L53-L94), [extracción](../../src/integrations/academic-calendar/server.ts#L118-L148), [descarga](../../src/integrations/academic-calendar/server.ts#L160-L191)).
- El script elige el semestre con la fecha de `America/Santiago`, admite `--dry-run` y hace `upsert` solo después de obtener correctamente la fuente. Convierte las fechas a `Date` y actualiza también las URLs de procedencia ([script de sincronización](../../scripts/sync-academic-calendar.ts#L5-L58)).
- Las pruebas verifican selección del PDF, exclusión del verano y conservación de las URLs oficiales; no ejercitan el script, el cron ni una transición de cierre ([pruebas del calendario](../../tests/integrations/academic-calendar/server.test.ts#L15-L59)).

### Scheduling y ejecución disponibles

Existe un workflow activo de GitHub Actions con dos entradas:

- cron el 15 de abril y el 15 de octubre a las 14:00 UTC;
- ejecución manual mediante `workflow_dispatch`.

El job instala dependencias, genera Prisma y ejecuta únicamente `pnpm sync:academic-calendar` contra el secreto `DATABASE_URL` del environment `production` ([workflow](../../.github/workflows/sync-academic-calendar.yml#L1-L26), [script de paquete](../../package.json#L18-L25)). La consulta `gh workflow list --all` confirmó que GitHub lo reconoce como `active`, pero `gh run list --workflow sync-academic-calendar.yml` devolvió cero ejecuciones el 2026-09-17. Por tanto, existe capacidad de scheduling y despacho manual, pero el historial de Actions no demuestra todavía una sincronización exitosa ni permite verificar los secretos de producción.

### Efecto actual de cruzar la fecha

- La página consulta `AcademicTerm` en cada request y clasifica la experiencia como histórica cuando `roadmapFreezeDate <= Date.now()` ([CoursePage](../../src/app/courses/[courseCode]/[year]/[semester]/page.tsx#L27-L51)).
- El modo histórico elimina las capacidades de edición de la interfaz docente y de reinicio de la previsualización ([modo del Canvas](../../src/features/roadmap/canvas/mode.ts#L24-L43)); las pruebas cubren ese comportamiento visual y de sesión ([prueba de modo](../../tests/features/roadmap/canvas/mode.test.ts#L23-L50), [prueba de sesión](../../tests/features/roadmap/session/RoadmapCanvasSession.test.tsx#L427-L450)).
- El servidor rechaza después de la fecha la Completación estudiantil y las mutaciones de la Previsualización del canvas mediante `requireCurrentRoadmap` ([guard temporal](../../src/features/roadmap/application/completion.ts#L101-L114), [uso transaccional](../../src/features/roadmap/application/completion.ts#L160-L199), [simulación](../../src/features/roadmap/application/completion.ts#L224-L264)).

Este comportamiento es una **derivación temporal en lectura/escritura**, no una transición persistida del Roadmap.

## Transición pendiente

El lenguaje de dominio exige que el cierre por calendario quite todos los Bloqueos docentes y luego congele la versión, preservando los Nodos ocultos ([Roadmap](../../CONTEXT.md#L47-L49), [Bloqueo docente](../../CONTEXT.md#L103-L105)). ADR-0007 mantiene esa capacidad como trabajo futuro y exige una transición atómica más autorización server-side ([ADR-0007](../adr/0007-complete-role-aware-roadmap-lifecycle.md#L5-L11)).

Actualmente no existe:

1. un job que corra al llegar `roadmapFreezeDate`;
2. una operación que quite `isTeacherBlocked` a todos los Nodos de los Roadmaps del Período académico;
3. un estado persistido que pruebe que la transición ocurrió;
4. un evento de dominio o callback de «Roadmap por congelarse» o «Roadmap congelado»;
5. un guard temporal común a todas las mutaciones editoriales.

El último punto es una brecha efectiva: `requireEditorRoadmap` solo valida que exista el Roadmap y que la Participación docente esté activa ([editor-access](../../src/features/roadmap/application/editor-access.ts#L9-L44)). Las escrituras de Nodos, Dependencias, Tipos de nodo y Recursos usan ese guard sin consultar `AcademicTerm` (por ejemplo, [editor](../../src/features/roadmap/application/editor.ts#L164-L269) y [recursos](../../src/features/roadmap/application/resources/commands.ts#L31-L125)). La UI queda de solo lectura, pero una llamada directa a esas APIs todavía puede modificar un Roadmap histórico. Tampoco hay pruebas que contengan `ROADMAP_FROZEN` o prueben el rechazo de esas mutaciones después de la fecha.

## Estado de los datos de desarrollo

Una consulta read-only a PostgreSQL local el 2026-09-17 devolvió:

- `AcademicTerm`: **0 filas**;
- `CourseOffering`: **4 filas** — una de 2026/1 y tres de 2026/2.

Esto concuerda con el reset de desarrollo: crea Cursos, Cursos ofrecidos, Participaciones, Roadmaps y su contenido, pero no crea Períodos académicos ([reset de datos](../../src/development/server/data.ts#L55-L159)). En este entorno ningún Roadmap puede volverse histórico por calendario. El resultado local no permite inferir las filas existentes en producción.

## Señal disponible para el aviso previo

La señal autoritativa ya modelada es la fecha verificada del Período académico:

```text
noticeAt = AcademicTerm.roadmapFreezeDate - anticipación acordada
destinatarios = Participations activas de CourseOfferings(year, semester) con Roadmap
```

La presencia del Roadmap puede resolverse a través de `CourseOffering.roadmap`, y las Participaciones activas ya están persistidas en el mismo agregado de Curso ([relaciones](../../prisma/schema.prisma#L17-L39), [Participación](../../prisma/schema.prisma#L140-L153)). Las URLs de procedencia y `syncedAt` hacen auditable la fecha que originó el cálculo.

Hay dos lugares técnicamente posibles para convertirla en una ejecución:

1. **Después del `upsert` exitoso:** programar el aviso para `noticeAt`. Aprovecha la sincronización ya existente, pero necesita semántica de reemplazo o cancelación si cambia la fecha y debe comprobar que Novu admite el horizonte requerido.
2. **Mediante un job periódico nuevo:** consultar Períodos académicos cuyo `noticeAt` acaba de vencer y disparar el aviso. Es fácil de inspeccionar y reejecutar con GitHub Actions, pero necesita una garantía de idempotencia para no repetir entregas.

Ninguna opción existe hoy. El cron actual solo actualiza la fuente dos veces al año; no observa diariamente la proximidad de la fecha ni ejecuta el cierre. La decisión de anticipación, repetición, corrección/cancelación y elegibilidad exacta debe fijarse antes de escoger entre ambas.

## Incertidumbres que quedan abiertas

- La hora y zona del corte no están definidas. El modelo usa `@db.Date`, el script construye inicialmente mediodía UTC y las comparaciones usan el `Date` devuelto por Prisma contra `Date.now()`; ADR-0001 solo define el día.
- No está especificado si el cierre ocurre al comenzar o al terminar `roadmapFreezeDate`.
- No está definido cómo reprogramar o cancelar un aviso cuando una sincronización posterior cambia la fecha oficial.
- Falta decidir si el aviso se agenda solo para Cursos con Roadmap ya creado y qué ocurre si el Roadmap se crea después de programarlo.
- No existe evidencia de una ejecución exitosa del workflow en GitHub Actions ni acceso desde esta investigación para verificar datos o secretos de producción.

## Verificaciones reproducibles

- Grafo: `graphify query "¿Cuál es el estado real del ciclo de congelamiento basado en el calendario académico, qué datos y procesos existen hoy, qué transición sigue pendiente y qué señal programable podría iniciar un aviso previo?"`.
- Código y pruebas: búsquedas de `AcademicTerm`, `roadmapFreezeDate`, `ROADMAP_FROZEN`, `schedule`, `workflow_dispatch` e `isTeacherBlocked` en `prisma/`, `src/`, `scripts/`, `tests/`, `.github/` y `docs/adr/`.
- GitHub Actions: `gh workflow list --all`, `gh workflow view sync-academic-calendar.yml --yaml` y `gh run list --workflow sync-academic-calendar.yml`.
- PostgreSQL local: consulta read-only de `AcademicTerm.findMany()` y `CourseOffering.groupBy({ by: ['year', 'semester'] })` usando `.env.development`.
