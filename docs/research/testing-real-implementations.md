# Pruebas que atraviesan implementaciones reales

Diseño revisado el 2026-11-05 tras cuatro investigaciones con subagentes de
razonamiento low, una por fase. Esta revisión sustituye la propuesta inicial.
Estado: investigación y plan; no hay implementación ni suites ejecutadas.
Se inspeccionó el checkout vigente con cambios previos sin commit. Las fuentes
primarias sustentan decisiones de diseño, no prueban que el plan pase en runtime.

## Dictamen

Los tres objetivos de HTTP, composición UI y SQL son adecuados. El alcance inicial
no era la mejor opción en todos sus detalles: incluía una separación de Prisma
innecesaria para los tests, escenarios ya cubiertos y una fase transversal como
entrega independiente. La propuesta revisada es **tres entregas pequeñas, cada
una con sensibilidad comprobada**, y un guardrail HTTP estático incorporado en
la primera. No se prevén cambios de código de aplicación, esquema ni infraestructura.

| Fase original | Dictamen | Mejora elegida |
| --- | --- | --- |
| 1. HTTP | Mantener como primera prioridad | Constructor Prisma real dentro del doble DB; sin extracción obligatoria de producción. Matriz de traducción una vez, políticas compartidas una vez y diferencias específicas por ruta. |
| 2. Composición UI | Mantener con menos escenarios | Fortalecer el reinicio existente y añadir secuencia persistida y fallo/reintento. Conservar ciclo de vida en tests del editor; carrera adicional solo con un hueco demostrado. |
| 3. SQL | Mantener solo casos ausentes | DISTINCT y visibilidad docente ya están probados. Completar límites temporales, revisión selectiva, fallback e identidad/Roadmap con datos discriminantes. |
| 4. Sensibilidad y guardrails | Integrar al cierre de 1–3 | Una alteración semántica por riesgo, fallo de aserción y restauración. Añadir selector HTTP acotado; posponer plataforma de mutación y regla general de bindings. |

Informes independientes con evidencia de archivos/líneas y fuentes:
[HTTP](testing-phase-1-review.md), [UI](testing-phase-2-review.md),
[SQL](testing-phase-3-review.md), [sensibilidad y guardrails](testing-phase-4-review.md).

## Entrega 1: contratos HTTP fieles

Problema confirmado por inspección: cuatro suites de rutas sustituyen
`applicationResult` por un objeto cuyo `match` solo ejecuta éxito. Dependencias y
recursos esperan un rechazo de error común, omitiendo la respuesta pública 500.
`tests/app/_adapters/http.test.ts` prueba piezas separadas, sin recorrer
`handleApplicationResult`.

### Decisiones

- Conservar handler, parser, normalizador, clases de error y serializador reales.
  Controlar identidad y funciones públicas de la feature en sus interfaces.
- Mantener el doble DB solo para evitar inicialización. Devolver su constructor
  real `PrismaClientKnownRequestError`, importado de
  `@prisma/client/runtime/client`: el generado vigente usa exactamente ese alias
  en `src/generated/prisma/internal/prismaNamespace.ts:32`. Un namespace vacío o
  una clase inventada rompe el contrato `instanceof` del normalizador.
- No devolver el runtime como namespace Prisma completo: `sqltag` y `sql` tienen
  nombres diferentes. Exponer únicamente los exports reales que el recorrido usa.
  Este mecanismo ya se utiliza parcialmente en `notification-counts.test.ts`.
- Posponer el módulo `db/prisma.ts` propuesto inicialmente. Desacoplar valores de
  runtime del cliente podría ser una mejora de producción independiente, pero
  no es requisito para probar HTTP. Verificar hoisting y entorno node en un
  piloto antes de migrar las demás suites.

### Alcance y cierre

1. Probar una sola vez la cadena `handleApplicationResult`: éxito, ApplicationError
   con detalles, códigos Prisma P2025/P2003/P2002/P2034/desconocido, error común,
   throw síncrono y rechazo asíncrono, y JSON 500 sin contenido interno.
