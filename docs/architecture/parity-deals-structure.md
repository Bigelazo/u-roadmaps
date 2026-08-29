# Principios arquitectónicos de `parity-deals-clone`

## Propósito y alcance

Este documento extrae la propuesta estructural de `../parity-deals-clone` para usarla como influencia arquitectónica principal de U-Roadmaps. No prescribe todavía cómo clasificar el código de U-Roadmaps: esa evaluación requiere una línea base estable y pertenece a una investigación posterior.

La evidencia se leyó en conjunto:

- la transcripción completa del video, almacenada como una única línea en `../parity-deals-clone/transcript.md`;
- las siete capturas de `../parity-deals-clone/docs/`, inspeccionadas visualmente una por una;
- el árbol actual de la rama `feature-folder-structure`, su código fuente y la comparación histórica con `main`;
- `package.json`, `package-lock.json`, las dos configuraciones ESLint, `independentModules.jsonc`, TypeScript, Tailwind, shadcn, Next.js y Drizzle.

La conclusión central es que la propuesta **no es un árbol universal de carpetas**. Es una política de pertenencia y flujo de dependencias:

```text
shared ───────────────▶ app
   │                     ▲
   └──────▶ feature ─────┘

Permitido: app → shared/feature; app compone ambos.

No permitido:
shared → feature/app
feature A → feature B
feature → app
```

Leído desde el archivo importador, el flujo permitido es:

- `shared` importa solamente `shared`;
- una `feature` importa `shared` y archivos de esa misma feature;
- `app` importa `shared` y cualquier feature para componer entry points;
- archivos ejecutables como `middleware.ts` y `tasks/**` pueden consumir building blocks, pero nadie debe importarlos.

Este flujo aparece explícitamente en la captura `../parity-deals-clone/docs/photo_4945163192602659845_x.jpg` y se codifica en `../parity-deals-clone/.eslintrc.json:38-67`.

## El problema que intenta resolver

Las primeras cuatro imágenes forman una secuencia deliberada:

1. `photo_4945163192602659836_x.jpg` muestra una interfaz mínima de tareas pendientes y su formulario.
2. `photo_4945163192602659840_y.jpg` añade las dependencias reales —componentes, obtención de usuario, lecturas/escrituras y base de datos— aunque el árbol todavía parece pequeño.
3. `photo_4945163192602659841_y.jpg` añade permisos y hace visible que una sola capacidad transversal multiplica las aristas.
4. `photo_4945163192602659842_y.jpg` añade borrado y evidencia que el número de relaciones crece más rápido que el número de archivos o carpetas.

La tesis de la transcripción es que un árbol organizado primero por tipo técnico (`components`, `actions`, `database`, `utils`) oculta esa complejidad. A medida que aparecen productos, usuarios, ventas y más dominios, cada carpeta técnica contiene partes de todos ellos y favorece dependencias bidireccionales. La captura `photo_4945163192602659843_x.jpg` representa precisamente esa matriz: cada capa técnica termina conteniendo `global`, `products`, `users`, `sales`, etc.

La respuesta de la captura `photo_4945163192602659844_x.jpg` es invertir los dos primeros niveles para el código de negocio:

```text
Antes: tipo técnico → dominio
Ahora: feature/dominio → solo los tipos técnicos que esa feature necesita
```

No se elimina la organización técnica interna; se la subordina a la pertenencia de negocio. Por eso `products` puede contener `components`, `schemas`, `server/actions` y `server/db`, mientras `users` necesita únicamente `server/db`.

## Árbol estudiado

El árbol semántico completo —sin `.git`, dependencias instaladas ni detallar el contenido de binarios o artefactos generados— es:

