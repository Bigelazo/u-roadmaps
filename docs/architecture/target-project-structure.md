# Arquitectura objetivo de U-Roadmaps

## Estado y alcance

Esta propuesta responde el [issue #33](https://github.com/Bigelazo/u-roadmaps/issues/33). Combina la influencia principal de [`parity-deals-clone`](./parity-deals-structure.md), las [convenciones oficiales de Next.js](./nextjs-project-structure.md) y el [diagnóstico de la línea base estable](./current-u-roadmaps-structure.md). Se revisó después de implementar visibilidad de Nodos, Dependencias pedagógicas, Bloqueos docentes, previsualizaciones de impacto y geometría variable de tarjetas. Su estado sigue siendo **propuesto y pendiente de revisión HITL**: define la forma que deberá aprobarse antes de preparar la secuencia de migración del issue #34.

El objetivo no es maximizar carpetas ni aplicar una plantilla uniforme. Es recuperar **Locality** por capacidad y **Depth** en sus Interfaces: `app` y las pruebas deben poder ejercer casos de uso completos sin conocer Prisma, protocolos institucionales, almacenamiento, validadores, conversión de errores ni detalles internos del grafo pedagógico. Dentro de cada feature, la lógica de negocio se separa deliberadamente de la lógica de aplicación: las reglas puras no dependen de Next.js, Prisma, filesystem ni red; los casos de uso las coordinan sin duplicarlas entre Adapters.

La propuesta conserva el lenguaje de [`CONTEXT.md`](../../CONTEXT.md) y no cambia las decisiones vigentes de los ADR. En particular:

- el cierre del Roadmap sigue derivándose del Período académico (ADR-0001);
- la UI compartida continúa siendo shadcn propia sobre Base UI (ADR-0003);
- Vitest y Playwright conservan responsabilidades distintas (ADR-0004);
- la sesión de U-Roadmaps sigue separada de la sesión VTI (ADR-0005);
- los Recursos subidos siguen almacenándose en el volumen protegido y descargándose tras autorización (ADR-0006);
- la futura creación, copia, Sincronización de participantes, autorización por Cargo institucional de curso y Seguimiento de estudiantes conservan el modelo de ADR-0007.

Esta decisión clasifica esos comportamientos; no implementa todavía los que los ADR mantienen como futuros.

## Decisión resumida

U-Roadmaps adoptará una arquitectura **feature-first con Interfaces públicas**, bajo estas categorías:

```text
app ───────────────▶ features ───────────────▶ integrations ───────────────▶ shared
 │                     └───────────────────────────────────────────────────────▲
 └─────────────────────────────────────────────────────────────────────────────┘

development ──▶ shared + Interfaces públicas de features
entry points ─▶ shared + Interfaces públicas de features/development
```

Las flechas se leen `importador → destino`:

- `shared` importa únicamente `shared`, salvo el Adapter Prisma explícito;
- una `integration` importa `shared` y archivos de su propia integración;
- `feature X` importa `shared`, Interfaces públicas de `integrations` y archivos de `feature X`;
- `app` importa `shared`, Interfaces públicas de cualquier feature y sus propios auxiliares privados de composición;
- `development` puede importar `shared` e Interfaces públicas de features, pero solo entry points de desarrollo, E2E y superficies protegidas de desarrollo pueden importarlo;
- ejecutables y archivos especiales consumen Modules, pero nunca son importados como bibliotecas;
- ninguna feature importa otra feature hermana.

`app` es la capa superior de routing, transporte y composición. No se agrega una capa global de “services” o “use cases”: los casos de uso pertenecen a la feature cuya razón de cambio representan.

## Árbol objetivo

El árbol siguiente es semántico y representativo. Una subcarpeta aparece solo cuando contiene comportamiento real; no todas las features deben replicar el mismo esqueleto.

```text
u-roadmaps/
├── docs/
│   ├── architecture/
│   └── adr/
├── prisma/
│   ├── schema.prisma                  schema y migraciones, no Module importable
│   ├── migrations/**
│   └── seed.ts                        entry point del seed global
├── scripts/
│   └── reset-development-data.ts      entry point local, nunca biblioteca
├── src/
│   ├── app/                            Adapters Next.js y composición
│   │   ├── _adapters/                  transporte HTTP/sesión común de app
│   │   ├── _components/                shell y composición exclusiva de app
│   │   ├── academic-overview/page.tsx
│   │   ├── acceso-institucional/page.tsx
│   │   ├── courses/[courseCode]/[year]/[semester]/page.tsx
│   │   ├── api/**/route.ts
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── features/
│   │   ├── academic-overview/
│   │   │   ├── index.ts                Interface cliente-segura
│   │   │   ├── server.ts               Interface servidor, marcada server-only
│   │   │   ├── types.ts                DTO y comandos propios, sin Prisma ni Next.js
│   │   │   ├── components/**
│   │   │   ├── application/**           caso de uso de reconciliación y lectura
│   │   │   ├── domain/**                prioridad, agrupamiento y orden puros
│   │   │   └── infrastructure/**        Adapter Mufasa y consultas Prisma propias
│   │   ├── institutional-access/
│   │   │   ├── index.ts
│   │   │   ├── server.ts
│   │   │   ├── types.ts
│   │   │   ├── components/**
│   │   │   ├── application/**           inicio/término de sesión y Usuario
│   │   │   ├── domain/**                reglas puras de identidad local
│   │   │   └── infrastructure/**        persistencia propia y sesión NextAuth
│   │   └── roadmap/
│   │       ├── index.ts                 RoadmapCanvas y contratos cliente-seguros
│   │       ├── server.ts                Interface pública de aplicación servidor
│   │       ├── types.ts                 identidad, comandos y DTO cliente-seguros
│   │       ├── client/**                 carga y mutaciones HTTP
│   │       ├── editor/**
│   │       ├── graph/**
│   │       ├── student/**
│   │       ├── application/
│   │       │   ├── roadmap/**            lectura, creación y representación por Rol
│   │       │   ├── nodes/**              comandos de Nodo y Tipo de nodo
│   │       │   ├── dependencies/**       crear, borrar y previsualizar impacto
│   │       │   ├── completion/**         registrar y leer Completación
│   │       │   ├── resources/**          coordinar autorización, bytes y compensación
│   │       │   └── participation/**      cargar y aplicar autorización del Curso
│   │       ├── domain/
│   │       │   ├── dependencies/**       aciclicidad, visibilidad e impacto transitivo
│   │       │   ├── access/**             acceso estudiantil y Bloqueos docentes
│   │       │   ├── completion/**         invariantes de Completación
│   │       │   └── types.ts              conceptos de negocio sin DTO ni Prisma
│   │       └── infrastructure/
│   │           ├── persistence/**        queries, transacciones y mapeo Prisma
│   │           └── resources/**          Adapter de volumen protegido
│   ├── integrations/
│   │   ├── ucampus/
│   │   │   ├── server.ts                Interface institucional normalizada
│   │   │   └── server/**                Adapter Mufasa
│   │   └── vti/
│   │       ├── server.ts
│   │       └── server/**                claims, JWT y protocolo VTI
│   ├── shared/
│   │   ├── academic/
│   │   │   └── course-offering.ts       identidad neutral de Ramo/Curso/Período
│   │   ├── errors/
│   │   │   ├── types.ts                 error de aplicación y Result compartido
│   │   │   ├── result.ts                constructores y normalización neverthrow
│   │   │   └── server.ts                captura, log y normalización inesperada
│   │   ├── ui/**                        primitives shadcn propias
│   │   ├── lib/**                       utilidades puras y transversales
│   │   └── server/
│   │       ├── db/**                    único acceso al cliente Prisma generado
│   │       ├── session/**               sesión local e identidad autenticada
│   │       └── environment/**           configuración y guardas de servidor
│   ├── development/
│   │   ├── index.ts                     UI/datos cliente-seguros de desarrollo
│   │   ├── server.ts                    reset público y guardado
│   │   ├── fixtures/**                  catálogo determinista
│   │   ├── components/**                selector de personas de desarrollo
│   │   └── server/**                    materialización y assets reservados
│   ├── generated/
│   │   └── prisma/**                    generado, no editable ni exportable al cliente
│   └── types/
│       └── next-auth.d.ts               augmentación declarativa del paquete externo
├── tests/
│   └── e2e/**                           Playwright, helpers y aliases de escenario
├── eslint.config.mts
├── next.config.ts
├── playwright.config.ts
├── tsconfig.json
└── vitest.config.mts
```

Los nombres internos (`roadmap`, `editor`, `resources`, etc.) describen ejemplos plausibles del primer movimiento, no una obligación de crear carpetas vacías. Si dos archivos forman un Module suficientemente claro, pueden permanecer directamente bajo su dueño.

## Responsabilidad y Interface de cada zona

### `src/app`: Adapters de Next.js

`app` conserva segmentos, parámetros dinámicos y archivos especiales porque forman la Interface con Next.js y el contrato de URLs. Pages, layouts y route handlers deben limitarse a:

1. recibir parámetros, cookies, headers o cuerpos del framework;
2. resolver la sesión de aplicación cuando corresponda;
3. invocar una Interface pública de feature;
4. componer UI o traducir el resultado al protocolo HTTP.

`app/_adapters` reúne mecánica reutilizable de transporte —por ejemplo, convertir un error de aplicación en respuesta HTTP— sin conocer reglas de Roadmap. `app/_components` contiene composición exclusiva del shell. El prefijo `_` comunica que esos árboles no son segmentos de ruta; ningún archivo externo a `app` puede importarlos.

Un Adapter se considera demasiado profundo cuando su eliminación desplazaría autorización de Participación, reconciliación institucional, transacciones, compensación de archivos o reglas pedagógicas a otro route handler. Ese comportamiento pertenece a la feature.

### `src/features/<feature>`: Modules verticales de producto

Una feature reúne presentación, tipos, reglas, casos de uso e infraestructura que cambian por una misma capacidad del producto. La clasificación inicial es:

- `roadmap`: experiencia del Roadmap completa, incluidos grafo, edición, representación por Rol de participación, Completación y ciclo de vida del Recurso;
- `academic-overview`: representación canónica del Resumen académico, incluida la reconciliación entre U-Campus y datos locales, prioridad, agrupamiento y orden;
- `institutional-access`: inicio y término de la sesión local, consumo de la identidad VTI y reconciliación del Usuario. No posee Participaciones ni autorización académica.

Una feature expone como máximo dos puntos de entrada externos:

- `index.ts`: Interface cliente-segura. Puede exportar componentes, DTO y tipos definidos en `types.ts`, sin dependencias de servidor;
- `server.ts`: Interface de servidor, con `import "server-only"`, que exporta casos de uso completos.

`app`, `development` y configuración raíz solo importan esos puntos de entrada. Un barrel público nunca reexporta Prisma, un Adapter externo ni archivos `application/**`, `domain/**` o `infrastructure/**`. Los imports profundos dentro de una feature están reservados a su propia Implementation y a sus pruebas colocadas.

Esta separación evita convertir un nuevo `index.ts` en la misma Interface de 25 exports que hoy presenta `roadmap-api.ts`. El punto de entrada del servidor expone operaciones de aplicación, no parsers, serializers, queries auxiliares ni tipos de persistencia. Dentro de `roadmap/application`, `nodes`, `dependencies`, `completion`, `resources` y `participation` nombran casos de uso; `editor` no se reutiliza fuera de la UI docente porque describe presentación, no negocio.

### Capas internas de una feature: negocio separado de aplicación

La división se aplica **dentro de cada feature**, no mediante carpetas globales que reúnan todo el dominio, toda la aplicación o toda la infraestructura del proyecto. Cada feature conserva así un Module vertical profundo y una única razón de cambio para su producto.

```text
app / route handler
        │  llama la Interface pública
        ▼
feature/server.ts ──▶ application ──▶ domain
                           │
                           └──────────▶ infrastructure ──▶ Prisma / filesystem / integración
```

Las flechas internas expresan dependencia, no orden temporal: el dominio no conoce ni la aplicación ni la infraestructura.

- `domain/**` contiene lógica de negocio pura: valores, reglas, invariantes y cálculos. En Roadmap incluye aciclicidad de Dependencias, restricciones de visibilidad, propagación de Bloqueos docentes, acceso del Estudiante y requisitos de Completación. No importa Next.js, React, Prisma, `shared/server`, filesystem, red ni `infrastructure`.
- `application/**` contiene casos de uso: recibe un comando ya validado en el borde, obtiene los datos necesarios, aplica reglas de `domain`, autoriza, abre una transacción cuando corresponde, coordina Adapters y devuelve un `Result` de `neverthrow`. No formula por sí mismo la regla de negocio ni expone detalles de transporte.
- `infrastructure/**` contiene Adapters concretos que la feature necesita: persistencia Prisma, volumen protegido de Recursos y mapeos entre entidades externas y tipos de la feature. Puede importar tipos de su propio dominio, pero nunca dirige un caso de uso ni decide una invariante.

El `server.ts` de la feature es la Interface de aplicación: sus callers piden `createDependency`, `hideNode` o `completeNode`, no un repositorio Prisma ni una función de recorrido del grafo. Si se elimina un caso de uso, su coordinación debe reaparecer; si se elimina una regla de `domain`, la misma regla no debe reaparecer en varias rutas. Esta prueba de eliminación mantiene la Depth de la Interface y la Locality de las reglas.

### `src/integrations/<provider>`: Adapters externos

`integrations` contiene protocolos que U-Roadmaps no controla:

- `ucampus` traduce Mufasa a datos institucionales normalizados;
- `vti` valida y traduce el protocolo de identidad institucional.

Las integraciones no deciden autorización por Participación, no crean sesiones de aplicación y no presentan DTO de UI. Importan solo `shared` y su propia Implementation. Las features consumen sus Interfaces públicas de servidor.

El Seam hacia una integración externa puede usar un port interno cuando exista un Adapter de producción y un Adapter de prueba que permitan verificar el caso de uso. Ese port permanece dentro de la feature o integración que lo necesita; no se eleva a una Interface global por abstracción especulativa.

### `src/shared`: building blocks genuinamente transversales

`shared` es una afirmación de independencia, no el destino de todo lo que aún no tiene dueño. Solo contiene piezas que:

- sirven a más de una capacidad o entry point;
- no conocen features, integraciones, `app` ni desarrollo;
- poseen una semántica estable por sí mismas.

Aquí pertenecen las primitives shadcn propias, utilidades puras, la identidad neutral de un Curso, la gestión transversal de errores y el acceso técnico compartido a sesión, entorno y cliente de base de datos. Las queries de negocio no pertenecen a `shared/server/db`: permanecen en la feature que posee la decisión que representan.

El schema Prisma puede continuar centralizado porque la línea base usa una sola base y no se están declarando bounded contexts ni almacenamiento aislado. Esa elección no vuelve shared a todas las operaciones sobre sus tablas.

### Tipos: un archivo de tipos por Module, props junto al componente

`types.ts` es el único nombre reservado para declaraciones de tipos reutilizadas dentro de un Module. Cada feature conserva sus DTO, comandos y uniones de dominio cliente-seguros en su `types.ts`; un sub-Module con tipos propios, como `roadmap/editor` o `roadmap/graph`, puede tener su propio `types.ts`. Los `index.ts` públicos reexportan selectivamente esos tipos cuando forman parte de su Interface.

No se usan `contracts.ts`, `models.ts`, `interfaces.ts`, `common.ts` ni archivos de tipos globales como nombres alternativos: ocultan la propiedad o separan artificialmente tipos que cambian junto a su Module. Un tipo que solo describe props de un React Component vive en el mismo `.tsx` que lo consume, no en el `types.ts` del directorio. Esto mantiene visible la Interface de presentación y evita que `types.ts` se convierta en un registro de props de toda la UI.

Los tipos de Prisma, `Request`, `Response`, Mufasa o VTI no cruzan una Interface de feature. La Implementation los transforma a los tipos de su Module antes de exponerlos. Una importación de tipo también debe respetar estas reglas: TypeScript puede borrarla al emitir, pero sigue comunicando y acoplando conocimiento entre Modules.

### `src/shared/errors`: gestión centralizada de errores con neverthrow

`shared/errors` es el único Module transversal para representar y componer errores de aplicación. `types.ts` define una forma estable, cliente-segura y serializable de error —código, mensaje y detalles públicos opcionales— y el alias de `Result`/`ResultAsync`. `result.ts` concentra los constructores, el wrapping de promesas y las combinaciones de `neverthrow`; `server.ts`, marcado `server-only`, conserva la captura de errores inesperados, `unstable_rethrow` cuando Next.js lo exige y el logging. Ningún caller crea un `ResultAsync.fromPromise` con su propio `catch` ni convierte excepciones de Prisma a HTTP.

Los códigos y mensajes que expresan reglas del Roadmap, del Resumen académico o del acceso institucional permanecen en el `types.ts` de la feature que los posee. La centralización define el protocolo y la mecánica, no un catálogo global que obligue a que cada cambio de una feature toque shared. Las Interfaces de servidor devuelven `ResultAsync<T, ApplicationError>`; las funciones internas pueden lanzar solo mientras están encapsuladas por el Module de errores. Así, `neverthrow` es el Seam explícito entre Implementation que puede fallar y callers que deben decidir el resultado.

`app/_adapters` es el único lugar que traduce ese error serializable a `Response`/`NextResponse`, incluido el status HTTP. No pertenece a `shared/errors`: HTTP es una Interface de Next.js, no una propiedad universal de un error. Los Client Components consumen solo la carga de error cliente-segura; no conocen excepciones, Prisma ni `next/server`.

### `src/development`: soporte deliberado, no shared residual

El catálogo de fixtures, sus assets, el reset y el selector de personas forman un Module de soporte propio. `development/server.ts` es la única Interface del reset para `scripts/reset-development-data.ts` y para la ruta protegida de desarrollo. El ejecutable deja de ser importado como biblioteca.

Este Module puede consumir contratos públicos de features cuando el catálogo necesita representar su forma, pero no sus internals. Mantiene las guardas de base local, allowlist e idempotencia de ADR-0004 y administra solo registros y archivos reservados. Nadie puede importarlo desde una superficie de producción; las excepciones autorizadas se enumeran de forma cerrada.

### Prisma, generated y entry points raíz

- `src/generated/prisma/**` es código generado: se excluye de métricas, lint de estilo y edición manual.
- Solo `src/shared/server/db/**` puede importar el cliente generado. Features y Adapters reciben el cliente compartido y traducen entidades a contratos propios antes de cruzar un Seam cliente o de feature.
- `prisma/schema.prisma` y `prisma/migrations/**` pertenecen a tooling de persistencia, no a una feature importable.
- `prisma/seed.ts` y `scripts/**` son entry points: pueden consumir Interfaces públicas, pero ningún Module puede importarlos.
- Los archivos raíz de configuración se clasifican explícitamente como tooling. Si necesitan código de `src`, usan una Interface pública compatible con su entorno.

## Reglas de colocación

Cada archivo nuevo se clasifica en este orden:

1. Si Next.js exige su nombre o ubicación, vive en `src/app` y se mantiene como Adapter.
2. Si implementa una regla pura de una capacidad, vive en `domain/**` de esa feature; si coordina una operación, vive en `application/**`; si habla con Prisma, filesystem o un protocolo concreto, vive en `infrastructure/**`.
3. Si es presentación o estado cliente de una capacidad, vive directamente bajo la feature o en su sub-Module visual, no en sus capas servidor.
4. Si traduce un protocolo externo que U-Roadmaps no controla, vive en `integrations/<provider>`.
5. Si es independiente de capacidades y ya tiene reutilización transversal real, vive en `shared`.
6. Si declara tipos reutilizados de ese Module, vive en su `types.ts`; los props exclusivos de un React Component permanecen en ese componente.
7. Si representa o compone fallos de aplicación, usa `shared/errors`; la traducción HTTP queda en `app/_adapters` y los códigos propios en el `types.ts` del dueño.
8. Si solo existe para datos, UI o ejecución local/E2E, vive en `development` o `tests/e2e`, según quién lo ejecute.
9. Si es generado, migración, seed, script o configuración, conserva su categoría explícita y no se presenta como biblioteca.
10. Si ninguna categoría aplica, el archivo queda sin clasificar y el lint falla. No se crea una carpeta `lib` genérica para silenciar la decisión.

La promoción de una pieza desde una feature a `shared` exige al menos dos consumidores independientes y ausencia de conocimiento específico de la feature. Compartir una función entre dos archivos de la misma feature no satisface ese criterio.

## Invariantes de imports

La política es *deny by default*: toda arista no autorizada queda prohibida.

| Importador | Puede importar | No puede importar |
| --- | --- | --- |
| `shared` | `shared` | integrations, features, development, `app`, entry points |
| `integration X` | `shared`, `integration X` | otra integración, features, development, `app`, entry points |
| `feature X` | `shared`, Interfaces públicas de integraciones, `feature X` | otra feature, internals de integraciones, development, `app`, entry points |
| `app` | `shared`, Interfaces públicas de cualquier feature, auxiliares privados de `app` | internals de features/integraciones, development salvo excepciones, otros entry points |
| `development` | `shared`, Interfaces públicas de features, su propia Implementation | internals de features, `app`, entry points |
| entry point raíz | `shared`, Interfaces públicas de features/development | `app`, internals, otro entry point |
| prueba colocada | lo permitido al Module dueño y sus propios internals | otra feature, `app`, entry points |
| E2E | helpers E2E, aliases públicos de escenario, sistema vía HTTP/browser | internals de producción, Prisma generado |

Dentro de una misma feature, la dirección también es *deny by default*:

| Importador interno | Puede importar | No puede importar |
| --- | --- | --- |
| `domain` | su propio dominio y `shared` puramente funcional | `application`, `infrastructure`, `app`, Next.js, Prisma, red, filesystem |
| `application` | su dominio, infraestructura propia, Interfaces públicas de integraciones y `shared` | UI cliente, otra feature, detalles de una integración |
| `infrastructure` | su dominio/tipos, `shared/server/db` y `shared` técnico | `application`, UI cliente, otra feature |
| UI/client de la feature | tipos cliente-seguros, su propia UI y cliente HTTP | `application`, `domain`, `infrastructure`, Prisma |

`application → infrastructure` es una dependencia concreta deliberada mientras exista un solo Adapter real. Cuando haya dos Adapters que deban variar, la Interface del port se ubica junto a la aplicación o infraestructura de la feature que la necesita; no se publica una abstracción global por anticipación.

Excepciones cerradas:

1. `src/shared/server/db/** → src/generated/prisma/**` es la única entrada manual a Prisma generado.
2. Los archivos especiales de `app` pueden importar `app/globals.css`, `app/_adapters/**` y `app/_components/**`; esos auxiliares nunca son importables fuera de `app`.
3. La ruta local de reset y la composición visual del selector pueden importar las Interfaces públicas de `development`, siempre protegidas por las guardas de entorno existentes.
4. Los archivos de declaración como `src/types/next-auth.d.ts` pueden ampliar el paquete que declaran, pero no se usan como Modules de aplicación.
5. `app/_adapters/**` puede importar `shared/errors` para serializar un `ApplicationError`; ninguna feature, integración o shared importa `next/server` para traducir sus propios errores HTTP.

No se permiten excepciones anchas como `shared → features/**`. Si una coordinación necesita cruzar features, `app` compone sus Interfaces públicas o se revisa la propiedad del conocimiento; no se transforma `shared` en un coordinador circular.

## Invariantes Server/Client

La carpeta comunica intención, pero el grafo real de módulos es la autoridad:

- todo punto de entrada `server.ts`, `application/**` o `infrastructure/**` y todo acceso a Prisma, sesión, secretos, filesystem, Mufasa o VTI importa `server-only`;
- `'use client'` se coloca en la raíz interactiva más pequeña posible, no en el barrel completo de una feature;
- módulos exclusivamente de navegador pueden usar `client-only` cuando su consumo incorrecto no sea evidente;
- `index.ts` y `types.ts` de una feature no importan ni reexportan `server.ts`, `application/**`, `domain/**`, `infrastructure/**`, Prisma, `next/server` o variables privadas;
- un Client Component no importa módulos `application/**`, `domain/**` ni `infrastructure/**`, ni siquiera solo para reutilizar tipos; los contratos cliente-seguros viven fuera de esas capas;
- DTO y errores serializables cruzan el Seam; modelos Prisma, `fileKey`, secretos y objetos de transporte externos no lo cruzan;
- las reglas se aplican a imports por alias, relativos, dinámicos y de tipo.

Estas invariantes complementan a Next.js: las carpetas `server` y `client` no sustituyen `'use client'`, `server-only` ni la comprobación del grafo de imports.

## Interfaces representativas

Los ejemplos ilustran la forma buscada; los nombres finales pueden ajustarse durante la migración sin debilitar los Seams.

### Un Adapter HTTP invoca un caso de uso

```ts
// src/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/route.ts
import { authenticatedJsonRoute } from "@/app/_adapters/http";
import { updateNode } from "@/features/roadmap/server";

export const PATCH = authenticatedJsonRoute(async ({ actor, params, body }) =>
  updateNode({ actor, courseOffering: params, nodeId: params.nodeId, body }),
);
```

El Adapter conoce HTTP y la Interface pública. `authenticatedJsonRoute` resuelve sesión, parsea transporte y convierte el `ResultAsync` a HTTP; `updateNode` posee validación, autorización docente, pertenencia del Nodo, concurrencia y transacción. No se exportan por separado `parseCourseOffering`, `requireTeacher`, `throwApiError` ni la query Prisma.

### Caso de uso e invariante de negocio no se mezclan

```ts
// src/features/roadmap/domain/dependencies/would-create-cycle.ts
export function wouldCreateCycle(
  dependencies: readonly Dependency[],
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  // Recorrido puro del grafo: sin Prisma, Next.js ni transacción.
}

// src/features/roadmap/application/dependencies/create-dependency.ts
export function createDependency(command: CreateDependencyCommand) {
  return dependencyStore.read(command.courseOffering).andThen((state) => {
    if (wouldCreateCycle(state.dependencies, command.sourceNodeId, command.targetNodeId)) {
      return err(roadmapError("DEPENDENCY_CYCLE"));
    }
    return dependencyStore.create(command);
  });
}
```

La regla puede ejercerse en Vitest sin preparar Next.js ni PostgreSQL. El caso de uso concentra carga, autorización, transacción, persistencia y el `Result`; todos los entry points que crean una Dependencia reciben el mismo comportamiento sin volver a implementar el recorrido ni la traducción del fallo.

### Un único protocolo de error no filtra HTTP hacia las features

```ts
// src/features/roadmap/types.ts
export type RoadmapErrorCode =
  | "DEPENDENCY_CYCLE"
  | "HIDDEN_NODE_DEPENDENCY_FORBIDDEN"
  | "TEACHER_BLOCKED_PREREQUISITE";

// src/features/roadmap/application/dependencies/create-dependency.ts
export function createDependency(input: CreateDependencyInput) {
  return withApplicationError(() => createDependencyUnsafe(input));
}

// src/app/_adapters/http.ts
export function resultResponse(operation: () => ApplicationResult<Response>) {
  return operation().match(
    (response) => response,
    (error) => applicationErrorResponse(error),
  );
}
```

El catálogo `RoadmapErrorCode` viaja dentro del `ApplicationError` común, pero pertenece a Roadmap y no a `shared`. La feature no importa `NextResponse` ni implementa `try/catch` HTTP; el Adapter no conoce ciclos, Nodos ocultos ni Bloqueos docentes. El mismo protocolo permite que el cliente muestre un mensaje seguro sin importar el Module servidor que lo produjo.

### Page y API comparten un Resumen académico canónico

```ts
// src/app/academic-overview/page.tsx
import { AcademicOverviewView } from "@/features/academic-overview";
import { getAcademicOverview } from "@/features/academic-overview/server";
import { requireAuthenticatedUser } from "@/shared/server/session";

export default async function Page() {
  const actor = await requireAuthenticatedUser();
  const overview = await getAcademicOverview({ actor });
  return <AcademicOverviewView overview={overview} />;
}
```

```ts
// src/app/api/academic-overview/route.ts
import { getAcademicOverview } from "@/features/academic-overview/server";
import { requireAuthenticatedUser } from "@/shared/server/session";

export async function GET() {
  const actor = await requireAuthenticatedUser();
  return Response.json(await getAcademicOverview({ actor }));
}
```

Ambos callers reciben la misma reconciliación, prioridad, agrupamiento y orden. Mufasa y Prisma quedan ocultos detrás de la Interface.

### El ciclo de vida de un Recurso permanece unido

```ts
// src/features/roadmap/server.ts
import "server-only";

export { addResource } from "./application/resources/add-resource";
export { downloadResource } from "./application/resources/download-resource";
export { removeResource } from "./application/resources/remove-resource";
```

Las operaciones públicas son distintas porque corresponden a entry points distintos, pero su Implementation de aplicación comparte autorización, transacciones y limpieza best-effort. El Adapter filesystem de `infrastructure/resources` queda oculto detrás de esos casos de uso mientras sea el único Adapter real; no se crea hoy un port público de almacenamiento hipotético.

### VTI autentica; Roadmap autoriza

```ts
// src/app/api/plogin/route.ts
import { parseInstitutionalCallback, toHttpResponse } from "@/app/_adapters/http";
import { completeInstitutionalLogin } from "@/features/institutional-access/server";

export async function POST(request: Request) {
  const callback = await parseInstitutionalCallback(request);
  return toHttpResponse(await completeInstitutionalLogin({ callback }));
}
```

El Adapter extrae transporte HTTP sin validar identidad institucional. `institutional-access` consume la Interface de `integrations/vti`, valida el callback, reconcilia el Usuario y crea la sesión local. No asigna Rol de participación. Cada operación de `roadmap` autoriza al Usuario contra su Participación en el Curso correspondiente.

## Estrategia de pruebas

La ubicación acompaña al Seam probado:

- los tests Vitest de `domain/**` se colocan junto a la regla y son siempre puros: no requieren PostgreSQL, Next.js, mocks de HTTP ni filesystem; los de `application/**` prueban coordinación observable con doubles locales solo cuando ese Seam varía, y toda prueba que use persistencia, HTTP, autenticación o filesystem permanece en E2E según ADR-0004;
- una prueba colocada puede importar internals de su propio Module cuando verifica un Seam interno útil —por ejemplo, geometría o mapeo del grafo—, pero eso no convierte ese archivo en Interface pública para otros Modules;
- los casos de uso se prueban prioritariamente por su Interface pública y por resultados observables; no se apilan tests equivalentes sobre cada helper privado;
- toda prueba que ejerza persistencia, HTTP, autenticación o navegador permanece en `tests/e2e/**` con Playwright;
- E2E consume el sistema desplegado y aliases de escenario, no route handlers, Prisma ni internals de features;
- mover una Implementation dentro de una feature no debería obligar a cambiar pruebas externas si su Interface permanece estable.

## Enforcement

La política arquitectónica tendrá una única fuente canónica en ESLint 9 flat config:

1. `eslint-plugin-boundaries`, en una versión compatible con ESLint 9, clasificará todos los archivos manuales y aplicará la matriz deny-by-default;
2. reglas acotadas de `no-restricted-imports` impedirán imports profundos a features/integraciones, acceso directo a Prisma generado y contaminación Server/Client;
3. las guardas `server-only`/`client-only` harán que Next.js verifique el entorno real además de la clasificación estática;
4. `boundaries/no-unknown` y `boundaries/no-unknown-files` —o sus equivalentes vigentes— impedirán que archivos nuevos queden fuera de la política.

No se instalará simultáneamente `eslint-plugin-project-structure`: dos motores solapados producirían excepciones y diagnósticos divergentes. La versión exacta y la sintaxis compatible se verificarán al ejecutar la migración; no se copiará la configuración eslintrc/ESLint 8 de la referencia.

Las reglas estructurales se activarán al final de la migración, cuando el árbol ya cumpla la política. Hasta entonces, el lint actual debe seguir siendo una señal útil. El issue #34 definirá las etapas y verificaciones; este documento define el estado final que esas etapas deben alcanzar.

## Clasificación de la línea base hacia el objetivo

| Línea base | Dueño objetivo | Motivo |
| --- | --- | --- |
| `features/roadmap/**` | `features/roadmap/**` | Ya pertenece al slice Roadmap; se preserva el Seam estrecho de `RoadmapCanvas`. |
| `lib/roadmap-{api,editor,completion,geometry,types,access}.ts` | `features/roadmap/{application,domain,infrastructure}/**` | Los casos de uso, invariantes de visibilidad/Bloqueo/Dependencia y Adapters se separan sin salir del dueño Roadmap. |
| props hoy exportados desde `editor/types.ts` y tipos locales duplicados en `useRoadmap.ts` | su React Component o el `types.ts` de su sub-Module | Los props tienen dueño único en la presentación; tipos de inputs, DTO y grafo cambian con su Module reutilizable. |
| `ApiError`, `apiResult`, `handleApiResult` y normalización de errores repartidos en `roadmap-api.ts` y routes | `shared/errors/**` + `app/_adapters/**` | Nunca se repite wrapping de `neverthrow`; los códigos del dominio siguen perteneciendo a la feature y HTTP queda fuera de ella. |
| lógica de Recursos en routes, `roadmap-editor` y `resource-storage` | `features/roadmap/{application,infrastructure}/resources/**` | La aplicación coordina autorización, transacción y compensación; el Adapter de bytes queda reemplazable y local según ADR-0006. |
| visibilidad, Dependencias, Bloqueos docentes y sus previsualizaciones de impacto | `features/roadmap/{domain,application}/{dependencies,access,completion}/**` | Las reglas pedagógicas puras no se mezclan con consultas ni transporte; los casos de uso las reutilizan. |
| lógica duplicada de page/API de Resumen académico | `features/academic-overview/**` | Una Interface canónica elimina dos representaciones observables. |
| `lib/mufasa.ts` | `integrations/ucampus/**` | Es un Adapter de un sistema externo, no shared residual. |
| claims y protocolo VTI | `integrations/vti/**` | Traduce identidad institucional sin decidir sesión o autorización. |
| callback VTI y sesión de aplicación hoy mezclados en `app`/`auth` | `features/institutional-access/**` + `shared/server/session/**` | Separa protocolo, Usuario, sesión y Participación. |
| `components/ui/**` y `lib/utils.ts` | `shared/ui/**` y `shared/lib/**` | Son building blocks transversales ya demostrados. |
| `components/app-shell/**` | `app/_components/**`, salvo controles de desarrollo | Es composición de aplicación, no primitive compartida. |
| selector, fixtures y reset de desarrollo | `development/**` + `scripts/reset-development-data.ts` | Capacidad de soporte explícita; el entry point deja de ser biblioteca. |
| `lib/db.ts` | `shared/server/db/**` | Único Adapter técnico al cliente Prisma generado. |
| `generated/prisma/**` | `generated/prisma/**` | Conserva ubicación, pero queda aislado por política. |
| `tests/<source-path>/*.test.ts(x)` | jerarquía espejo del Module dueño | Los tests Vitest siguen el Seam sin convivir con el código de producción. |
| `tests/e2e/**` | `tests/e2e/**` | Playwright conserva el Seam del sistema desplegado. |

Este mapa define propiedad, no una secuencia de movimientos. Los cambios que mezclen responsabilidad —especialmente `roadmap-api.ts`, `auth.ts`, callback VTI, Resumen académico y Recursos— requieren extracción de Interfaces, no solo `git mv`.

## Diferencias deliberadas respecto de `parity-deals-clone`

| Tema | Referencia | Decisión de U-Roadmaps | Razón |
| --- | --- | --- | --- |
| Shared | Seis carpetas técnicas globales tratadas como un solo tipo | Un `src/shared` explícito y pequeño | Evita que `lib` o `server` sean categorías residuales. |
| Tipos | No establece una convención de propiedad para tipos reutilizados | Un `types.ts` por Module; props junto al React Component | Hace visible el dueño del tipo y evita barrels de props o nombres intercambiables. |
| Errores | No modela resultados ni una traducción de fallos | `shared/errors` con `neverthrow`; HTTP solo en `app/_adapters` | Unifica composición y serialización sin convertir los errores de cada feature en shared. |
| Dominio y aplicación | No separa reglas puras de coordinación con persistencia | Capas `domain`, `application` e `infrastructure` dentro de cada feature | Vuelve las invariantes extensibles y reutilizables sin perder la Locality del slice vertical. |
| Interfaces de feature | `app` importa internals profundos | `index.ts` y `server.ts` son las únicas Interfaces entre categorías | Reduce conocimiento de callers y permite refactorizar la Implementation. |
| Server/Client | No está expresado por la política | Entradas cliente-seguras, `server.ts`, `server-only` y reglas de grafo | U-Roadmaps ya mezcla código cliente con tipos provenientes de Modules servidor. |
| Integraciones | No existe categoría propia | `integrations/ucampus` e `integrations/vti` | Ambos protocolos externos tienen traducción y fallos propios, pero no poseen casos de uso. |
| Desarrollo | No está modelado | `src/development` y entry points separados | El fixture y reset son una capacidad sustantiva reutilizada por desarrollo/E2E. |
| `app` privado | La regla principal prohíbe casi todo `app → app` | Se permiten `_adapters` y `_components` cerrados | Next.js admite colocación privada y el shell es composición de app, no shared. |
| Persistencia | Schema y DB completos son shared; features pueden accederlos directamente | Cliente generado solo tras `shared/server/db`; queries en su feature | Mantiene una base compartida sin perder propiedad de decisiones de negocio. |
| Recursos | No hay equivalente | Ciclo completo dentro de Roadmap; Adapter filesystem privado | ADR-0006 exige autorización y limpieza conjuntas; un solo Adapter no justifica un port público. |
| Pruebas | No aparecen en el árbol ni en las reglas | Vitest colocado y E2E como categoría explícita | ADR-0004 define dos Seams y la política debe cubrir ambos. |
| Generated/tooling | La regla cubre casi solo `src` | Generated, Prisma, scripts y configuración se clasifican | La línea base tiene imports y ejecutables fuera del triángulo simple. |
| ESLint | ESLint 8/eslintrc y dos configuraciones alternativas | Un solo motor en ESLint 9 flat config, activado al cierre | Evita copiar versiones antiguas y políticas contradictorias. |

Se conserva de la referencia la pertenencia feature-first, la prohibición entre features hermanas, `app` como lugar de composición, los entry points no importables, la clasificación cerrada y las subcarpetas internas bajo demanda.

## Criterios de aceptación de la arquitectura migrada

La migración habrá alcanzado esta arquitectura cuando:

1. todo archivo manual pertenezca a una categoría explícita;
2. ningún archivo específico del Roadmap permanezca en shared;
3. page y API consuman una única Interface de Resumen académico;
4. los route handlers no contengan reglas de autorización, negocio, persistencia o compensación;
5. `app` y otros Modules crucen features solo por `index.ts` o `server.ts`;
6. no exista ningún import entre features hermanas;
7. Prisma generado sea accesible solo a través de `shared/server/db`;
8. cliente y servidor estén protegidos tanto por estructura como por el grafo real de imports;
9. reset, seed y demás ejecutables consuman Modules y no sean importados;
10. Vitest y Playwright respeten los Seams de ADR-0004;
11. cada tipo reutilizado tenga un único `types.ts` dueño y ningún prop de React salga de su `.tsx`;
12. cada Interface de servidor devuelva `neverthrow` con el protocolo de `shared/errors`, y solo `app/_adapters` traduzca el resultado a HTTP;
13. toda regla de negocio de Roadmap viva en `domain/**`, sea ejercitable sin Next.js, Prisma, red ni filesystem, y no se repita en `application`, rutas o UI;
14. los casos de uso de `application/**` coordinen autorización, transacciones y Adapters sin contener la implementación de invariantes de dominio;
15. `infrastructure/**` sea la única capa de feature que use el Adapter compartido de Prisma y los Adapters concretos, sin iniciar por sí misma un caso de uso;
16. ESLint aplique la política completa con default `disallow` y falle ante archivos desconocidos;
17. typecheck, lint, pruebas unitarias y E2E pertinentes pasen sin alterar URLs, contratos HTTP ni decisiones de los ADR.

## Decisiones que pertenecen al plan de migración

Este prototipo fija el destino, pero deja deliberadamente al issue #34:

- el orden exacto de los movimientos y extracciones;
- qué etapa introduce cada Interface pública;
- qué verificaciones focalizadas acompañan cada conjunto coherente;
- la versión compatible y configuración concreta del plugin de límites;
- el momento exacto en que se eliminan aliases temporales y se activan las reglas deny-by-default.

Esas decisiones deben preservar un proyecto verificable después de cada etapa. No deben reabrir la propiedad, la dirección de dependencias ni las excepciones cerradas definidas aquí salvo que la revisión HITL modifique expresamente esta propuesta.
