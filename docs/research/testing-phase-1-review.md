# Revisión de etapa 1: contratos HTTP

2026-11-05. Revisión estática del checkout y fuentes primarias. No se ejecutaron
pruebas ni se modificaron código o configuración; no hay prueba de funcionamiento
en runtime. Los rangos de líneas son estimaciones de implementación, no mediciones.

## Recomendación

**Mantener la etapa, reducir su alcance y quitar la extracción de Prisma como
prerrequisito.** La reparación HTTP tiene prioridad: los tests actuales reemplazan
precisamente el normalizador cuya respuesta deben verificar. Primero corregir ese
recorrido, después decidir por separado si desacoplar errores del cliente DB aporta
suficiente valor de producción.

| Propuesta | Decisión | Evidencia y ajuste |
| --- | --- | --- |
| Normalizador y serializador reales | Mantener | `src/shared/errors/server.ts:10` normaliza y `src/app/_adapters/http.ts:23` compone. `tests/app/api/dependency-notifications.test.ts:30` sustituye la composición por éxito solamente; `:95` espera rechazo de un error común. Eso no representa la respuesta pública 500. |
| Namespace Prisma nuevo en producción | Quitar de la entrega mínima | `src/shared/server/db/index.ts:7` ya exporta Prisma, pero `:12` exige URL y `:22` construye cliente. El aislamiento de módulo de Vitest permite sustituir ese módulo por valores de runtime reales sin inicializarlo. No hace falta cambiar producción para probar HTTP. |
| Constructor real de Prisma | Mantener, obligatorio | `src/shared/errors/server.ts:13` usa `instanceof`; `src/generated/prisma/internal/prismaNamespace.ts:32` es un alias exacto de `runtime.PrismaClientKnownRequestError`. Un `{ Prisma: {} }` ni siquiera permite esa comparación para errores no tipados. |
| Matriz una vez en adaptador | Mantener | `tests/app/_adapters/http.test.ts:32` prueba serialización aislada; falta ejecutar `handleApplicationResult`. Probar códigos Prisma y saneamiento aquí; por familia solo cableado tipado/inesperado. |
| Matriz completa de validación por familia | Reducir | Parser, auth e identidad académica están centralizados en `src/app/_adapters/http.ts:64`. Probar cada política compartida una vez y solo diferencias de ruta. Recursos parsea JSON dentro del handler, además de multipart; conservar ese caso específico. |
| Conteos HTTP con mock público | Mantener con corrección explícita | `src/app/api/notifications/counts/route.ts:3` y `node-changes/route.ts:3` delegan validación y dominio. Un mock de feature prueba identidad, entradas y propagación; ya no demuestra validación real de UUID ni participación activa. |
| Request multipart real | Mantener | `tests/app/api/resources-notifications.test.ts:55` fabrica un objeto convertido a Request. `src/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/resources/route.ts:16` ejecuta `request.formData()`: usar FormData/File reales y comprobar archivo entregado. |

## Alternativas para Prisma

La alternativa mínima es un mock local del módulo DB que devuelva
`Prisma: { PrismaClientKnownRequestError: runtime.PrismaClientKnownRequestError }`,
cargando `@prisma/client/runtime/client`. Es la forma mínima para el normalizador;
no tratar runtime como namespace Prisma completo: exporta `sqltag`, mientras el
namespace generado lo expone como `sql` (`prismaNamespace.ts:50`). Si otra
dependencia real necesita SQL, mapear explícitamente `sql: runtime.sqltag`,
`join: runtime.join` y `empty: runtime.empty`; no añadirlos preventivamente.
Usar el mismo constructor
real para crear las excepciones de la matriz. No usar `importOriginal` del módulo DB:
ejecutaría la inicialización que se intenta aislar. No introducir un helper universal
por cinco líneas repetidas; un pequeño helper solo se justifica si reduce repetición
real y respeta hoisting. El repositorio ya importa ese runtime en
`tests/app/api/notification-counts.test.ts:16`; la restricción de imports generados
(`eslint.config.mts:262`) no obliga a modificar producción para esta alternativa.

Esto sí sustituye el adaptador DB, pero conserva el constructor usado en la rama
`instanceof`. No acredita integración con el cliente generado. La identidad del alias
está documentada por el archivo generado actual; no se propone importar ese archivo
interno, que lo prohíbe expresamente en sus líneas 7–12.