```text
parity-deals-clone/
├── .env.example
├── .eslintrc.alt.json
├── .eslintrc.json
├── .gitignore
├── LICENSE
├── README.md
├── components.json
├── drizzle.config.ts
├── independentModules.jsonc
├── next.config.mjs
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.ts
├── transcript.md
├── tsconfig.json
├── docs/
│   └── photo_49451631926026598{36,40,41,42,43,44,45}_*.jpg
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── sign-in/[[...sign-in]]/page.tsx
    │   │   └── sign-up/[[...sign-up]]/page.tsx
    │   ├── (marketing)/
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── api/
    │   │   ├── products/[productId]/banner/route.ts
    │   │   └── webhooks/{clerk,stripe}/route.ts
    │   ├── dashboard/
    │   │   ├── analytics/page.tsx
    │   │   ├── products/
    │   │   │   ├── [productId]/edit/page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── page.tsx
    │   │   ├── subscription/page.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── fonts/{GeistMonoVF,GeistVF}.woff
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── Banner.tsx
    │   ├── BrandLogo.tsx
    │   ├── DashboardNavBar.tsx
    │   ├── HasPermission.tsx
    │   ├── MarketingNavBar.tsx
    │   ├── NoPermissionCard.tsx
    │   ├── PageWithBackButton.tsx
    │   ├── RequiredLabelIcon.tsx
    │   ├── icons/{Clerk,Neon}.tsx
    │   └── ui/{alert-dialog,button,card,chart,dialog,dropdown-menu,form,input,label,progress,switch,tabs,textarea,toast,toaster}.tsx
    ├── data/
    │   ├── countriesByDiscount.json
    │   ├── subscriptionTiers.ts
    │   └── env/{client,server}.ts
    ├── drizzle/
    │   ├── db.ts
    │   ├── schema.ts
    │   └── migrations/
    │       ├── 0000_left_agent_zero.sql
    │       └── meta/{0000_snapshot,_journal}.json
    ├── features/
    │   ├── analytics/
    │   │   ├── components/
    │   │   │   ├── TimezoneDropdownMenuItem.tsx
    │   │   │   └── charts/{ViewsByCountryChart,ViewsByDayChart,ViewsByPPPChart}.tsx
    │   │   └── server/db/productViews.ts
    │   ├── products/
    │   │   ├── components/
    │   │   │   ├── forms/{CountryDiscountsForm,ProductCustomizationForm,ProductDeailsForm}.tsx
    │   │   │   ├── AddToSiteProductModalContent.tsx
    │   │   │   ├── DeleteProductAlertDialogContent.tsx
    │   │   │   ├── NoProducts.tsx
    │   │   │   └── ProductGrid.tsx
    │   │   ├── schemas/products.ts
    │   │   └── server/
    │   │       ├── actions/products.ts
    │   │       └── db/products.ts
    │   ├── subscriptions/server/
    │   │   ├── actions/stripe.ts
    │   │   └── db/subscription.ts
    │   └── users/server/db/users.ts
    ├── hooks/use-toast.ts
    ├── lib/{cache,formatters,permissions,utils}.ts
    ├── middleware.ts
    └── tasks/updateCountryGroups.ts
```

El reparto actual es indicativo: `analytics` tiene 5 archivos, `products` 10, `subscriptions` 2 y `users` 1. Una feature no recibe carpetas vacías para satisfacer una plantilla.

## Responsabilidad de cada zona

### `src/features/<feature>`: cohesión vertical

Cada feature reúne presentación, validación, operaciones de servidor y persistencia que cambian por la misma razón de negocio:

- `products` une formularios y componentes con schemas Zod, server actions y queries/mutations Drizzle;
- `analytics` une visualizaciones y agregaciones de product views;
- `subscriptions` une Stripe y persistencia de la suscripción;
- `users` solo contiene la operación de borrado que el ejemplo necesita.

El código confirma la intención. Por ejemplo, los formularios de producto consumen schemas y actions de la misma familia (`../parity-deals-clone/src/features/products/components/forms/ProductDeailsForm.tsx:18-23`), y las actions consumen schemas y DB de `products` (`../parity-deals-clone/src/features/products/server/actions/products.ts:3-18`). No existe ningún import directo `features/<A> → features/<B>`.

