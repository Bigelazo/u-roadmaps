# Convenciones oficiales de estructura de proyectos Next.js

## Propósito y alcance

Este documento identifica qué exige, qué permite y qué no prescribe Next.js al organizar una aplicación con App Router. Su propósito es acotar una futura arquitectura de U-Roadmaps, no definirla ni evaluar la estructura actual del proyecto. La estructura objetivo deberá decidirse al contrastar estos límites con el caso de estudio principal y con las necesidades del producto.

La investigación usa exclusivamente documentación oficial vigente de Next.js, comenzando por [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure). La documentación declara expresamente que Next.js no toma partido por una única forma de organizar o colocar los archivos de un proyecto y ofrece varias estrategias de ejemplo; por eso conviene interpretar sus ejemplos como posibilidades compatibles con el framework, no como una arquitectura recomendada de forma universal.

## Resumen ejecutivo

Next.js prescribe la parte de la estructura que constituye su interfaz con el framework: dónde vive el App Router, cómo los directorios forman segmentos de URL, cuáles nombres de archivo tienen semántica especial, cómo debe existir un layout raíz y qué carpetas o archivos deben permanecer en la raíz cuando se usa `src`. Fuera de esa interfaz, permite elegir entre código compartido fuera de `app`, código compartido dentro de `app` o una combinación global y colocada por ruta/feature. Los nombres genéricos de carpetas —por ejemplo, `components`, `lib`, `ui`, `utils`, `hooks` o `styles`— no tienen significado especial para Next.js. ([Project Structure: Organizing your project](https://nextjs.org/docs/app/getting-started/project-structure#organizing-your-project), [Project Structure: Examples](https://nextjs.org/docs/app/getting-started/project-structure#examples))

Por tanto, la documentación oficial debe actuar como un conjunto de invariantes y herramientas. No decide la dirección de dependencias, las capas del dominio, el alcance de una feature, las APIs públicas de los módulos ni la política de imports; esas decisiones deberán provenir del diseño arquitectónico posterior y podrán hacerse exigibles con ESLint.

## 1. Convenciones y restricciones obligatorias

### 1.1 El sistema de archivos forma parte del contrato de routing

App Router usa enrutamiento basado en el sistema de archivos. Dentro de `app`, cada carpeta normal representa un segmento de ruta y su anidación representa la anidación de la URL. Un segmento solo se vuelve públicamente accesible cuando contiene un `page` o un `route`; el resto de los archivos colocados allí no se convierten por sí solos en endpoints públicos. ([Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Project Structure: Colocation](https://nextjs.org/docs/app/getting-started/project-structure#colocation))

Los segmentos dinámicos también se expresan mediante nombres de carpeta reservados: `[segment]` para un parámetro, `[...segment]` para un *catch-all* y `[[...segment]]` para un *catch-all* opcional. Cambiar esos nombres no es una reorganización interna neutra: cambia el contrato de URL y los parámetros inferidos por Next.js. ([Project Structure: Dynamic routes](https://nextjs.org/docs/app/getting-started/project-structure#dynamic-routes))

**Implicación para la refactorización:** los movimientos dentro del árbol de rutas deben clasificarse aparte de los movimientos de módulos internos. Un movimiento de segmento normal puede alterar URLs; uno de archivos colocados que no sean especiales puede ser arquitectónico sin alterar el routing.

### 1.2 Los archivos especiales tienen semántica y jerarquía definidas

Nombres como `layout`, `page`, `loading`, `not-found`, `error`, `global-error`, `route`, `template` y `default` son convenciones del framework. Next.js también define convenciones especiales para metadatos como iconos, imágenes Open Graph, `robots` y `sitemap`. En cada segmento, los componentes especiales se componen siguiendo una jerarquía conocida y los layouts se anidan recursivamente con los segmentos hijos. ([Project Structure: Routing Files](https://nextjs.org/docs/app/getting-started/project-structure#routing-files), [Project Structure: Component hierarchy](https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy), [Project Structure: Metadata file conventions](https://nextjs.org/docs/app/getting-started/project-structure#metadata-file-conventions))

El layout raíz es obligatorio para las rutas que cubre y debe producir las etiquetas `html` y `body`. Normalmente es `app/layout`, aunque también es válido omitir el layout superior y tener varios layouts raíz bajo grupos o subdirectorios; en ese caso, cada árbol debe cumplir el contrato de layout raíz. ([Layouts and Pages: Creating a layout](https://nextjs.org/docs/app/getting-started/layouts-and-pages#creating-a-layout), [layout.js: Root Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout#root-layout))

**Implicación para la refactorización:** los archivos especiales deben seguir siendo adaptadores reconocibles por Next.js. Extraer lógica desde ellos es posible, pero renombrarlos, cambiar su ubicación o repartir layouts entre grupos puede modificar la composición, el manejo de errores, el streaming o la navegación.

### 1.3 Usar `src` es opcional, pero tiene reglas de ubicación

Next.js admite `app` tanto en la raíz como en `src/app`. Si existe un `app` raíz, `src/app` se ignora. Al optar por `src`, `public`, `package.json`, `next.config`, `tsconfig` y los archivos `.env.*` permanecen en la raíz; `proxy` debe vivir dentro de `src`. Los alias de TypeScript y cualquier configuración de búsqueda de archivos —la documentación menciona Tailwind como ejemplo— deben actualizarse para incluir `src`. ([src Folder](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder))

**Implicación para la refactorización:** adoptar o mantener `src` es una decisión binaria que debe aplicarse de forma coherente. No pueden coexistir dos árboles `app` esperando que Next.js combine ambos.

### 1.4 La frontera Server/Client depende del grafo de módulos, no de una carpeta

Los layouts y pages son Server Components por defecto. La directiva `'use client'` declara una frontera en el grafo de módulos: el archivo marcado, sus imports y los componentes que renderiza directamente pasan a formar parte del bundle cliente. Next.js aconseja situar esa frontera en componentes interactivos específicos para no convertir innecesariamente grandes áreas de UI en código cliente. ([Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Reducing JS bundle size](https://nextjs.org/docs/app/getting-started/server-and-client-components#reducing-js-bundle-size))

Los módulos sensibles al entorno pueden marcarse mediante imports de `server-only` o `client-only`; Next.js produce un error de compilación cuando se importan desde el entorno incorrecto. La instalación explícita de esos paquetes es opcional. ([Preventing environment poisoning](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning))

**Implicación para la refactorización:** separar carpetas `server` y `client` puede ser una convención arquitectónica útil, pero no reemplaza las fronteras reales del grafo de imports. Las reglas futuras deberían proteger tanto la dirección de dependencias como el entorno de ejecución.

## 2. Opciones de organización permitidas

### 2.1 Colocación dentro o fuera de `app`

Next.js permite colocar código no enrutable dentro de cualquier segmento de `app`, porque solo el contenido retornado por `page` o `route` se expone para esa ruta. También permite mantener ese código fuera de `app`. La documentación presenta tres estrategias equivalentes desde la perspectiva del framework: ([Project Structure: Colocation](https://nextjs.org/docs/app/getting-started/project-structure#colocation), [Project Structure: Examples](https://nextjs.org/docs/app/getting-started/project-structure#examples))

1. Mantener `app` exclusivamente para routing y guardar el resto en carpetas compartidas externas.
2. Guardar carpetas compartidas en el nivel superior de `app`.
3. Mantener código global compartido en un nivel superior y colocar el código específico junto a la feature o segmento de ruta que lo usa.

La recomendación explícita de la documentación es escoger una estrategia apropiada para el equipo y aplicarla consistentemente; no privilegia una de las tres. ([Project Structure: Examples](https://nextjs.org/docs/app/getting-started/project-structure#examples))

### 2.2 Carpetas privadas

Una carpeta con prefijo `_`, como `_components` o `_lib`, excluye todo su subárbol del routing. No es necesaria para que la colocación sea segura, pero puede separar visualmente routing de implementación, dar una convención interna consistente, facilitar el agrupamiento en editores y evitar conflictos con futuras convenciones especiales del framework. ([Project Structure: Private folders](https://nextjs.org/docs/app/getting-started/project-structure#private-folders))

**Uso apropiado:** cuando se decida colocar implementación bajo `app`, el prefijo `_` puede comunicar de manera inequívoca que un subárbol no representa rutas. Su uso fuera de `app` sería una convención propia, no una convención funcional de Next.js.

### 2.3 Route Groups

Una carpeta entre paréntesis, como `(marketing)`, organiza rutas sin añadir el grupo a la URL. Puede agrupar por equipo, interés o feature, aplicar un layout a un subconjunto de rutas y habilitar varios layouts raíz. ([Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups))

Esta herramienta tiene tres restricciones prácticas documentadas:

- dos grupos no pueden generar la misma URL, porque las rutas entrarían en conflicto;
- navegar entre árboles con layouts raíz diferentes provoca una carga completa de página;
- si no hay un `app/layout` superior y se usan varios layouts raíz, la ruta `/` debe quedar cubierta por uno de esos grupos. ([Route Groups: Caveats](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups#caveats))

**Uso apropiado:** un route group expresa organización o composición del árbol de rutas, no una capa general del dominio. Debe introducirse por una necesidad de routing/layout y no únicamente para imitar la taxonomía de módulos internos.

### 2.4 Múltiples layouts y layouts raíz

Los layouts de segmentos se anidan y permiten compartir UI dentro de un subárbol. Los route groups pueden aplicar un layout a rutas escogidas sin alterar sus URLs. Varios layouts raíz están permitidos para experiencias realmente separadas, aceptando que cruzar entre ellas produce una recarga completa. ([Layouts and Pages: Nesting layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages#nesting-layouts), [Project Structure: Organize routes without affecting the URL path](https://nextjs.org/docs/app/getting-started/project-structure#organize-routes-without-affecting-the-url-path), [layout.js: Root Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout#root-layout))

## 3. Aspectos que Next.js no prescribe

La afirmación oficial de que Next.js es *unopinionated* respecto de la organización y colocación, junto con sus estrategias alternativas, deja las siguientes decisiones fuera del contrato del framework: ([Project Structure: Organizing your project](https://nextjs.org/docs/app/getting-started/project-structure#organizing-your-project), [Project Structure: Examples](https://nextjs.org/docs/app/getting-started/project-structure#examples))

- organizar principalmente por feature, por tipo técnico, por capa o mediante un híbrido;
- nombres y semántica de carpetas como `components`, `features`, `lib`, `services`, `repositories`, `domain`, `hooks`, `utils` o `types`;
- qué constituye un módulo y cuál es su API pública;
- dirección permitida de dependencias entre módulos o capas;
- diferencia entre componentes compartidos y específicos de una feature;
- política de barrels, imports absolutos, alias y profundidad de imports;
- ubicación de pruebas, fixtures, factories y documentación interna;
- reglas para separar acceso a datos, lógica de negocio, Server Actions y presentación;
- límites de tamaño o complejidad de pages, layouts y componentes.

Estas omisiones no son carencias que deban rellenarse atribuyéndole una arquitectura a Next.js. Son el espacio donde la influencia arquitectónica principal del esfuerzo y las necesidades reales de U-Roadmaps deben tomar decisiones explícitas.

## 4. Matriz de decisión para el diseño posterior

| Tema | Estado en Next.js | Consecuencia para U-Roadmaps |
| --- | --- | --- |
| `app` o `src/app` | Ambas ubicaciones están soportadas; no se combinan | Escoger una y migrar configuración e imports coherentemente |
| Carpetas normales bajo `app` | Definen segmentos de URL | Tratar sus movimientos como cambios potenciales de routing |
| `page`, `layout`, `route` y demás archivos especiales | Convención del framework | Mantenerlos como puntos de entrada/adaptadores del App Router |
| Código no enrutable dentro de `app` | Permitido y seguro | La colocación por ruta/feature es posible, no obligatoria |
| Código de aplicación fuera de `app` | Permitido | También es válido mantener `app` enfocado solo en routing |
| `_folder` | Excluye explícitamente el subárbol del routing | Útil para implementación colocada; no necesaria para seguridad |
| `(group)` | Organiza rutas sin cambiar la URL | Usar por composición/layout del routing y vigilar colisiones |
| `components`, `lib`, `features`, etc. | Sin significado especial | Su semántica debe definirse en la arquitectura propia |
| Server/Client | Determinado por directivas y grafo de imports | Diseñar y verificar fronteras de entorno, no confiar solo en carpetas |
| Dependencias entre módulos | No prescrito | Definirlas y hacerlas cumplir posteriormente con ESLint |

## 5. Invariantes que debe respetar la futura estructura

Sin anticipar una estructura objetivo concreta, cualquier propuesta posterior debería demostrar que:

1. conserva deliberadamente el contrato de URLs al mover segmentos de `app`;
2. mantiene los archivos especiales de Next.js en ubicaciones y con responsabilidades compatibles con App Router;
3. garantiza que toda ruta esté cubierta por un layout raíz válido;
4. aplica de forma coherente la elección entre `app` y `src/app`, incluidos configuración, alias, `public`, variables de entorno y `proxy`;
5. usa route groups solo cuando su efecto sobre layouts y routing es intencional y evita rutas duplicadas;
6. protege las fronteras Server/Client en el grafo de módulos, especialmente el código con secretos, base de datos o APIs del navegador;
7. documenta como decisiones propias —no como requisitos de Next.js— las capas, módulos, nombres, APIs públicas y restricciones de imports;
8. escoge una estrategia de colocación comprensible y la aplica consistentemente.

## 6. Preguntas que esta investigación deja para tickets posteriores

La documentación oficial no puede decidir, sin estudiar el caso de referencia y la línea base estable del producto:

- si `app` debe ser una capa delgada de routing o incluir implementación colocada;
- qué taxonomía de módulos expresa mejor el dominio y las features de U-Roadmaps;
- qué código merece ser globalmente compartido y qué código debe pertenecer a una feature;
- qué dependencias deben prohibirse entre capas o features;
- qué convenciones adicionales de servidor, cliente, datos y tests adoptará el proyecto;
- qué reglas y plugins de ESLint convertirán esas decisiones en invariantes automáticos.

Resolver esas preguntas es trabajo de arquitectura del proyecto. Esta investigación solo fija el perímetro dentro del cual esas decisiones son compatibles con Next.js.

## Fuentes oficiales consultadas

- [Project Structure and Organization](https://nextjs.org/docs/app/getting-started/project-structure)
- [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [`src` Folder](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder)
- [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

Consulta realizada el 29 de agosto de 2026.
