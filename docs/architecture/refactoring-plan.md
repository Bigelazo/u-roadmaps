# Plan incremental de refactorización de U-Roadmaps

## Propósito, autoridad y límite

Este plan resuelve el [issue #34](https://github.com/Bigelazo/u-roadmaps/issues/34). Convierte la arquitectura aprobada de [`target-project-structure.md`](./target-project-structure.md) en lotes de ejecución dependientes y verificables. No modifica esa arquitectura: para cambiar propiedad, dirección de imports o excepciones hace falta una nueva revisión HITL.

La migración es una **refactorización de preservación de comportamiento**. Cada ticket debe mantener, para los flujos que toque, las mismas URLs y métodos HTTP, códigos y cuerpos de respuesta, semántica de autorización, sesiones y cookies, persistencia y migraciones Prisma, almacenamiento protegido de Recursos, Server/Client boundary, interfaz visible y decisiones de los ADR. No está autorizado a reinterpretar el dominio ni a "aprovechar" una extracción para añadir, eliminar o arreglar funcionalidades.

En consecuencia:

- los archivos especiales y segmentos de `src/app` conservan su ruta y su papel de Adapter Next.js; mover lógica desde ellos no permite renombrarlos ni alterar routing;
- un cambio de imports se hace en el mismo commit que el movimiento o la extracción; no se dejan imports rotos ni una etapa que requiera una rama de integración para volver a verde;
- un alias temporal es únicamente una reexportación sin lógica, está documentado con consumidor y fecha de retiro, y no crea dos Implementations ni dos fuentes de verdad;
- si una extracción revela dos resultados observables distintos, la nueva Interface debe representar ambos contratos y sus Adapters deben preservarlos. Igualarlos exige un issue de cambio de producto separado;
- no se cambian schema, migraciones, fixtures semánticos, contratos HTTP ni datos persistidos salvo lo estrictamente mecánico para conservarlos durante el movimiento.

El vocabulario de esta planificación sigue [`CONTEXT.md`](../../CONTEXT.md): un **Curso** no es un Ramo, y los invariantes de Roadmap, Nodo, Dependencia, Recurso, Participación y Completación mantienen sus significados actuales. ADR-0004 conserva los dos niveles de pruebas; ADR-0005 separa sesión local de VTI; ADR-0006 conserva autorización y limpieza de Recursos; ADR-0001 y ADR-0007 continúan siendo decisiones futuras, no funcionalidades que esta migración pueda materializar.

## Puerta común de cada ticket

Cada ticket parte desde `main` actualizado y con worktree limpio. Antes de editar registra los comandos y casos focalizados que pasan en esa línea base; al terminar vuelve a ejecutarlos. Una falla previa se anota como preexistente con evidencia y no se usa para ampliar el alcance del ticket.

La puerta mínima de todo lote de TypeScript es:

```sh
pnpm run typecheck
pnpm run lint
pnpm run test:unit -- <tests focalizados>
```

Además se ejecuta el subconjunto de Playwright que cubra cualquier ruta, autenticación, persistencia, carga/descarga de archivos o interacción de navegador afectada. Cuando el lote altera una de esas superficies de manera transversal, ejecuta la puerta completa prescrita por ADR-0004:

```sh
pnpm test
```

Los tests focalizados son el mínimo, no un sustituto de la puerta completa cuando corresponde. Las pruebas de regresión deben observar contratos públicos: páginas, navegador, HTTP, efectos persistidos o una Interface pública del Module; no deben bloquear movimientos internos por afirmar rutas privadas antiguas.

Antes de cerrar un ticket se revisa también lo siguiente:

1. `git diff --check` no informa errores de espacio ni marcadores accidentales.
2. No cambió ningún pathname de `src/app` que Next.js use para routing, ni una URL, método, cookie, status, DTO o mensaje que el ticket no haya caracterizado y preservado.
3. No se introdujo un import cliente hacia una entrada de servidor, Prisma, filesystem o secretos; las guardas `server-only`/`client-only` se agregan al introducir sus Interfaces, sin convertir código de ejecución.
4. No queda un consumer de un alias temporal que pueda usar la Interface pública definitiva; se elimina el alias al terminar su lote dependiente.
5. Se actualiza `graphify` al finalizar un cambio de código (`graphify update .`) y se adjunta al ticket el resultado de las puertas ejecutadas.

## Secuencia de ejecución

Las etapas están ordenadas por dependencia, no por cantidad de archivos. Cada una produce un repositorio integrable por sí solo. Los tickets que se creen a partir de esta tabla son hijos de #28 y usan dependencias nativas de GitHub; la numeración se completa al crearlos.

| Etapa | Ticket | Conjunto coherente y resultado | Depende de | Verificación adicional de preservación |
| --- | --- | --- | --- |
| 0 | [#48](https://github.com/Bigelazo/u-roadmaps/issues/48) | **Caracterizar contratos y preparar movimientos.** Inventariar pathnames de `app`, contratos HTTP, imports de entrada y escenarios E2E; añadir sólo caracterización que falte. Definir el registro de aliases temporales. | ninguna | Ejecutar las pruebas que caracterizan cada superficie; no mover producción ni cambiar configuración ESLint. |
| 1 | [#49](https://github.com/Bigelazo/u-roadmaps/issues/49) | **Fundaciones shared y composición privada de app.** Mover `components/ui`, utilidades genuinamente transversales, DB, entorno/sesión y shell a `shared/**` o `app/_components`/`app/_adapters`; introducir Interfaces pequeñas y guardas de entorno cuando corresponda. | 0 | Layout, navegación, sesión y operaciones que usen Prisma conservan el mismo comportamiento y bundle cliente. |
| 2 | [#50](https://github.com/Bigelazo/u-roadmaps/issues/50) | **Integraciones e identidad institucional.** Separar VTI y U-Campus como `integrations/**`; extraer `institutional-access` y la sesión local sin cambiar inicio/callback/cierre de sesión ni reconciliación de Usuario. | 1 | Los flujos VTI, cookies, redirects y pruebas de identidad conservan sus resultados; VTI no adquiere autorización por Participación. |
| 3 | [#51](https://github.com/Bigelazo/u-roadmaps/issues/51) | **Module Resumen académico.** Extraer lectura y reconciliación a `features/academic-overview`, con Interface pública de servidor y de cliente; page y route pasan a ser Adapters del mismo Module. | 1, 2 | Caracterizar y conservar por separado el HTML de page y el JSON/errores de API actuales. La Interface puede tener proyecciones distintas mientras esos contratos existan. |
| 4 | [#52](https://github.com/Bigelazo/u-roadmaps/issues/52) | **Contratos y experiencia cliente de Roadmap.** Trasladar tipos, geometría, grafo, editor, experiencia estudiante y cliente HTTP al dueño Roadmap; mantener `RoadmapCanvas` como Interface cliente-segura y las rutas de API intactas. | 1 | Vitest de canvas, grafo, geometría, editor y vista estudiantil; E2E de layout y consulta de Roadmap. |
| 5 | [#53](https://github.com/Bigelazo/u-roadmaps/issues/53) | **Reglas y aplicación servidor de Roadmap.** Extraer de `roadmap-api`, `roadmap-editor`, acceso y completación los errores compartidos, reglas puras y casos de uso; las rutas sólo parsean, resuelven actor y traducen `Result`. | 1, 2, 4 | E2E de cada mutación y consulta Roadmap, especialmente visibilidad, Dependencias, Bloqueos docentes, Completación y errores. Las reglas puras reciben Vitest sin Next.js, Prisma, red ni filesystem. |
| 6 | [#54](https://github.com/Bigelazo/u-roadmaps/issues/54) | **Ciclo de vida protegido de Recursos.** Reunir upload, download, actualización, eliminación, compensación y Adapter filesystem bajo Roadmap. No se crea un port especulativo para un solo Adapter. | 5 | API/browser E2E para carga, descarga autorizada, `404` de Nodo oculto, borrado y limpieza best-effort; se preservan `fileKey`, volumen y cabeceras de descarga de ADR-0006. |
| 7 | [#55](https://github.com/Bigelazo/u-roadmaps/issues/55) | **Desarrollo, ejecutables y pruebas colocadas.** Llevar fixtures y helpers a `development/**`, hacer que seed/reset consuman Modules y nunca se importen entre entry points; colocar Vitest junto al Seam dueño sin mover E2E. | 1, 3, 5, 6 | `dev:data:reset`, fixture guard y E2E aislado de ADR-0004; cada test conserva el comportamiento que verificaba aunque cambie su ruta. |
| 8 | [#56](https://github.com/Bigelazo/u-roadmaps/issues/56) | **Retirar compatibilidades y comprobar el árbol.** Actualizar todos los consumers a `index.ts`/`server.ts`, retirar aliases temporales y revisar que no queden `src/lib`, `src/components` o imports profundos que contradigan la forma aprobada. | 3, 4, 5, 6, 7 | Puerta completa, revisión de imports y actualización de graphify. No se instala todavía el plugin de límites. |
| 9 | [#57](https://github.com/Bigelazo/u-roadmaps/issues/57) | **Instalar y activar la política arquitectónica.** Confirmar compatibilidad actual de `eslint-plugin-boundaries` con ESLint 9/flat config, configurar un único motor deny-by-default, restricciones estrechas y archivos desconocidos; eliminar sólo la configuración temporal necesaria. | 8 | `pnpm run lint` pasa con la política activa, junto a typecheck, unitarias y E2E completas. Una prueba negativa documenta que cada borde relevante falla. |

Las etapas 3–7 no se paralelizan si compiten por los mismos imports o Interfaces. Un ticket puede abrirse antes, pero sólo se implementa cuando sus bloqueadores estén cerrados. Si un movimiento revela un ciclo arquitectónico no resuelto por la arquitectura aprobada, se detiene el ticket, se conserva el árbol verde y se solicita revisión HITL; no se abre una excepción de lint ni se introduce una dependencia inversa para continuar.

## Detalle de los lotes con mayor riesgo

### Interfaces antes de traslados masivos

Los archivos que mezclan responsabilidades (`roadmap-api.ts`, `roadmap-editor.ts`, `auth.ts`, el callback VTI, la page y la route de Resumen académico, y routes de Recursos) no se migran con `git mv` aislado. Primero se extrae una Interface que conserve firmas, `Result`, serialización y orden de efectos; después se traslada la Implementation detrás de ella; finalmente se actualizan callers y se elimina el puente temporal. Así el diff es revisable y una regresión queda localizada.

La nueva Interface de `features/roadmap/server.ts` debe ser exclusiva de servidor y `index.ts` cliente-segura. Los tipos que el cliente consume se mueven antes que el código servidor que los produce; no se conserva un `import type` desde un archivo con Prisma como solución permanente. Los props exclusivos de React permanecen junto a su componente.

### Resumen académico sin normalización accidental

La línea base documenta que la page y la API reconstruyen información de forma distinta. Convertir esa diferencia en una sola salida visible sería una modificación funcional. La etapa 3 extrae una única fuente de adquisición y reglas comunes detrás de `getAcademicOverview`, pero cada Adapter conserva la proyección, orden, agrupamiento, errores y serialización que ya ofrece. Sólo un issue de producto posterior, con decisión explícita y sus propias pruebas, puede cambiar esos contratos para hacerlos idénticos.

### Recursos y autorización

La etapa 6 debe conservar la secuencia existente: validar, guardar bytes, crear el Recurso, compensar si la persistencia falla; autorizar y ocultar según Participación/Nodo al descargar; borrar los bytes sólo después del commit y de forma best-effort. Extraerla no justifica cambiar tamaño máximo, content types, `Cache-Control`, rutas de descarga ni exponer `fileKey`.

### ESLint queda para el cierre

Hasta la etapa 8 se mantiene el lint vigente. No se instala `eslint-plugin-boundaries`, no se activa una política estructural parcial ni se copian versiones/configuración ESLint 8 de la referencia: cualquiera de esas opciones convertiría archivos todavía legítimos de la transición en deuda permanente y restaría señal al lint actual.

En la etapa 9 se verifica en la versión de `eslint` y formato flat config presentes entonces:

1. una sola integración de `eslint-plugin-boundaries`, compatible con ESLint 9;
2. clasificación de todos los archivos manuales y `no-unknown`/`no-unknown-files` —o el equivalente vigente— con default `disallow`;
3. `no-restricted-imports` para imports profundos, Prisma generado y cruces Server/Client que el plugin no exprese;
4. exclusiones explícitas y mínimas para generated, Prisma schema/migraciones, configuración, ejecutables y E2E, sin convertirlas en bibliotecas importables;
5. tests negativos por cada frontera para comprobar que la política rechaza una arista prohibida.

No se instala `eslint-plugin-project-structure` en paralelo. Si el plugin compatible no puede expresar una invariante aprobada, se documenta la limitación y se propone una regla ESLint acotada; no se rebaja la política a allow-by-default.

## Criterio de cierre del mapa

El mapa #28 sólo puede cerrar cuando los tickets anteriores estén cerrados y se cumplan los 17 criterios de aceptación de `target-project-structure.md`, incluida la puerta completa `pnpm test` y la política ESLint activa. La prueba final debe afirmar explícitamente que los cambios fueron estructurales: URLs, contratos HTTP, comportamientos del dominio, persistencia, visuales y ADR permanecen sin cambio. Cualquier cambio funcional descubierto durante la migración se devuelve a un issue independiente y no se absorbe como parte de este plan.