La regla útil no es “toda feature tiene el mismo esqueleto”, sino “todo artefacto específico de una feature vive bajo su dueño y cada feature crea únicamente las capas que necesita”.

### `src/components`, `data`, `drizzle`, `hooks`, `lib`: shared

Son building blocks potencialmente utilizables desde más de una feature o entry point:

- primitives y composición UI reusable en `components`, incluida la biblioteca shadcn en `components/ui`;
- configuración y catálogos transversales en `data`;
- cliente, schema y migraciones compartidos de Drizzle;
- hooks genéricos;
- cache, formato y utilidades.

“Shared” es una afirmación arquitectónica, no un cajón residual. Una pieza debería entrar aquí porque no pertenece a una sola capacidad y puede existir sin conocer features ni rutas.

### `src/app`: entry points y composición

`app` conserva los archivos especiales del App Router, layouts, páginas y route handlers. Estos autentican, interpretan parámetros, seleccionan capacidades y ensamblan UI/operaciones de una o varias features. Ejemplos claros:

- `dashboard/page.tsx` compone `analytics` y `products` (`../parity-deals-clone/src/app/dashboard/page.tsx:7-15`);
- `dashboard/subscription/page.tsx` agrega `subscriptions`, `products` y `analytics` (`../parity-deals-clone/src/app/dashboard/subscription/page.tsx:18-29`);
- el webhook de Clerk coordina `subscriptions` y `users` (`../parity-deals-clone/src/app/api/webhooks/clerk/route.ts:4-10`);
- el endpoint del banner coordina `products`, `analytics` y permisos (`../parity-deals-clone/src/app/api/products/[productId]/banner/route.ts:1-9`).

Esto justifica que `app` sea la capa superior autorizada a unir features independientes.

### `src/middleware.ts` y `src/tasks/**`: entry points no importables

La configuración principal los llama `neverImport`: pueden importar `shared` y `feature`, pero ningún tipo puede importarlos. El nombre describe su visibilidad de entrada, no que ellos carezcan de imports. `updateCountryGroups.ts`, por ejemplo, consume DB, datos y schema compartidos (`../parity-deals-clone/src/tasks/updateCountryGroups.ts:1-4`).

## Principios generalizables y elecciones particulares

| Generalizable | Elección específica del ejemplo |
|---|---|
| Organizar primero por capacidad de negocio cuando el código sea específico de ella. | Las features concretas son `analytics`, `products`, `subscriptions` y `users`. |
| Colocar juntas las partes que cambian por la misma razón. | Dentro de `products` se usan `components`, `schemas`, `server/actions` y `server/db`. |
| Mantener una capa shared independiente de features y entry points. | Shared se materializa como `components`, `data`, `drizzle`, `hooks`, `lib` y un `server` actualmente inexistente. |
| Reservar la capa de aplicación para routing, protocolos y composición. | Se usa Next.js App Router con route groups `(auth)` y `(marketing)`, dashboard y route handlers. |
| Prohibir dependencias entre features hermanas. | La implementación identifica la familia mediante el nombre del primer directorio bajo `src/features`. |
| Tratar scripts/middleware como entry points, no bibliotecas. | Los patrones concretos son `src/*` y `src/tasks/**/*`. |
| Hacer que toda fuente quede clasificada; fallar de forma cerrada ante archivos nuevos. | El alcance se limita a `src/**/*` y el CSS global recibe una excepción específica. |
| Crear subcarpetas solo cuando existen artefactos de ese tipo. | `users` contiene solo `server/db`; no replica carpetas vacías. |
| Automatizar los límites después de alcanzar la forma objetivo. | El repositorio ofrece dos plugins/configuraciones alternativas de ESLint 8 en formato eslintrc. |

También son elecciones, no principios: Clerk, Stripe, Neon, Drizzle, Zod, Tailwind, shadcn, el alias `@/* → ./src/*` (`../parity-deals-clone/tsconfig.json:21-23`) y el uso de `src/app/globals.css` en shadcn (`../parity-deals-clone/components.json:6-18`).

## Flujo de dependencias comprobado

