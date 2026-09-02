# Estructura y dependencias de la línea base estable de U-Roadmaps

## Propósito y alcance

Este documento responde el [issue #32](https://github.com/Bigelazo/u-roadmaps/issues/32): describe cómo está estructurado realmente U-Roadmaps, qué imports cruzan sus Seams actuales, qué elementos propios no existen en `parity-deals-clone` y qué brechas presenta la línea base frente a los principios ya investigados. Es un diagnóstico de la forma actual; no define todavía el árbol objetivo ni la secuencia de migración.

El análisis conserva el vocabulario del [contexto Learning Roadmaps](../../CONTEXT.md): **Ramo**, **Curso**, **Período académico**, **Roadmap**, **Nodo**, **Tipo de nodo**, **Dependencia**, **Recurso**, **Usuario**, **Participación** y **Completación** no se usan como sinónimos intercambiables. También respeta los ADR vigentes, especialmente el almacenamiento protegido de Recursos, la separación de pruebas locales y el ciclo de vida futuro del Roadmap ([ADR-0004](../adr/0004-decouple-local-testing-from-docker.md), [ADR-0006](../adr/0006-store-uploaded-resources-in-a-protected-application-volume.md), [ADR-0007](../adr/0007-complete-role-aware-roadmap-lifecycle.md)).

El vocabulario arquitectónico de este informe es deliberadamente estricto:

- **Module**: algo con una Interface y una Implementation, desde una función hasta una feature completa.
- **Interface**: todo lo que el caller debe conocer, incluidos invariantes, errores, orden y configuración.
- **Implementation**: el código oculto detrás de la Interface.
- **Depth**: comportamiento que la Interface permite ejercer por unidad de conocimiento exigido al caller.
- **Seam**: lugar donde vive la Interface y donde puede variar el comportamiento.
- **Adapter**: realización concreta que satisface una Interface en un Seam.
- **Leverage**: capacidad que los callers obtienen de la Depth.
- **Locality**: concentración de cambio, conocimiento y verificación dentro del Module dueño.

## Puertas verificadas antes del análisis

### Línea base estable

La puerta de estabilidad quedó satisfecha para esta investigación:

- el issue HITL [#31](https://github.com/Bigelazo/u-roadmaps/issues/31) está cerrado;
- los issues de investigación previos [#29](https://github.com/Bigelazo/u-roadmaps/issues/29) y [#30](https://github.com/Bigelazo/u-roadmaps/issues/30) también están cerrados;
- la línea base inspeccionada es `main` en `082bf5c88595f7bfdf9812569de6aa1b028eb6d7`, coincidente con `origin/main` al iniciar el análisis;
- el worktree estaba limpio antes de crear este documento.

La conclusión se limita a ese commit. No trata archivos sin confirmar como arquitectura estable.

### Principios y referencia ya investigados

Las dos investigaciones prerrequisito también están cerradas y publicadas:

1. [#29, convenciones oficiales de Next.js](https://github.com/Bigelazo/u-roadmaps/issues/29), con su [informe fijado al commit `eb0f7ec`](https://github.com/Bigelazo/u-roadmaps/blob/eb0f7ec055b7aa2734d7574d2776bb69b89cd5eb/docs/architecture/nextjs-project-structure.md). Next.js prescribe la Interface con App Router —segmentos, archivos especiales, layout raíz y grafo Server/Client—, pero no prescribe pertenencia por feature, dirección de dependencias, Interfaces públicas ni política de imports.
2. [#30, principios de `parity-deals-clone`](https://github.com/Bigelazo/u-roadmaps/issues/30), con su [informe fijado al commit `0171b33`](https://github.com/Bigelazo/u-roadmaps/blob/0171b33/docs/architecture/parity-deals-structure.md). La referencia propone pertenencia feature-first y este flujo de imports:

   ```text
   shared solo importa shared
   feature X importa shared y feature X
   app importa shared y cualquier feature para componer
   entry points consumen Modules, pero no son importados como bibliotecas
   ```

La referencia es influencia, no plantilla. Sus limitaciones importan tanto como su árbol: permite imports a internals de las features, trata `shared` como una categoría demasiado amplia, no expresa el entorno Server/Client, no incluye pruebas y contiene una excepción de permisos que contradice una de sus propias configuraciones. U-Roadmaps tampoco debe copiar su ESLint 8/eslintrc: la línea base usa Next.js 16, ESLint 9 y flat config ([`package.json`](../../package.json#L25-L76), [`eslint.config.mts`](../../eslint.config.mts#L1-L89)).

## Método

Se ejecutó primero `graphify query` sobre el grafo existente para ubicar el flujo Roadmap, los Modules de `src/lib`, VTI, U-Campus, fixtures, Prisma y las pruebas. Como el grafo es una ayuda de wayfinding y puede ir detrás del commit actual, todas las conclusiones y cifras se comprobaron después contra los archivos de `082bf5c`.

El censo de imports recorrió los `import`, `export ... from` e `import()` internos de archivos TypeScript/TSX/MTS bajo `src`, `prisma` y `tests`; resolvió tanto `@/*` como rutas relativas y excluyó paquetes externos. Los recuentos de tamaño omiten `src/generated/prisma` salvo cuando se lo identifica explícitamente como código generado. Una arista representa una declaración de import, no llamadas en ejecución ni acceso indirecto a la misma tabla.

## Actualización posterior a la línea base

La fotografía anterior sigue siendo la evidencia histórica que abrió el issue #32. Después de publicar el árbol objetivo se incorporaron funcionalidades Roadmap que confirman —y precisan— su clasificación, sin alterar la conclusión de que el slice servidor aún está disperso en `src/lib`:

- las Dependencias solo pueden unir Nodos visibles; ocultar un Nodo elimina sus Dependencias en la misma transacción y la migración `20260901000002_remove_hidden_node_dependencies` limpia las relaciones históricas inválidas;
- los Bloqueos docentes y los prerrequisitos pasan a determinar el acceso del Estudiante, incluido el impacto transitivo de bloquear o desbloquear una rama;
- antes de ocultar un Nodo, crear una Dependencia o modificar un Bloqueo docente, la UI obtiene una previsualización de las Dependencias o Nodos afectados y pide confirmación;
- la representación React Flow ahora adapta la geometría de las tarjetas al título y conserva el layout del grafo;
- se añadieron pruebas unitarias de geometría, tarjetas y canvas, y escenarios Playwright de visibilidad, Dependencias y acceso estudiantil.

Estas reglas no crean features nuevas: pertenecen al Module `roadmap`. La revisión de [`target-project-structure.md`](./target-project-structure.md) las separa entre `domain` (invariantes puras), `application` (casos de uso) e `infrastructure` (Adapters), deja `student` como Implementation de presentación y conserva `nodes`, `dependencies`, `access` y `completion` como nombres de conocimiento. También hace explícita la extracción de los tipos reutilizados a `types.ts` por Module —con props de React junto a su componente— y la gestión transversal de errores con `neverthrow`.

## Estructura real

El árbol semántico actual es el siguiente:

```text
src/
├── app/                              24 archivos · 1.705 líneas
│   ├── page.tsx y layout.tsx
│   ├── academic-overview/page.tsx
│   ├── acceso-institucional/page.tsx
│   ├── courses/[courseCode]/[year]/[semester]/page.tsx
│   └── api/**/route.ts               18 Adapters HTTP
├── components/                       23 archivos · 1.775 líneas
│   ├── app-shell/                     4 archivos
│   └── ui/                           19 primitives shadcn propias
├── features/
│   └── roadmap/                      22 archivos · 2.764 líneas
│       ├── editor/                   edición docente
│       ├── graph/                    React Flow, layout y geometría visual
│       ├── student/                  detalle y estado del Nodo
│       ├── RoadmapCanvas.tsx
│       └── useRoadmap.ts
├── lib/                              14 archivos · 3.034 líneas
│   ├── auth.ts, db.ts, development*.ts, mufasa.ts
│   ├── resource-storage.ts
│   └── roadmap-{api,completion,editor,geometry,types}.ts
├── generated/prisma/                19 archivos · 19.452 líneas generadas
└── types/next-auth.d.ts

prisma/                                8 archivos · 493 líneas
├── schema.prisma
├── migrations/**
├── seed.ts
└── development-data.ts

tests/                                23 archivos · 2.588 líneas
├── *.test.ts(x)                      Vitest, en una carpeta técnica plana
└── e2e/**                            Playwright
```

Las cifras cuentan líneas por archivo de manera uniforme y sirven para comparar concentración, no para medir calidad. Dos hechos dominan la forma:

1. existe una sola feature explícita, `roadmap`;
2. esa feature contiene casi exclusivamente la Implementation cliente y visual, mientras su comportamiento servidor está en `src/lib`.

Por eso el árbol ya insinúa feature-first, pero aún no aplica pertenencia feature-first al slice completo. `src/lib` es mayor que la feature y mezcla Modules globales, integración institucional, persistencia, fixtures y comportamiento específico del Roadmap.

### Qué vive en cada zona

`src/app` contiene correctamente los archivos especiales de Next.js, pero no se limita a Adapters y composición. El Resumen académico consulta Mufasa y Prisma, reconcilia resultados, prioriza Cargos institucionales de curso, agrupa por Período académico y renderiza en un mismo archivo de 360 líneas ([`academic-overview/page.tsx`](../../src/app/academic-overview/page.tsx#L25-L109), [`academic-overview/page.tsx`](../../src/app/academic-overview/page.tsx#L224-L360)). El Adapter HTTP correspondiente repite la consulta y gran parte de la transformación ([`api/academic-overview/route.ts`](../../src/app/api/academic-overview/route.ts#L8-L63)).

`src/components/ui` es el shared más nítido: 18 de sus imports internos apuntan solamente a `src/lib/utils.ts`, y sus demás dependencias son primitives externas. `src/components/app-shell` también depende hacia abajo de `ui`; sin embargo, la barra de personas de desarrollo y la sesión son comportamiento de aplicación, no primitives neutrales.

`src/features/roadmap` posee la consulta visual, edición, grafo y detalle para una Participación estudiante. `src/app/courses/**/page.tsx` conoce solo `RoadmapCanvas`, lo cual ya forma un Seam externo pequeño ([`courses/.../page.tsx`](../../src/app/courses/[courseCode]/[year]/[semester]/page.tsx#L1-L44)). Dentro de la feature, `RoadmapCanvas` compone `editor`, `graph`, `student` y `useRoadmap` ([`RoadmapCanvas.tsx`](../../src/features/roadmap/RoadmapCanvas.tsx#L84-L258)).

`src/lib` no tiene una semántica única. `utils.ts` y `db.ts` son infraestructura transversal pequeña; `mufasa.ts` es integración con U-Campus; `development*.ts` implementa el escenario determinista; `roadmap-*` pertenece inequívocamente a la capacidad Roadmap. La carpeta técnica oculta esas diferencias.

`prisma` contiene schema, migraciones y dos ejecutables. El schema reúne la persistencia compartida de Ramo, Curso, Roadmap, Nodo, Tipo de nodo, Dependencia, Recurso, Usuario, Participación y Completación ([`schema.prisma`](../../prisma/schema.prisma#L10-L150)); `development-data.ts` materializa el fixture y además exporta la operación de reset ([`development-data.ts`](../../prisma/development-data.ts#L23-L124)).

## Mapa de imports internos

| Importador | Destino | Imports | Lectura |
| --- | --- | ---: | --- |
| `src/app/api/**` | `src/lib` | 53 | Los Adapters HTTP conocen directamente auth, errores/transporte, persistencia Roadmap, edición, Completación, desarrollo, U-Campus y almacenamiento. |
| pages/layout de `src/app` | `src/lib` | 11 | Las rutas visuales acceden a sesión, Prisma, U-Campus y utilidades. |
| pages/layout de `src/app` | `src/components/ui` | 9 | Composición descendente esperada. |
| `src/app/layout.tsx` | `src/components/app-shell` | 3 | Composición descendente esperada. |
| `src/app/courses/**/page.tsx` | `src/features/roadmap` | 1 | Única entrada de `app` a una feature explícita. |
| `src/features/roadmap` | la misma feature | 37 | Cohesión interna de editor, graph, student y hook. |
| `src/features/roadmap` | `src/components/ui` | 39 | Dependencia descendente coherente con la referencia. |
| `src/features/roadmap` | `src/lib` | 21 | Mezcla shared real con tipos, URL y geometría específicos del Roadmap. |
| `src/components/ui` | `src/lib/utils.ts` | 18 | Shared a shared, acotado. |
| `src/lib` | `src/generated/prisma` | 4 | Cuatro Modules servidor conocen directamente Prisma. |
| `prisma/development-data.ts` | `src/lib` | 4 | El reset compone fixtures, assets, guardas y almacenamiento. |
| `src/app/api/development/reset/route.ts` | `prisma/development-data.ts` | 1 | Un entry point HTTP importa otro ejecutable. |

También hay un import directo desde `src/app/api/plogin/route.ts` al cliente Prisma generado, además de los accesos al `prisma` singleton. Los tests Vitest importan una ruta de `app`, cuatro archivos de `app-shell`, siete de `lib` y once internals de `features/roadmap`; Playwright importa el catálogo de fixture y helpers propios.

Visto solo por nombres de carpetas, el flujo parece cercano a `app → feature/shared`. Visto por propiedad, no lo está: `src/lib/roadmap-api.ts`, `roadmap-editor.ts`, `roadmap-completion.ts`, `roadmap-types.ts` y `roadmap-geometry.ts` son específicos del Roadmap. Clasificarlos como shared hace que la política permita aristas que, con propiedad correcta, serían imports al mismo Module Roadmap o una inversión real.

## Diagnóstico de Modules, Seams y Depth

### 1. Roadmap cliente: Seam externo prometedor, pertenencia incompleta

El Module visual Roadmap tiene una Interface externa pequeña: `app` entrega la identidad del Curso, permiso de edición y metadatos a `RoadmapCanvas`; la Implementation esconde React Flow, layout, edición, detalle del Nodo y carga HTTP. Eso produce Depth y Leverage razonables para el caller de `app`: un import activa gran parte de la experiencia.

La Locality se rompe por abajo. Los tipos del Roadmap y su construcción de URL viven en `src/lib/roadmap-types.ts`, que a su vez importa `CourseOfferingIdentifier` desde el Module servidor `roadmap-api.ts` ([`roadmap-types.ts`](../../src/lib/roadmap-types.ts#L1-L50)). La feature también importa geometría específica desde `src/lib/roadmap-geometry.ts`. No son shared independientes; son parte de la misma razón de cambio.

`useRoadmap` ofrece 15 mutaciones más carga y manejo de errores en una sola Interface retornada ([`useRoadmap.ts`](../../src/features/roadmap/useRoadmap.ts#L49-L160), [`useRoadmap.ts`](../../src/features/roadmap/useRoadmap.ts#L162-L401)). La Implementation centraliza cancelación, estado y protocolo HTTP —Leverage real—, pero la superficie amplia aproxima la Interface a todas las operaciones de la Implementation. La Depth es intermedia, no alta.

Los tests atraviesan internals como `graph/map-roadmap-graph`, `graph/DependencyEdge`, `graph/FloatingEdge`, `student/NodeDetail` y `editor/NodeDetailsEditor` ([`roadmap-graph.test.tsx`](../../tests/roadmap-graph.test.tsx#L1-L5), [`use-roadmap.test.tsx`](../../tests/use-roadmap.test.tsx#L1-L6)). Eso demuestra varios Seams de hecho, pero no una Interface pública deliberada para la feature. La referencia deja esta misma decisión sin resolver; U-Roadmaps debe decidirla en el prototipo, no heredarla por accidente.

### 2. Roadmap servidor: Implementation específica presentada como shared

El servidor del Roadmap está repartido entre tres Modules principales:

| Module actual | Tamaño | Interface visible | Implementation |
| --- | ---: | --- | --- |
| `roadmap-api.ts` | 496 líneas | 25 exports entre tipos, error, parsing, validación, DTO, consultas, creación y detección de ciclos | NextResponse, neverthrow, Prisma, reglas de entrada, lectura y creación de Roadmap |
| `roadmap-editor.ts` | 469 líneas | 12 operaciones de Nodo, Tipo de nodo, Dependencia y Recurso | autorización docente, validación, transacciones, concurrencia y limpieza de archivos |
| `roadmap-completion.ts` | 214 líneas | 2 operaciones | representación por Rol de participación y registro serializable de Completación |

`roadmap-api.ts` mezcla al menos cuatro razones de cambio. Define el catálogo de errores y su respuesta HTTP ([líneas 15–145](../../src/lib/roadmap-api.ts#L15-L145)), valida parámetros y cuerpos ([líneas 148–283](../../src/lib/roadmap-api.ts#L148-L283)), transforma entidades a DTO ([líneas 249–338](../../src/lib/roadmap-api.ts#L249-L338)) y consulta/crea Roadmaps con Prisma ([líneas 356–496](../../src/lib/roadmap-api.ts#L356-L496)). Su eliminación haría reaparecer complejidad en muchos callers, así que sí aporta Leverage; el problema es que la Interface de 25 exports obliga a conocer demasiadas responsabilidades y reduce Locality.

La dependencia más clara contra la propiedad deseada es `auth.ts → roadmap-api.ts`: sesión y autorización importan el error, `apiResult` y el identificador del Curso desde un archivo llamado y construido alrededor del Roadmap ([`auth.ts`](../../src/lib/auth.ts#L1-L3), [`auth.ts`](../../src/lib/auth.ts#L36-L110)). Si auth fuera shared y Roadmap una feature, esto sería `shared → feature`, prohibido por el principio de referencia. La causa no es que auth deba mudarse ciegamente, sino que errores/transporte e identidad académica carecen de un dueño neutral explícito.

`roadmap-editor.ts` concentra invariantes valiosos —Participación docente activa, pertenencia al Roadmap, inmutabilidad de Tipos de nodo predefinidos, unicidad, aciclicidad y concurrencia—, de modo que su Implementation sí tiene Depth ([líneas 35–139](../../src/lib/roadmap-editor.ts#L35-L139), [líneas 141–327](../../src/lib/roadmap-editor.ts#L141-L327)). Sin embargo, cada operación acepta `Record<string, unknown>` y cada Adapter debe combinar parsing, sesión, `.match`, `throwApiError` y serialización. Parte de la Interface de transporte se repite en cada caller, restando Leverage al Seam.

### 3. Adapters de Next.js: algunos delgados, otros contienen el caso de uso

Los route handlers del Roadmap suelen ser Adapters relativamente pequeños, pero conocen tres Interfaces distintas: transporte/error, auth y operación Roadmap. Por ejemplo, actualizar un Nodo repite parseo de identidad, parseo JSON, resolución de Usuario y conversión de Result antes de invocar la operación ([`nodes/[nodeId]/route.ts`](../../src/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/route.ts#L15-L44)). Esa repetición es señal de una Interface de aplicación todavía poco profunda.

Dos Adapters contienen bastante más Implementation:

- subir un Recurso valida multipart, traduce errores de archivo, escribe bytes, crea el registro y compensa la escritura si falla Prisma ([`nodes/[nodeId]/resources/route.ts`](../../src/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/resources/route.ts#L22-L69));
- el callback VTI valida origen/cookies/JWT/claims, consume la transacción, reconcilia el Usuario por RUT y correo, crea la sesión y clasifica errores en 151 líneas de `POST` ([`plogin/route.ts`](../../src/app/api/plogin/route.ts#L78-L228)).

En ambos casos, borrar el Adapter movería lógica de negocio e infraestructura a otro lugar; no es un pass-through. Eso indica baja Locality: el Seam de framework y el caso de uso no están separados.

Las pages también saltan el Seam de aplicación. La página del Curso consulta Prisma para derivar si una Participación permite editar ([`courses/.../page.tsx`](../../src/app/courses/[courseCode]/[year]/[semester]/page.tsx#L15-L29)), mientras los Adapters HTTP vuelven a comprobar autorización. La duplicación no es solo costo: crea dos lugares donde puede divergir el significado del Rol de participación, especialmente cuando ADR-0007 agregue el Cargo institucional de curso y cierre por Período académico.

### 4. Resumen académico: dos callers reconstruyen el mismo conocimiento

El Resumen académico carece de un Module dueño entre Mufasa/Prisma y sus dos Adapters. La page y la ruta HTTP consultan en paralelo U-Campus y Participaciones locales, construyen la misma clave `courseCode:year:semester`, combinan la misma información y derivan Rol de participación y disponibilidad del Roadmap ([`academic-overview/page.tsx`](../../src/app/academic-overview/page.tsx#L224-L262), [`api/academic-overview/route.ts`](../../src/app/api/academic-overview/route.ts#L8-L58)). La page agrega deduplicación, prioridad y agrupamiento; la ruta devuelve resultados sin esa normalización completa.

La ausencia de una Interface canónica reduce Locality y ya permite dos representaciones observables del mismo Resumen académico. Un Module profundo aquí escondería caída a datos locales, reconciliación, prioridad y orden detrás de una representación única consumida por ambos Adapters.

### 5. Recursos protegidos: almacenamiento concentrado, ciclo de vida distribuido

`resource-storage.ts` encapsula ruta física y operaciones de archivo en 34 líneas ([`resource-storage.ts`](../../src/lib/resource-storage.ts#L1-L34)). Su Interface evita que callers conozcan `uploads/`, lo que aporta Locality para la Implementation filesystem. Aun así, hay un solo Adapter concreto; crear una abstracción adicional hoy sería un Seam hipotético, no uno demostrado por dos Adapters.

El ciclo de vida completo del Recurso está distribuido entre:

- validación y compensación en el Adapter de subida;
- creación y borrado del registro en `roadmap-editor.ts`;
- autorización, consulta Prisma y lectura de bytes en el Adapter de descarga ([`resources/[resourceId]/file/route.ts`](../../src/app/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]/file/route.ts#L17-L60));
- reemplazo de archivos reservados desde el ejecutable de fixtures.

ADR-0006 exige preservar propiedad, autorización y limpieza al cambiar de almacenamiento. La Implementation actual satisface ese comportamiento en conjunto, pero no existe un solo Seam donde verificarlo o reemplazarlo; la Locality del ciclo de vida es baja.

### 6. Fixtures y ejecutables: capacidad propia sin clasificación estable

`development-fixtures.ts` tiene 1.065 líneas y modela el escenario presente y futuro: Ramos, Cursos, Secciones objetivo, Cargos institucionales de curso, Participaciones, Roadmaps, Nodos, Tipos de nodo, Dependencias, Recursos y Completaciones ([`development-fixtures.ts`](../../src/lib/development-fixtures.ts#L1-L25), [`development-fixtures.ts`](../../src/lib/development-fixtures.ts#L214-L254), [`development-fixtures.ts`](../../src/lib/development-fixtures.ts#L339-L391)). `development-fixture-assets.ts` fabrica documentos válidos; `prisma/development-data.ts` materializa el subconjunto persistible.

Es una capacidad de soporte con comportamiento sustantivo, no shared residual. El comando `dev:data:reset` ya es una Interface de alto nivel definida en `package.json` ([líneas 18–23](../../package.json#L18-L23)), coherente con ADR-0004. Sin embargo, el Adapter HTTP de reset importa directamente `prisma/development-data.ts` ([`api/development/reset/route.ts`](../../src/app/api/development/reset/route.ts#L1-L17)). Así, un entry point se reutiliza como biblioteca y crea la única arista `app → prisma`; la referencia clasificaría ambos como consumidores, no como Modules reutilizables.

### 7. Persistencia y entorno Server/Client

Prisma genera 19 archivos dentro de `src/generated/prisma`, casi veinte mil líneas que no deben participar en métricas de propiedad ni recibir edición manual. Cuatro Modules de `lib`, dos ejecutables Prisma y el Adapter VTI dependen del cliente generado. El schema es compartido por todos los conceptos persistidos, por lo que la política futura tendrá que clasificar explícitamente tanto acceso al cliente como propiedad de queries; mover archivos sin decidir esto solo trasladaría imports.

No hay imports de `server-only` o `client-only` en `src`. La separación actual depende de disciplina, directivas `'use client'` y del grafo accidental. Esto es relevante porque `roadmap-types.ts` cliente depende por tipo de `roadmap-api.ts`, mientras este último importa `next/navigation`, `next/server`, Prisma y DB. TypeScript elimina ese import de tipo, pero la Interface y la política de dependencias no expresan que el destino sea exclusivo de servidor.

### 8. Pruebas: buena cobertura por comportamiento, Seams dispersos

La taxonomía Vitest/Playwright sigue ADR-0004 y el comando `test` conserva la puerta secuencial ([`package.json`](../../package.json#L14-L17)). Playwright prueba el sistema desplegado y es el Seam más alto para persistencia, auth y flujos completos. Esa parte ya ofrece Leverage.

Vitest, en cambio, está organizado en una carpeta técnica plana y suele importar internals mediante rutas relativas. Esto no es incorrecto por sí solo: los Modules internos del grafo o del editor pueden tener Interfaces útiles. La brecha es que esos Seams no están declarados y los tests no coinciden con una política de Interface pública. Una migración mecánica puede romper muchos imports aun cuando el comportamiento no cambie.

## Elementos propios de U-Roadmaps ausentes en la referencia

`parity-deals-clone` no resuelve varios problemas que la arquitectura objetivo de U-Roadmaps debe clasificar explícitamente:

| Elemento propio | Evidencia actual | Necesidad estructural demostrada |
| --- | --- | --- |
| Dominio Learning Roadmaps | `CONTEXT.md`, schema Prisma y ADR-0007 | Propiedad para Ramo, Curso, Sección, Participación, Roadmap, Evolución del roadmap, Nodo, Dependencia, Recurso y Completación sin convertirlos en shared global por defecto. |
| U-Campus mediante Mufasa | [`mufasa.ts`](../../src/lib/mufasa.ts#L1-L208) | Un Adapter institucional que traduzca payloads y fallos a la Interface del producto; el Resumen académico y la futura Sincronización de participantes no deberían repetir esa reconciliación. |
| VTI y sesión NextAuth | [`auth.ts`](../../src/lib/auth.ts#L8-L33), [`plogin/route.ts`](../../src/app/api/plogin/route.ts#L64-L228) | Separar protocolo institucional, identidad del Usuario, sesión de aplicación y autorización por Participación. VTI no determina el Rol de participación. |
| Recursos en volumen protegido | ADR-0006, [`resource-storage.ts`](../../src/lib/resource-storage.ts#L1-L34) | Mantener ocultos `fileKey` y bytes, autorización por Participación, 404 para Nodo oculto y limpieza best-effort detrás de Seams verificables. |
| Grafo pedagógico interactivo | [`features/roadmap/graph`](../../src/features/roadmap/graph), [`roadmap-geometry.ts`](../../src/lib/roadmap-geometry.ts#L1-L62) | Clasificar motor React Flow, mapeo, auto-layout, geometría y reglas de Dependencia dentro del Module Roadmap, distinguiendo visualización de invariantes persistidas. |
| Fixtures ricos y personas de desarrollo | [`development-fixtures.ts`](../../src/lib/development-fixtures.ts#L25-L70), [`development-data.ts`](../../prisma/development-data.ts#L23-L110) | Una capacidad ejecutable y reutilizable por desarrollo/E2E, con seguridad sobre base local y almacenamiento, sin volver importable un entry point. |
| Dos niveles de prueba e infraestructura E2E | ADR-0004, [`playwright.config.ts`](../../playwright.config.ts), [`vitest.config.mts`](../../vitest.config.mts) | Clasificar tests, helpers y fixtures dentro de las mismas restricciones arquitectónicas o mediante excepciones deliberadas. |
| Código Prisma generado y archivos raíz | [`schema.prisma`](../../prisma/schema.prisma#L1-L8), [`tsconfig.json`](../../tsconfig.json#L20-L35) | Excluir generated de propiedad manual, pero clasificar schema, migraciones, seed, reset y configuración que importan `src`. |
| Capacidades de ciclo de vida aún no persistidas | ADR-0001 y ADR-0007; tipos objetivo en fixtures | Dar un lugar futuro a Secciones, Cargo institucional de curso, cierre por Período académico, Evolución del roadmap, copia y Seguimiento de estudiantes sin fingir que ya existen en la Implementation actual. |

Estas diferencias impiden copiar literalmente las familias `products`, `analytics`, `subscriptions` y `users` de la referencia. La pregunta correcta para U-Roadmaps es qué capacidad posee cada conocimiento y qué Interface necesitan sus callers reales.

## Brechas frente a los principios investigados

### Brechas confirmadas

1. **Feature-first incompleto.** Solo la experiencia cliente del Roadmap vive en `features/roadmap`; la mayor parte de su Implementation servidor vive en `lib`. UI, contratos, invariantes y persistencia que cambian por la misma razón no tienen Locality.
2. **Shared funciona como clasificación residual.** `src/lib` mezcla shared verdadero, infraestructura, integración institucional, fixture y cinco Modules específicos del Roadmap. La dirección de imports parece válida únicamente porque la propiedad está aplanada.
3. **Inversión shared → feature escondida.** `auth.ts` y `roadmap-types.ts` dependen de `roadmap-api.ts` para errores e identidad del Curso. Con propiedad honesta, Modules globales dependen de un Module específico del Roadmap.
4. **`app` contiene Implementation de casos de uso.** Resumen académico, callback VTI y ciclo de vida de subida/descarga no son solamente Adapters de framework.
5. **Interfaces de servidor demasiado amplias o procedurales.** `roadmap-api.ts` expone 25 nombres de cuatro responsabilidades; los Adapters repiten la misma coreografía de parsing, auth, Result y respuesta. Hay Leverage parcial, pero Depth insuficiente para el área de Interface.
6. **Representación duplicada del Resumen académico.** Page y ruta HTTP reconstruyen el mismo conocimiento con diferencias observables, reduciendo Locality.
7. **Entry point importado por otro entry point.** La ruta de reset importa el ejecutable `prisma/development-data.ts` en vez de que ambos consuman un Module dueño del reset.
8. **Seam Server/Client no expresado.** No hay guardas `server-only`/`client-only`, y un tipo cliente se obtiene desde un archivo que también importa Next servidor y Prisma.
9. **Interfaces de feature no deliberadas.** `app` usa una entrada estrecha, pero tests e internals importan archivos profundos sin una política explícita. La referencia tampoco resuelve este punto.
10. **Política no automatizada.** ESLint actual aplica Next, TypeScript, neverthrow, Vitest, Testing Library, Playwright, CSS y Prettier, pero ninguna regla clasifica archivos o restringe imports ([`eslint.config.mts`](../../eslint.config.mts#L17-L89)). Un archivo nuevo puede cruzar cualquier Seam sin señal automática.
11. **Zonas propias no cubiertas por la referencia.** `prisma`, generated, tests, fixtures, VTI, U-Campus y almacenamiento necesitan reglas propias; una política limitada a `src/app|features|components|lib` dejaría huecos.

### Aspectos actuales que conviene preservar

- `src/app/courses/**/page.tsx → RoadmapCanvas` ya ofrece una Interface externa estrecha.
- `features/roadmap → components/ui` y `components/ui → utils` siguen una dirección descendente clara.
- `features/roadmap` no puede importar otra feature porque todavía no existe otra; no hay acoplamiento lateral que deshacer.
- Los route handlers conservan las URLs y archivos especiales que Next.js exige.
- `resource-storage.ts`, `mufasa.ts`, `vti-claims.ts` y `db.ts` ya concentran partes útiles de su Implementation, aunque su propiedad y Seams superiores deban aclararse.
- Los comandos de prueba y el reset determinista ya son Interfaces de alto nivel respaldadas por ADR.

## Consecuencias para el prototipo de arquitectura objetivo

Este diagnóstico no elige todavía carpetas, pero el issue #33 debería demostrar al menos lo siguiente:

1. clasificar por propiedad el slice completo del Roadmap, no solo su UI;
2. separar el shared genuino de auth, integración institucional, fixtures e Implementation específica;
3. mantener `app` como lugar de routing, protocolo y composición, extrayendo los casos de uso que hoy viven en sus Adapters;
4. definir una Interface canónica para Resumen académico y otra para la experiencia Roadmap, incluyendo quién posee `CourseOfferingIdentifier`, errores y DTO;
5. tratar Prisma, generated, tests, fixtures y archivos raíz como categorías explícitas de la política;
6. proteger el Seam Server/Client en el grafo real de imports;
7. decidir si cada feature expone una Interface pública o permite internals concretos, incluyendo el efecto sobre tests;
8. introducir un Seam con Adapters solo cuando haya variación real; un único Adapter no justifica abstracciones especulativas;
9. adaptar las invariantes a ESLint 9 flat config y activarlas al final de la migración, no copiar las configuraciones de la referencia;
10. conservar cada tipo reutilizado junto a su Module en un `types.ts`, sin extraer props exclusivos de React de su componente;
11. extraer el protocolo de errores de `roadmap-api.ts` a un Module transversal basado en `neverthrow`, manteniendo los códigos propios en el Module dueño y la serialización HTTP en `app`;
12. preservar las decisiones de CONTEXT.md y ADR, incluidos los conceptos futuros que el fixture describe pero Prisma aún no persiste.

La prioridad arquitectónica no es reducir líneas ni maximizar carpetas. Es recuperar Depth: Interfaces pequeñas que den Leverage a `app` y a los tests, e Implementations con suficiente Locality para que autorización, reconciliación institucional, invariantes del Roadmap y ciclo de vida del Recurso cambien una sola vez.

## Conclusión

U-Roadmaps ya tiene el comienzo de una arquitectura feature-first, pero solo en el cliente del Roadmap. El grafo real se apoya todavía en `src/lib` como centro de gravedad: 64 imports desde `app` hacia `lib`, 21 desde la feature y 3.034 líneas de responsabilidades heterogéneas. El principal problema no es una arista lateral entre features; es que la clasificación actual llama shared a Implementation que tiene dueños específicos y deja casos de uso dentro de Adapters de `app`.

La oportunidad del prototipo es profundizar los Modules existentes antes de multiplicarlos: conservar el Seam estrecho de `RoadmapCanvas`, reunir el slice Roadmap, extraer la representación del Resumen académico, separar protocolo VTI de identidad/autorización y concentrar el ciclo de vida protegido del Recurso. La futura política ESLint deberá hacer visible esa propiedad en todos los archivos relevantes, incluidos Prisma, generated, tests y ejecutables, sin repetir las limitaciones conocidas de `parity-deals-clone`.