2. Conservar control de flujo de Next mediante `unstable_rethrow`: redirect real
   no se convierte en error JSON 500. No afirmar que ningún handler puede rechazar.
3. Migrar las cuatro suites: dependencias, recursos, bloqueo docente y tipos de Nodo.
   Cada familia comprueba cableado de error tipado/inesperado y sus diferencias.
   Probar políticas comunes de auth/identidad/body una vez con el resto de inputs
   válidos; conservar éxitos 200/201 y 204 sin cuerpo.
4. Recursos usa Request/FormData/File reales en vez de un objeto convertido con
   cast; comprobar que el archivo se entrega correctamente a la interfaz exterior.
5. Conteos HTTP comprueba identidad de sesión, entradas, salida y traducción con
   feature sustituida. La validación real de UUID y participación pertenece a la
   feature real; vincular esos casos a integración antes de retirar las aserciones
   existentes. Un mock que devuelve 400 no demuestra la regla que genera ese 400.
6. Añadir el guardrail HTTP definido más abajo y comprobar sensibilidad del estado
   y del saneamiento. Luego suites/checks pertinentes con las instrucciones locales.

Límite explícito: llamar al handler no verifica cookies en transporte, resolución
de rutas, proxy, contexto de request o ejecución post-respuesta de `after`. Los
recorridos de servidor existentes siguen siendo su complemento.

## Entrega 2: composición UI con persistencia observable

Extender `tests/features/roadmap/session/canvas-preview-reset.test.tsx`, no convertir
toda la suite de sesión en montajes completos. Editor, detalle estudiantil, paneles,
sesión, comandos y persistencia en memoria son reales. Mantener un selector de
Nodos que represente solo la interfaz del grafo. Activar Strict Mode en este montaje,
sin cambiar globalmente RTL.

- **Reinicio, dos variantes existentes:** completar prerrequisito, seleccionar
  dependiente, observar descripción y enlace no vacíos, reiniciar con diálogo
  real, comprobar ausencia de datos docentes y proyección bloqueada, volver al
  editor y recuperar contenido íntegro. El panel puede cerrarse por diseño;
  no exigir un mensaje dentro de un panel inexistente. El control real se llama
  «Completar», no «Completar Derivadas»: locators por panel activo.
- **Secuencia persistida:** dos títulos y dos enlaces, misma sesión; observar
  actualización canónica, recursos y snapshots de `persistence.load()`, y poder
  empezar otra edición. Upload ya está en editor y browser; no duplicarlo aquí.
- **Fallo/reintento:** rechazar una ejecución antes de mutar, observar toast,
  borrador recuperable, persistencia intacta y botón habilitado; reintentar
  delegando realmente y comprobar persistencia y siguiente acción.

El decorador local mantiene `execute(command, previewVersion)` y su resultado.
Retrasa solo la operación elegida, señala su recepción y delega en el adaptador
real al liberar. Liquidar promesas en finally y restaurar globals/spies por test.
No confundir fallo de escritura con fallo del refresh posterior.

Probar `next/dynamic` real primero; no se ha demostrado incompatibilidad.
Si requiere adaptación, ejecutar el loader recibido y conservar refs/props,
sin sustituir todo import dinámico por un editor fijo. La compatibilidad de
chunks/Next se verifica en navegador.

Activity, cambio de Nodo y desmontaje ya están probados en el editor; la sesión
ya cubre cargas antiguas. Posponer otra carrera salvo una ejecución pendiente
alcanzable por UI que demuestre una garantía distinta. No repetir esa matriz.
Cierre: se observan datos presentes antes y ausentes después del bloqueo,
persistencia intacta y recuperación real; mutante correspondiente detectado.
jsdom no acredita layout, navegación completa ni fluidez.

## Entrega 3: SQL discriminante sobre la infraestructura existente