| Importador | Puede importar | No puede importar |
|---|---|---|
| `shared` | `shared` | `feature`, `app`, entry points |
| `feature X` | `shared`, `feature X` | otra feature, `app`, entry points |
| `app` | `shared`, cualquier feature, CSS de `app` | otros archivos `app` salvo la excepción CSS según la política principal |
| `neverImport` | `shared`, cualquier feature | `app`, otro `neverImport` |

Observaciones del código:

- Las diez referencias feature-a-feature encontradas dentro de `src/features` permanecen en la misma familia: nueve en `products` y una en `subscriptions`.
- `src/app` sí importa múltiples features, como corresponde a la capa de composición.
- No hay imports hacia `app`, `tasks` ni `middleware` desde el resto del código.
- Hay una excepción real: `src/lib/permissions.ts` —clasificado como shared— importa DB de `products`, `analytics` y `subscriptions` (`../parity-deals-clone/src/lib/permissions.ts:1-4`). Este punto se analiza más adelante.

La política se ocupa de dependencias estáticas entre archivos, no de propiedad exclusiva de datos. `users/server/db/users.ts`, por ejemplo, borra filas de productos y suscripciones mediante tablas expuestas por el schema Drizzle shared (`../parity-deals-clone/src/features/users/server/db/users.ts:1-20`). Por tanto, “features independientes” significa aquí **independencia de imports directos entre sus carpetas**, no bounded contexts ni almacenamiento aislado.

## La refactorización histórica como evidencia

La comparación `main..feature-folder-structure` del repositorio de referencia muestra 24 renombres detectables entre 82 % y 100 % de similitud. Entre ellos:

- los componentes específicos que estaban en `app/dashboard/_components` se movieron a `features/products/components` o `features/analytics/components`;
- `src/server/db/*`, `src/server/actions/*` y `src/schemas/products.ts` se repartieron entre features;
- navbars, iconos y `PageWithBackButton` que sí eran compartidos se movieron desde carpetas privadas de rutas a `src/components`;
- `src/server/permissions.ts` pasó a `src/lib/permissions.ts`.

Muchos movimientos presentan 100 % de similitud; los demás cambian principalmente imports. Esto respalda la afirmación de la transcripción de que la primera migración fue mayormente mecánica y basada en pertenencia. También exhibe dónde la estructura fuerza decisiones que un simple movimiento no resuelve: permisos.

## ESLint: dependencias y versiones exactas

`package.json` declara (`../parity-deals-clone/package.json:50-63`):

| Paquete | Rango declarado | Versión resuelta en `package-lock.json` |
|---|---:|---:|
| `eslint` | `^8` | `8.57.1` |
| `eslint-config-next` | `14.2.11` | `14.2.11` |
| `eslint-plugin-boundaries` | `^4.2.2` | `4.2.2` |
| `eslint-plugin-import` | `^2.31.0` | `2.31.0` |
| `eslint-plugin-project-structure` | `^3.8.1` | `3.8.1` |

Las entradas resueltas están en `../parity-deals-clone/package-lock.json:4004-4005`, `:4060-4061`, `:4300-4301`, `:4357-4358` y `:4455-4456`.

El README presenta `boundaries` y `project-structure` como **alternativas**: se elige una configuración, no se ejecutan ambas simultáneamente (`../parity-deals-clone/README.md:5-23`). `eslint-plugin-import` está instalado pero ninguna de las dos configuraciones lo registra ni activa una regla suya. La transcripción solo lo menciona como otra familia de herramientas posible.

### Configuración principal: `eslint-plugin-boundaries`

Base y alcance (`../parity-deals-clone/.eslintrc.json:1-37`):

- extiende exactamente `next/core-web-vitals` y `next/typescript`;
- registra el plugin `boundaries`;
- analiza `boundaries/include: ["src/**/*"]`;
- clasifica elementos en modo `full`:

| Tipo | Pattern exacto | Capture |
|---|---|---|
| `shared` | `src/components/**/*`, `src/data/**/*`, `src/drizzle/**/*`, `src/hooks/**/*`, `src/lib/**/*`, `src/server/**/*` | — |
| `feature` | `src/features/*/**/*` | `featureName` |
| `app` | `src/app/**/*` | `_`, `fileName` |
| `neverImport` | `src/*`, `src/tasks/**/*` | — |

Reglas exactas (`../parity-deals-clone/.eslintrc.json:38-67`):

- `boundaries/no-unknown: ["error"]`: no se puede importar un elemento sin clasificar;
- `boundaries/no-unknown-files: ["error"]`: todo archivo incluido debe pertenecer a un tipo;
- `boundaries/element-types: ["error", {...}]` con `default: "disallow"` y estas únicas autorizaciones:
  - `from: ["shared"]`, `allow: ["shared"]`;
  - `from: ["feature"]`, `allow: ["shared", ["feature", { "featureName": "${from.featureName}" }]]`;
  - `from: ["app", "neverImport"]`, `allow: ["shared", "feature"]`;
  - `from: ["app"]`, `allow: [["app", { "fileName": "*.css" }]]`.

Detalles importantes:

- La igualdad capturada de `featureName` es el mecanismo que permite imports internos de la misma feature y rechaza imports entre hermanas.
- La política es deny-by-default; añadir una categoría no basta, también hay que autorizar sus aristas.
- Ninguna categoría puede importar `neverImport`, porque nunca aparece como destino permitido.
- `app → app` queda denegado salvo CSS. Los imports relativos que Next.js genera implícitamente entre layouts/pages no son imports de código y no requieren una excepción.
- Los paquetes externos no son elementos internos de estos patrones; esta regla no define una política de dependencias npm.

### Configuración alternativa: `eslint-plugin-project-structure`

`.eslintrc.alt.json` (`../parity-deals-clone/.eslintrc.alt.json:1-10`):

- extiende los mismos presets Next;
- registra exactamente `eslint-plugin-project-structure`;
- apunta `project-structure/independent-modules-config-path` a `independentModules.jsonc`;
- activa `project-structure/independent-modules: "error"`.

`independentModules.jsonc` define, en orden (`../parity-deals-clone/independentModules.jsonc:1-62`):

1. **App folder**, `src/app/**`: permite `src/app/globals.css`, `{sharedImports}` y `src/features/**`.
2. **Features**, `src/features/**`: permite `{family_3}/**` —la propia familia— y `{sharedImports}`; incluye un mensaje explícito contra imports entre features.
3. **Permissions file**, `src/lib/permissions.ts`: permite solo `src/features/**/db/**`.
4. **Shared**: usa los mismos seis grupos del tipo shared de Boundaries y permite `{sharedImports}`.
5. **Unknown files**, patrón `[["src/**", "!src/tasks/*", "!src/*"]]`: no permite imports, fija `allowExternalImports: false` y explica que el archivo no fue clasificado.

`reusableImportPatterns.sharedImports` expande exactamente a:

```text
src/components/**
src/data/**
src/drizzle/**
src/hooks/**
src/lib/**
src/server/**
```

Esta alternativa expresa el mismo triángulo, pero difiere en aspectos materiales:

- permite imports internos de `app` únicamente hacia `globals.css`, no cualquier CSS capturado;
- excluye `src/tasks/*` y archivos directamente bajo `src/*` del catch-all, en vez de tiparlos como entry points consumidores;
- introduce una excepción para `permissions.ts` que la configuración Boundaries no contiene;
- solo `Unknown files` declara de forma explícita `allowExternalImports: false`.

### Compatibilidad y activación tardía

El ejemplo usa Next `14.2.11`, ESLint 8, eslintrc y el script `next lint` (`../parity-deals-clone/package.json:6-15,38,55-59`). Su README advierte que `eslint-plugin-boundaries` anterior a 5.0.0 no soporta ESLint 9 (`../parity-deals-clone/README.md:12-18`). En consecuencia, deben heredarse **las invariantes**, no copiarse versiones ni sintaxis sin contrastarlas con el stack objetivo.