Si se desea una mejora de producción independiente, el módulo
`shared/server/db/prisma.ts` propuesto es pequeño y razonable: exportar desde el
`client.ts` público, mantener compatibilidad en index y cambiar únicamente el import
del normalizador. Su mérito es traducir errores sin exigir URL, no habilitar estos
tests. Validar importación sin URL en proceso separado, además de lint/tipos. No
cambiar el contrato a comparación por propiedades para evitar `instanceof`.

## Alcance mejorado, por prioridad

1. Retirar los cuatro mocks de `applicationResult` y sus namespaces vacíos;
   mantener dobles de auth y feature. Corregir rechazos esperados de dependencia,
   recursos y bloqueo docente a respuestas HTTP públicas. Añadir fallo tipado e
   inesperado donde falte, con log esperado interceptado y restaurado.
2. Extender `http.test.ts` con tabla Prisma P2025/P2003/P2002/P2034/desconocido,
   ApplicationError con detalles, error común y valor no Error, throw síncrono y
   rechazo async; éxito conserva Response/status/headers. Exigir JSON exacto para
   el 500, para detectar filtración de mensaje/stack/SQL. Un redirect real debe
   seguir rechazando, sin transformarse en JSON 500.
3. Probar auth/identidad/body compartidos una vez con inputs válidos en las otras
   dimensiones. Mantener una ruta concreta por política y el parser multipart de
   recursos. Preservar 201 y 204 sin cuerpo existentes.
4. Reescribir conteos con mocks de `countOwnNotices`,
   `countOwnNodeChangeTargets` y `reviewOwnNode`. Afirmar user.id real de sesión,
   query/body recibidos, serialización y errores tipados/inesperados. El mock actual de `readParticipantAccess` (`notification-counts.test.ts:19`)
   tampoco demuestra acceso real y debe desaparecer de este test HTTP. Los casos de
   validación UUID y reglas de acceso retirados de HTTP deben quedar vinculados a
   pruebas reales de feature/PostgreSQL antes de eliminarlos. No simular validación
   en el mock y luego presentarla como garantía del dominio.
5. Cierre posterior: ejecución con locks según guía, importación sin DB, checks
   afectados y una alteración 409/500 o saneamiento que falle por aserción. Un mock
   de `after` solo acredita coordinación; servidor/transporte quedan en E2E existente.

## Balance estimado de líneas físicas

Incluye líneas vacías, comentarios e imports; excluye esta nota y graphify. Los
reemplazos cuentan tanto como agregadas como eliminadas. Baseline inspeccionado:
seis archivos HTTP, 644 líneas en total.

| Variante | Producción + / − | Pruebas + / − | Configuración + / − | Neto estimado |
| --- | --- | --- | --- | --- |
| Recomendada, DB mock con constructor real | 0 / 0 | 220–340 / 100–160 | 0 / 0 | +60 a +240 |
| Misma entrega con extracción opcional | 6–10 / 2–3 | 230–360 / 100–160 | 0 / 0 | +73 a +268 |

La versión opcional agrega smoke de importación sin URL. La anotación por archivo
`@vitest-environment node`, cuando el runtime lo requiera, cuenta como prueba; no
requiere proyecto nuevo. No se estima un ahorro neto: reemplazar dobles engañosos
por contratos explícitos suele sumar casos. Reducir duplicación de matrices aporta
más que perseguir un número de líneas objetivo.

## Fuentes primarias

- [Prisma: manejo de excepciones](https://www.prisma.io/docs/orm/v6/prisma-client/debugging-and-troubleshooting/handling-exceptions-and-errors): patrón oficial `instanceof` con namespace Prisma; el alias exacto de esta versión se verificó en el generado local, no se deduce de la guía v6.
- [Prisma: referencia de errores](https://docs.prisma.io/docs/orm/reference/error-reference): distingue errores conocidos y sus códigos. El mapeo HTTP 404/409/500 es política local del repositorio.
- [Vitest: módulos sustituidos](https://vitest.dev/guide/mocking/modules): reemplazo de módulo mediante factory. Fundamenta aislar inicialización sin reemplazar normalización; la viabilidad exacta queda pendiente de ejecución.
- [Next.js: unstable_rethrow](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow): preserva excepciones internas de control de flujo. Mantener un caso real, sin fabricar un error con nombre parecido.