Mantener PostgreSQL, migraciones, índices, triggers, fixtures y locks actuales.
No agregar otro motor ni una abstracción de repositorios. `title-lifecycle.test.ts`
ya distingue destinos de históricos; `teaching-staff-notices.test.ts` ya contiene
conteos literales por ocultación/bloqueo y rol. No duplicarlos.

El informe SQL especifica un archivo `inbox-counts.test.ts` y ampliaciones pequeñas:

1. Extender el caso de título con otro destino del mismo Nodo, conservando sus
   expectativas de agrupación; ubicarlo al final para no alterar el conteo anterior.
2. Fallback `targetKey: null` y formas vacías con dos IDs distintos del mismo Nodo.
3. Dos Nodos con marcas positivas: reconocer conserva ambas, revisar A elimina
   solo A, y otro destinatario conserva su propia marca.
4. Límite de revisión con fechas t−1 ms, t y t+1 ms, destinos distintos y expectativas
   literales. Separar el caso de `noticeResetAt` para evitar que un filtro oculte otro.
5. Cardinalidades asimétricas entre destinatarios y dos Roadmaps a los que el
   mismo usuario tenga acceso: los distractores deben llegar a la consulta.
6. Ampliar pérdida/reactivación de participación para observar marcas y reset real.
7. Caso defensivo del filtro activo: preparar datos posteriores a la desactivación
   y posteriores al reset, para que trigger y reloj no vacíen la fixture antes de
   consultar. Declararlo snapshot defensivo, distinto de un flujo del productor.

No insertar dos pendientes con la misma clave no nula: el índice parcial lo
impide. Los históricos reconocidos y las claves nulas son fixtures diferentes.
El trigger borra pendientes al desactivar; un resultado vacío después de esa
transición por sí solo no demuestra que el lector filtre participación activa.

Usar fechas UTC explícitas con precisión milisegundo, sin sleeps ni fake timers
del driver. Expectativas independientes de predicados de producción; conservar
la paridad actual como garantía complementaria. Cierre: cada afirmación SQL
retirada de mocks tiene un test real identificado y sensibilidad comprobada.

## Sensibilidad transversal y controles

Cada entrega ejecuta baseline verde → alteración semántica temporal → fallo
atribuible a aserción → restauración → caso verde. Aprovechar primero los tests
existentes que ya detectan DISTINCT, ciclo de vida o visibilidad; agregar pruebas
solo para huecos. Registrar test, comando, diff y causa del fallo en la evidencia
de la entrega. Las alteraciones temporales aportan cero líneas permanentes.

Importación rota, SQL inválido, compilación, conexión y timeout global no prueban
sensibilidad. Una espera localizada que falla porque el segundo guardado sigue
deshabilitado sí puede probar el bloqueo, si se confirmó recepción y resolución
de la operación. No aumentar timeouts para volver verde una regresión.

Elegir un guardrail HTTP pequeño con `no-restricted-syntax`, en el glob de tests
HTTP: impedir `vi.mock`/`vi.doMock` con primer argumento string o import() de
`shared/errors/server` y `app/_adapters/http`. Probar métodos, módulos y ambas
formas, ejemplos permitidos y casos fuera de alcance, mediante `ESLint.lintText`
y configuración reales. Afirmar mensaje específico y ausencia de fallo de parser.

El selector solo reconoce patrones estáticos y puede rechazar `spy: true` por
política deliberada. No resuelve aliases de bindings, imports relativos ni
sustituciones indirectas. La revisión cubre esos casos; posponer regla general,
restricción UI adicional y plataforma Stryker hasta que una necesidad las justifique.
El guardrail HTTP es opcional según el informe independiente; lo incluyo en la
recomendación por la repetición observada y porque hooks/CI ya ejecutan ESLint.

Añadir una pauta breve en `docs/agents/testing.md`: riesgo, recorrido real, doble
exterior, resultado observable y sensibilidad. No crear CODING_STANDARDS.md solo
para apuntar a esa guía: la skill de revisión ya busca fuentes de estándares.
No ampliar AGENTS.md ni cambiar hooks/CI.

## Balance de líneas estimado