También confirma la secuencia acordada para U-Roadmaps: las reglas estructurales deny-by-default deben activarse al final de la migración. Activarlas antes convertiría cada archivo aún no movido en un error y eliminaría la señal útil del lint durante las etapas intermedias.

## La tensión de `permissions.ts`

Es el caso más instructivo del ejemplo.

`permissions.ts` se presenta como shared, pero calcula capacidades consultando tres features (`products`, `analytics`, `subscriptions`). Esto viola literalmente `shared → shared` de la configuración Boundaries. La transcripción reconoce que fue el único punto que no podía quedar limpio mediante movimientos sin cambiar diseño, y propone dos salidas:

- pasar a cada permiso los datos ya obtenidos, eliminando su dependencia de persistencia;
- mover cada política a la feature que la posee.

La configuración alternativa no resuelve el acoplamiento; lo admite con una excepción estrecha a `src/features/**/db/**` (`independentModules.jsonc:21-26`). Además, `products/server/actions/products.ts` importa permisos shared (`:18`), mientras esos permisos importan DB de `products` (`permissions.ts:2`), formando un ciclo arquitectónico feature → shared → feature aunque no necesariamente un ciclo de módulos ejecutado en el mismo camino.

Para una adopción futura, este caso enseña que una regla puede:

- revelar una responsabilidad mal ubicada;
- motivar inyección de datos o políticas locales;
- o documentar una excepción temporal y estrecha.

No enseña que convenga ensanchar `shared` cada vez que aparezca coordinación entre features.

## Relación entre transcripción, imágenes y código

| Explicación | Evidencia visual | Evidencia en el proyecto |
|---|---|---|
| Un árbol pequeño puede ocultar muchas relaciones. | `9836`, `9840`, `9841`, `9842` aumentan aristas sin aumentar proporcionalmente carpetas. | El estado previo en `main` repartía producto/analytics entre `app/dashboard/_components`, `schemas` y `server`. |
| Las carpetas técnicas globales mezclan dominios. | `9843` cruza capas técnicas con global/products/users/sales. | En `main`, `src/server/db` contenía products, product views, subscriptions y users. |
| Invertir a feature-first recupera cohesión. | `9844` pone las capas técnicas dentro de cada feature. | La rama estudiada crea cuatro familias bajo `src/features`. |
| Shared es inferior e independiente; app es superior y compone. | `9845` dibuja shared → features/app y features → app. | `.eslintrc.json` codifica esas aristas; las páginas y handlers importan múltiples features. |
| Las carpetas internas son opcionales. | La narración indica que cada feature repite solo lo necesario. | `products` tiene cuatro clases de artefactos; `users` solo DB. |
| Los límites exponen coordinadores mal ubicados. | No existe una captura específica; aparece al final de la narración. | `lib/permissions.ts` contradice la política principal y recibe una excepción en la alternativa. |

Los sufijos abreviados de la tabla corresponden a los nombres completos `photo_49451631926026598xx_*.jpg` en `../parity-deals-clone/docs/`.

## Limitaciones y aspectos que no deben copiarse literalmente

