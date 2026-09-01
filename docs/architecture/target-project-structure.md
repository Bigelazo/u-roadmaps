# Arquitectura objetivo de U-Roadmaps

## Estado y alcance

Esta propuesta responde el [issue #33](https://github.com/Bigelazo/u-roadmaps/issues/33). Combina la influencia principal de [`parity-deals-clone`](./parity-deals-structure.md), las [convenciones oficiales de Next.js](./nextjs-project-structure.md) y el [diagnóstico de la línea base estable](./current-u-roadmaps-structure.md). Su estado es **propuesto y pendiente de revisión HITL**: define la forma que deberá aprobarse antes de preparar la secuencia de migración del issue #34.

El objetivo no es maximizar carpetas ni aplicar una plantilla uniforme. Es recuperar **Locality** por capacidad y **Depth** en sus Interfaces: `app` y las pruebas deben poder ejercer casos de uso completos sin conocer Prisma, protocolos institucionales, almacenamiento, validadores ni detalles internos del grafo pedagógico.

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
│   │   │   ├── contracts.ts            DTO propios, sin Prisma ni Next.js
│   │   │   ├── components/**
│   │   │   └── server/**                reconciliación, prioridad y consultas
│   │   ├── institutional-access/
│   │   │   ├── index.ts
│   │   │   ├── server.ts
│   │   │   ├── components/**
│   │   │   └── server/**                login local, Usuario y transacción VTI
│   │   └── roadmap/
│   │       ├── index.ts                 RoadmapCanvas y contratos cliente-seguros
│   │       ├── server.ts                casos de uso públicos de servidor
│   │       ├── contracts.ts             identidad, comandos, DTO y errores propios
│   │       ├── client/**                 carga y mutaciones HTTP
│   │       ├── editor/**
│   │       ├── graph/**
│   │       ├── student/**
│   │       └── server/
│   │           ├── roadmap/**            lectura, creación y representación por Rol
│   │           ├── editor/**             Nodo, Tipo de nodo y Dependencia
│   │           ├── completion/**         invariantes de Completación
│   │           ├── resources/**          autorización, bytes y compensación
│   │           └── participation/**      autorización dentro del Curso
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

Una feature reúne presentación, contratos, reglas, casos de uso y queries que cambian por una misma capacidad del producto. La clasificación inicial es:

- `roadmap`: experiencia del Roadmap completa, incluidos grafo, edición, representación por Rol de participación, Completación y ciclo de vida del Recurso;
- `academic-overview`: representación canónica del Resumen académico, incluida la reconciliación entre U-Campus y datos locales, prioridad, agrupamiento y orden;
- `institutional-access`: inicio y término de la sesión local, consumo de la identidad VTI y reconciliación del Usuario. No posee Participaciones ni autorización académica.

Una feature expone como máximo dos puntos de entrada externos:

- `index.ts`: Interface cliente-segura. Puede exportar componentes, DTO y tipos sin dependencias de servidor;
- `server.ts`: Interface de servidor, con `import "server-only"`, que exporta casos de uso completos.

`app`, `development` y configuración raíz solo importan esos puntos de entrada. Un barrel público nunca reexporta Prisma, un Adapter externo ni un archivo `server/**`. Los imports profundos dentro de una feature están reservados a su propia Implementation y a sus pruebas colocadas.

Esta separación evita convertir un nuevo `index.ts` en la misma Interface de 25 exports que hoy presenta `roadmap-api.ts`. El punto de entrada del servidor expone operaciones de aplicación, no parsers, serializers, queries auxiliares ni tipos de persistencia.

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

Aquí pertenecen las primitives shadcn propias, utilidades puras, la identidad neutral de un Curso y el acceso técnico compartido a sesión, entorno y cliente de base de datos. Las queries de negocio no pertenecen a `shared/server/db`: permanecen en la feature que posee la decisión que representan.

El schema Prisma puede continuar centralizado porque la línea base usa una sola base y no se están declarando bounded contexts ni almacenamiento aislado. Esa elección no vuelve shared a todas las operaciones sobre sus tablas.

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
2. Si implementa una regla, representación o caso de uso de una sola capacidad, vive en esa feature, aunque técnicamente sea UI, validación o persistencia.
3. Si traduce un protocolo externo que U-Roadmaps no controla, vive en `integrations/<provider>`.
4. Si es independiente de capacidades y ya tiene reutilización transversal real, vive en `shared`.
5. Si solo existe para datos, UI o ejecución local/E2E, vive en `development` o `tests/e2e`, según quién lo ejecute.
6. Si es generado, migración, seed, script o configuración, conserva su categoría explícita y no se presenta como biblioteca.
7. Si ninguna categoría aplica, el archivo queda sin clasificar y el lint falla. No se crea una carpeta `lib` genérica para silenciar la decisión.

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

Excepciones cerradas:

1. `src/shared/server/db/** → src/generated/prisma/**` es la única entrada manual a Prisma generado.
2. Los archivos especiales de `app` pueden importar `app/globals.css`, `app/_adapters/**` y `app/_components/**`; esos auxiliares nunca son importables fuera de `app`.
3. La ruta local de reset y la composición visual del selector pueden importar las Interfaces públicas de `development`, siempre protegidas por las guardas de entorno existentes.
4. Los archivos de declaración como `src/types/next-auth.d.ts` pueden ampliar el paquete que declaran, pero no se usan como Modules de aplicación.

No se permiten excepciones anchas como `shared → features/**`. Si una coordinación necesita cruzar features, `app` compone sus Interfaces públicas o se revisa la propiedad del conocimiento; no se transforma `shared` en un coordinador circular.

## Invariantes Server/Client

La carpeta comunica intención, pero el grafo real de módulos es la autoridad:

- todo punto de entrada `server.ts` y todo acceso a Prisma, sesión, secretos, filesystem, Mufasa o VTI importa `server-only`;
- `'use client'` se coloca en la raíz interactiva más pequeña posible, no en el barrel completo de una feature;
- módulos exclusivamente de navegador pueden usar `client-only` cuando su consumo incorrecto no sea evidente;
- `index.ts` y `contracts.ts` de una feature no importan ni reexportan `server.ts`, `server/**`, Prisma, `next/server` o variables privadas;
- un Client Component no importa módulos `server/**`, ni siquiera solo para reutilizar tipos; los contratos cliente-seguros viven fuera del subárbol servidor;
- DTO cruzan el Seam; modelos Prisma, `fileKey`, secretos y objetos de transporte externos no lo cruzan;
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

El Adapter conoce HTTP y la Interface pública. `updateNode` posee validación, autorización docente, pertenencia del Nodo, concurrencia y transacción. No se exportan por separado `parseCourseOffering`, `requireTeacher`, `throwApiError` ni la query Prisma.

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

export { addResource } from "./server/resources/add-resource";
export { downloadResource } from "./server/resources/download-resource";
export { removeResource } from "./server/resources/remove-resource";
```

Las operaciones públicas son distintas porque corresponden a entry points distintos, pero su Implementation privada comparte autorización, almacenamiento protegido, transacciones y limpieza best-effort. El Adapter filesystem permanece dentro de `roadmap` mientras sea el único uso real; no se crea hoy un port público de almacenamiento hipotético.

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

- los tests Vitest se colocan junto al Module bajo `src/**` como `*.test.ts(x)`; siguen siendo puros y no requieren PostgreSQL ni Next.js, según ADR-0004;
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
| `lib/roadmap-{api,editor,completion,geometry,types}.ts` | `features/roadmap/**` | UI, contratos, invariantes y persistencia cambian por la misma capacidad. |
| lógica de Recursos en routes, `roadmap-editor` y `resource-storage` | `features/roadmap/server/resources/**` | Recupera Locality para autorización, bytes, compensación y limpieza de ADR-0006. |
| lógica duplicada de page/API de Resumen académico | `features/academic-overview/**` | Una Interface canónica elimina dos representaciones observables. |
| `lib/mufasa.ts` | `integrations/ucampus/**` | Es un Adapter de un sistema externo, no shared residual. |
| claims y protocolo VTI | `integrations/vti/**` | Traduce identidad institucional sin decidir sesión o autorización. |
| callback VTI y sesión de aplicación hoy mezclados en `app`/`auth` | `features/institutional-access/**` + `shared/server/session/**` | Separa protocolo, Usuario, sesión y Participación. |
| `components/ui/**` y `lib/utils.ts` | `shared/ui/**` y `shared/lib/**` | Son building blocks transversales ya demostrados. |
| `components/app-shell/**` | `app/_components/**`, salvo controles de desarrollo | Es composición de aplicación, no primitive compartida. |
| selector, fixtures y reset de desarrollo | `development/**` + `scripts/reset-development-data.ts` | Capacidad de soporte explícita; el entry point deja de ser biblioteca. |
| `lib/db.ts` | `shared/server/db/**` | Único Adapter técnico al cliente Prisma generado. |
| `generated/prisma/**` | `generated/prisma/**` | Conserva ubicación, pero queda aislado por política. |
| `tests/*.test.ts(x)` | junto al Module dueño | Los tests Vitest siguen el Seam y dejan la carpeta técnica plana. |
| `tests/e2e/**` | `tests/e2e/**` | Playwright conserva el Seam del sistema desplegado. |

Este mapa define propiedad, no una secuencia de movimientos. Los cambios que mezclen responsabilidad —especialmente `roadmap-api.ts`, `auth.ts`, callback VTI, Resumen académico y Recursos— requieren extracción de Interfaces, no solo `git mv`.

## Diferencias deliberadas respecto de `parity-deals-clone`

| Tema | Referencia | Decisión de U-Roadmaps | Razón |
| --- | --- | --- | --- |
| Shared | Seis carpetas técnicas globales tratadas como un solo tipo | Un `src/shared` explícito y pequeño | Evita que `lib` o `server` sean categorías residuales. |
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
11. ESLint aplique la política completa con default `disallow` y falle ante archivos desconocidos;
12. typecheck, lint, pruebas unitarias y E2E pertinentes pasen sin alterar URLs, contratos HTTP ni decisiones de los ADR.

## Decisiones que pertenecen al plan de migración

Este prototipo fija el destino, pero deja deliberadamente al issue #34:

- el orden exacto de los movimientos y extracciones;
- qué etapa introduce cada Interface pública;
- qué verificaciones focalizadas acompañan cada conjunto coherente;
- la versión compatible y configuración concreta del plugin de límites;
- el momento exacto en que se eliminan aliases temporales y se activan las reglas deny-by-default.

Esas decisiones deben preservar un proyecto verificable después de cada etapa. No deben reabrir la propiedad, la dirección de dependencias ni las excepciones cerradas definidas aquí salvo que la revisión HITL modifique expresamente esta propuesta.