**Implementación efectuada hasta esta revisión: producción +0/−0, tests +0/−0,
configuración +0/−0.** Solo se escribieron documentos de investigación. Los cambios
previos ajenos del checkout no se atribuyen a este trabajo.

Las cifras siguientes son estimaciones de líneas físicas, incluyendo imports,
comentarios y vacías. Cada reemplazo suma una adición y una eliminación. No son
un diff implementado, un objetivo de tamaño ni una medición de esfuerzo.

| Área permanente | Añadidas | Eliminadas | Neto previsto |
| --- | ---: | ---: | ---: |
| Producción | 0 | 0 | 0 |
| Tests HTTP | 220–340 | 100–160 | +60–240 |
| Tests UI | 150–240 | 35–65 | +85–205 |
| Tests SQL y helpers locales | 180–260 | 0–4 | +176–260 |
| Tests del guardrail HTTP | 45–85 | 0 | +45–85 |
| Configuración ESLint | 20–40 | 0 | +20–40 |
| **Total código/tests/config recomendado** | **615–965** | **135–229** | **+386–830** |
| Guía de implementación, aparte | 25–50 | 0–10 | +15–50 |

Cálculo conservador: neto mínimo = adiciones mínimas − eliminaciones máximas;
neto máximo = adiciones máximas − eliminaciones mínimas. Se excluyen esta nota,
los cuatro informes, graphify, dependencias y mutantes temporales. La estimación
SQL separa sus 35–55 líneas de helper dentro de 180–260, sin sumarlas otra vez.
Los ajustes de sensibilidad se cuentan en la entrega dueña, no de nuevo al final.

Sin guardrail HTTP, el núcleo tendría +550–840/−135–229, neto +321–705;
conserva sensibilidad manual y pauta. La carrera UI adicional sería +45–80,
fuera del alcance recomendado. La extracción opcional de Prisma también queda
fuera. No anticipar ahorro neto: la mejora principal es garantía verificable.

## Validación y límites

Durante implementación usar worktree y versión exacta del estado elegido,
incluidos cambios necesarios sin commit; detectar modificaciones concurrentes
antes de integrar. Ejecutar pruebas con los locks de la guía local, primero
casos afectados y después unitarios e integración completos, tipos, formato y
lint. Usar los E2E existentes para confirmar servidor y composición; una
aprobación general E2E requiere su suite completa según la guía. El build de
producción no verifica replay de desarrollo.

Medir tiempos base y después del cambio, evitando ampliar matrices redundantes.
Cada entrega debe pasar sus checks y mostrar la alteración detectada por la
aserción esperada. Ningún informe de esta revisión acredita runtime, velocidad
ni suites aprobadas. La primera ejecución verificará especialmente el doble DB
con constructor real y `next/dynamic` sin adaptación.

## Investigación de fuentes primarias

Investigado el 2026-11-05. Esta nota reúne fuentes primarias y recomendaciones
derivadas para el diseño de pruebas. No se modificaron código ni pruebas y no
se ejecutaron suites. El plan específico del repositorio debe contrastarse con
los archivos vigentes; estas fuentes no demuestran por sí mismas que exista una
regresión actual.

## Conclusión

La estrategia recomendada es seleccionar pruebas que atraviesen las interfaces
implicadas en cada riesgo, conservando implementaciones propias reales dentro
de ese recorrido. Los dobles siguen siendo útiles en la interfaz exterior que
el test necesita controlar: una promesa de persistencia, una identidad de
sesión o un servicio institucional. El criterio de selección es qué defecto
observable detecta el test. Esta es una recomendación de diseño derivada de las
fuentes siguientes, no una obligación universal de eliminar mocks.

## React: modo estricto, eventos y estado conservado