1. **La implementación no alcanza por completo su ideal.** `app` contiene páginas extensas y helpers de presentación locales; `(marketing)/page.tsx` tiene 250 líneas y `dashboard/analytics/page.tsx` 221. Es composición válida, pero no prueba que `app` sea siempre delgado.
2. **No hay interfaces públicas de feature.** `app` importa rutas internas como `features/products/server/db/products` y `features/products/components/forms/...`. La política evita cruces laterales, pero no encapsula internals ni ofrece un API estable por feature.
3. **El schema compartido debilita la propiedad de dominio.** Analytics, products y users acceden a tablas comunes; `users` opera datos de otras capacidades sin importarlas directamente.
4. **Shared es amplio.** La configuración trata todo `components`, `data`, `drizzle`, `hooks`, `lib` y `server` como un único tipo capaz de importarse libremente. No distingue client/server, infraestructura, dominio compartido ni UI primitives.
5. **Los límites no expresan entorno de ejecución.** No separan imports exclusivos de servidor de Client Components; eso depende de Next.js y convenciones adicionales.
6. **Los dos plugins no son equivalentes.** Sus excepciones, tratamiento de entry points y CSS difieren. Activarlos a la vez sin una fuente canónica duplicaría reglas y podría producir políticas contradictorias.
7. **La configuración principal actualmente rechazaría el archivo de permisos según sus propias reglas.** No se ejecutó lint porque el checkout de referencia no contiene `node_modules`; la contradicción se deduce directamente de patterns/imports y está reconocida en la transcripción.
8. **La referencia tecnológica está fechada.** Usa ESLint 8/eslintrc/`next lint`; una adopción moderna puede requerir flat config y versiones compatibles.
9. **No hay tests en el árbol.** La referencia no decide dónde viven pruebas unitarias, integración o E2E, ni cómo se aplican los límites a ellas.
10. **No existe una regla de exportación o de nomenclatura.** Hay incluso el typo `ProductDeailsForm.tsx`; la estructura de dependencias no garantiza consistencia nominal.
11. **La feature es una unidad pragmática, no un bounded context completo.** No hay contratos, eventos o anti-corruption layers entre dominios porque, sencillamente, se prohíben imports laterales.
12. **La regla cubre `src`, no toda la configuración del repositorio.** Archivos raíz como `drizzle.config.ts` importan código de `src` (`../parity-deals-clone/drizzle.config.ts:1-12`) pero quedan fuera de `boundaries/include`.

## Guidelines adaptables para la futura estructura objetivo

Sin clasificar aún ningún archivo de U-Roadmaps, el caso de estudio justifica estas guidelines:

1. La primera pregunta para cada archivo debe ser “¿qué capacidad lo posee?”, no “¿es componente, action o utilidad?”.
2. Una capacidad específica debe reunir UI, validación, aplicación y acceso a datos que evolucionan juntos.
3. Las subcarpetas técnicas dentro de una feature son optativas y aparecen bajo demanda.
4. `app` debe representar rutas, protocolos y composición entre capacidades; el dominio reusable no debe nacer dentro del árbol de rutas.
5. Shared debe reservarse a primitives e infraestructura realmente transversales y no depender de features.
6. Las features hermanas no se importan. La coordinación multi-feature vive en una capa superior explícita o consume contratos/datos que no inviertan la dependencia.
7. Scripts, middleware y otros ejecutables son entry points consumidores y no superficies de reutilización.
8. Toda fuente nueva debe quedar clasificada; la política final debe ser deny-by-default.
9. Excepciones como permisos deben ser decisiones explícitas, estrechas y, si son transitorias, removibles; nunca huecos silenciosos.
10. La configuración final debe cubrir alias, imports relativos y los entornos que existan en el proyecto objetivo.
11. Debe definirse si las features exponen una API pública o si se toleran imports a internals; el ejemplo no resuelve esa decisión.
12. La migración debe ser incremental por límites coherentes, pero los plugins estructurales deben instalarse/activarse cuando el árbol ya satisfaga la política, manteniendo lint útil durante la transición.

## Decisiones que esta investigación deja abiertas

El caso de estudio aporta el modelo, pero no responde por sí solo:

- cuáles son las features y cuáles son responsabilidades shared de U-Roadmaps;
- si U-Roadmaps necesita una capa superior adicional para workflows multi-feature;
- si se permitirá importar internals de cada feature o se exigirá una API pública;
- cómo clasificar tests, fixtures, scripts, generated code y configuración raíz;
- cuál plugin será la fuente canónica, o qué responsabilidad no solapada tendría cada uno si se instalan ambos;
- cómo expresar la misma política en las versiones y formato ESLint que use la línea base estable.

Estas preguntas deben resolverse al analizar el proyecto objetivo; no son razones para debilitar el principio principal de cohesión por feature y dependencias unidireccionales.