[StrictMode](https://react.dev/reference/react/StrictMode) agrega comprobaciones
de desarrollo: render adicional, ciclos adicionales de efectos y callbacks de
ref. El doble render excluye el cuerpo de los event handlers. Además, el replay
inicial de efectos depende de que Strict Mode esté habilitado en la raíz; una
subsección estricta no reproduce necesariamente ese mismo ciclo inicial.

Consecuencia para el diseño: una prueba de guardados consecutivos puede montar
el editor real bajo Strict Mode y ejecutar cada clic una vez. No debería
duplicar manualmente acciones del usuario para representar Strict Mode. Una
prueba que espera un número exacto de suscripciones debe distinguir recursos
activos al terminar de llamadas transitorias durante setup/cleanup.

[React Testing Library](https://testing-library.com/docs/react-testing-library/api/#configure-options-reactstrictmode)
permite activar `reactStrictMode` por render o globalmente; el valor
predeterminado es `false`. Propongo activarlo explícitamente para las pruebas
de composición y ciclo de vida elegidas. Habilitarlo globalmente requiere
auditar antes los supuestos de los helpers y aserciones existentes; la API no
impone esa migración.

[Activity](https://react.dev/reference/react/Activity) oculta el DOM y conserva
estado, desconecta los efectos al ocultar y los recrea al mostrar. Sus hijos
pueden seguir renderizando por props con menor prioridad. La
[publicación de React 19.2](https://react.dev/blog/2025/10/01/react-19-2#activity-)
confirma que esa capacidad pertenece a una versión publicada compatible con
la familia 19.2 del proyecto.

Consecuencia: completar una promesa mientras un editor está oculto mediante
Activity es un caso distinto de desmontarlo de verdad. Una prueba de
compatibilidad puede cubrir visible → oculto → resolución/rechazo → visible,
y verificar que se libera la operación y continúa la edición. Introducir
Activity en el test no demuestra que el router actual lo utilice. Tampoco
justifica incorporarlo al producto.

La [discusión 82 del grupo de trabajo de React](https://github.com/reactwg/react-18/discussions/82)
explica por qué una referencia `isMounted` puede descartar el cierre de un POST
cuando se desconectan efectos pero se conserva estado. Distingue una promesa
finita de una suscripción que necesita cleanup. Es una fuente primaria de
razonamiento histórico, no el contrato actual de Activity ni una autorización
para ignorar listeners o cancelar incorrectamente operaciones remotas.

## Interacciones y asincronía controlada

Los [principios de Testing Library](https://testing-library.com/docs/guiding-principles/)
priorizan DOM e interacciones cercanas al uso del producto. Eso apoya probar
el editor y sus paneles reales cuando su composición es el riesgo, en lugar
de verificar exclusivamente callbacks o representar los hijos por elementos
vacíos. No prescribe usar un servidor real en cada test de UI.

[user-event](https://testing-library.com/docs/user-event/intro/) simula una
interacción con su secuencia de eventos y comprobaciones, mientras `fireEvent`
despacha un evento concreto. Su recomendación es crear una instancia con
`userEvent.setup()` por prueba y esperar las acciones asíncronas. `fireEvent`
sigue siendo válido para interacciones que la herramienta no implementa.

Las [utilidades async](https://testing-library.com/docs/dom-testing-library/api-async/)
devuelven promesas; `findBy` y `waitFor` permiten esperar una consecuencia.
`waitFor` puede ejecutar varias veces su callback y reintenta cuando este
lanza. Por ello propongo reservar ese callback para aserciones y realizar
fuera de él las acciones que mutan estado.

Para probar carreras, la recomendación derivada es exponer en el adaptador
de pruebas una promesa resoluble/rechazable: iniciar acción, observar ocupado,
cambiar selección o visibilidad, resolver y observar el estado final. Esto
permite elegir el orden causal sin pausas de duración arbitraria. No conviene
envolver todas las interacciones en `act` manual: usarlo para la resolución
externa cuando React lo requiera y conservar las utilidades async de RTL.

## Qué demuestra un mock y qué no

La [guía de módulos de Vitest](https://vitest.dev/guide/mocking/modules)
define el mock de módulo como reemplazo de su implementación. Una llamada
que ocurre dentro del mismo módulo puede conservar su referencia directa y
no pasar por el export reemplazado. Las diferencias entre el runner y Browser
Mode también afectan al mecanismo de mocking. La [guía general](https://vitest.dev/guide/mocking.html)
advierte sobre restaurar/limpiar estado de mocks y el hoisting de `vi.mock`.

Inferencia: si el test sustituye el normalizador de errores o el resultado
de SQL, ya no observa ese comportamiento real. Un mock puede verificar
coordinación, parámetros y propagación; para afirmar semántica de la operación
se necesita otro test que ejecute la implementación correspondiente. No conviene
refactorizar módulos solo para que un spy intercepte una llamada interna.

## HTTP: contrato del handler y contrato del servidor

Los [Route Handlers de Next.js](https://nextjs.org/docs/app/getting-started/route-handlers)
usan las APIs Web `Request` y `Response`. Se contrastó este contrato con la
documentación instalada de Next.js 16.3.2 en
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

Recomendación: llamar al handler exportado con una petición real y conservar
el traductor de errores y el serializador reales; observar `status`, JSON y
cabeceras pertinentes. Un doble en una dependencia exterior puede provocar
el error de forma determinista. El handler completo debe convertirlo en la
respuesta pública esperada, sin reemplazar esa conversión por una promesa
que rechaza.

Límite: llamar directamente a un handler no prueba resolución de rutas,
middleware/proxy, cookies en transporte, contexto de request del framework
ni ejecución real de `after()`. Para esos contratos hace falta servidor.
La [guía Next.js + Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
también indica que los Server Components asíncronos requieren otra estrategia;
su guía recomienda E2E. Esto coincide con la guía instalada en
`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`.

## SQL: datos reales y significado de los resultados

La documentación de [expresiones de tabla de PostgreSQL 18](https://www.postgresql.org/docs/18/queries-table-expressions.html)
explica que `FROM`, `WHERE`, agrupaciones y `HAVING` transforman los datos antes
de obtener el resultado. Mi conclusión es que buscar fragmentos en una cadena
SQL no prueba el resultado de esa transformación. La propuesta es preparar
filas discriminantes, invocar la consulta de producción y comparar los
resultados públicos: pertenencia, destinatario, agrupación, revisión y ausencia
de datos.

La [documentación de aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html)
señala que Read Committed observa datos confirmados al comenzar cada consulta,
y que consultas sucesivas pueden ver confirmaciones distintas. Las secuencias
tampoco se revierten como filas ordinarias. Inferencia: una transacción exterior
de test no aísla automáticamente las conexiones abiertas por la aplicación.
Para este proyecto conviene reutilizar fixtures propias y limpieza existentes;
las carreras reales deben controlar transacciones/conexiones y confirmar los
datos que otro participante necesita observar.

## Navegador real: complemento acotado

El proyecto [jsdom documenta](https://github.com/jsdom/jsdom#unimplemented-parts-of-the-web-platform)
que navegación y layout están fuera de su alcance. Incluso `pretendToBeVisual`
no implementa renderizado o cálculo de layout. Una prueba jsdom puede observar
estado y DOM; no acredita geometría, fluidez de una animación ni navegación
completa del navegador.

[Playwright](https://playwright.dev/docs/best-practices) recomienda comportamiento
visible, aislamiento entre tests y locators basados en contratos de usuario.
La propuesta derivada es conservar pocos recorridos de navegador para la
integración con framework/transporte y los riesgos visuales, usando datos
propios. No se requiere convertir cada rama de un reducer o consulta en un
recorrido E2E.

## Criterio de evaluación propuesto

Por cada escenario elegido registrar: defecto observable, interfaz de entrada,
implementaciones reales recorridas, adaptadores sustituidos, resultado público
esperado y una alteración controlada que debería hacer fallar el test. La
alteración se limita al comportamiento investigado y se revierte antes de la
validación final. Este criterio es una recomendación propia para comprobar
sensibilidad; no es un requisito de las bibliotecas ni una propuesta de
instalar una plataforma de mutación completa.
