# Investigación: modelo de dominio de roadmap.sh

## Alcance y método

Se consultaron únicamente fuentes primarias de roadmap.sh: su sitio oficial, la API pública que consume su sincronizador y el repositorio oficial de contenido, hoy servido como [`nilbuild/developer-roadmap`](https://github.com/nilbuild/developer-roadmap) (la [URL histórica de `kamranahmedse/developer-roadmap`](https://github.com/kamranahmedse/developer-roadmap) redirige allí). No se añadieron herramientas OSS afines: las fuentes oficiales ya exponen el grafo, el contenido y la experiencia de progreso pertinentes, y una comparación externa no cambiaría las decisiones de vocabulario propuestas.

## Qué modela roadmap.sh

- Un **roadmap oficial** es un documento con `slug`, títulos, descripción, `nodes`, `edges`, dimensiones y tipo. Sus tipos publicados son `role`, `skill` y `best-practice`; también puede relacionarse con preguntas, otros roadmaps y cursos. [Definición TypeScript oficial](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts).
- El endpoint público del roadmap de frontend materializa ese documento como un grafo de 156 nodos y 69 aristas, y lo clasifica como `role`. Por tanto, el grafo y su presentación son parte del artefacto editorial, no una lista lineal de lecciones. [Datos oficiales del endpoint](https://roadmap.sh/api/v1-official-roadmap/frontend).
- El tipo publicado para un nodo es deliberadamente abierto: tiene un `id`, un `type` opcional y `data` con `label` opcional, además de otros campos. El mismo documento guarda las aristas por separado; no declara una jerarquía de dominio mediante un `parentId`. [Tipo `OfficialRoadmapNode`](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts).
- En el roadmap de frontend se observan tipos de nodo de contenido y de composición distintos: `topic`, `subtopic`, `section`, `title`, `paragraph`, `button`, `linksgroup`, `label`, `legend`, `vertical` y `horizontal`. Esto muestra que `node` es una abstracción de editor/canvas que mezcla significado pedagógico y decoración visual. [Grafo oficial de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend).

## Agrupación y relaciones

- `topic` y `subtopic` expresan una agrupación semántica visible, mientras que `section`, líneas verticales/horizontales, títulos y párrafos estructuran el lienzo. La API no publica una relación padre-hijo normalizada para estos nodos; la pertenencia se infiere de posición, tipos y conexiones. [Grafo oficial de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend).
- Las aristas son una colección independiente de los nodos y pueden llevar metadatos de estilo (`edgeStyle`). El contrato publicado no distingue semánticamente prerequisito, secuencia, alternativa o mera conexión. [Definición de `OfficialRoadmapDocument`](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts) y [datos de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend).
- Un roadmap también puede agruparse en el catálogo por propósito: el sitio diferencia roadmaps basados en roles y en habilidades, y el esquema agrega la categoría `best-practice`. [Página oficial About](https://roadmap.sh/about) y [tipos permitidos en el código](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts).

## Contenido asociado a un nodo

- El repositorio público no almacena el grafo completo: almacena contenido por tema en `roadmaps/<roadmap-slug>/content/<topic-slug>@<node-id>.md`; el `node-id` del nombre de archivo enlaza el contenido con el nodo. [README oficial](https://github.com/nilbuild/developer-roadmap/blob/master/readme.md) y [guía de contribución](https://github.com/nilbuild/developer-roadmap/blob/master/contributing.md).
- El modelo de contenido de tema es una entidad separada con `roadmapSlug`, `nodeId`, `description` y una lista de `resources`; por ello un mismo identificador de nodo es la unión explícita entre el grafo y su explicación/materiales. [Tipo `OfficialRoadmapTopicContentDocument`](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap-topic.ts).
- Cada recurso tiene `title`, `url` y un tipo. Los tipos admitidos son `roadmap`, `official`, `opensource`, `article`, `course`, `podcast`, `video`, `book` y `feed`; la guía además limita el contenido a un párrafo conciso y hasta ocho enlaces por tema. [Tipos de recurso](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap-topic.ts) y [reglas de contenido](https://github.com/nilbuild/developer-roadmap/blob/master/contributing.md).
- La sincronización de contribuciones lee el Markdown, convierte la lista de enlaces a recursos tipados y la envía a un endpoint de temas; el contenido y el layout del roadmap son, por tanto, ciclos de edición distintos. [Sincronizador oficial](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/sync-repo-to-database.ts) y [documentación de sincronización](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/readme.md).

## Progreso

- roadmap.sh declara que una persona puede «track your progress as you follow a roadmap» y planea perfiles públicos para compartir ese progreso. Esto establece que el progreso pertenece al aprendiz siguiendo un roadmap, no al nodo editorial en sí. [Página oficial About](https://roadmap.sh/about).
- El changelog oficial menciona un indicador de progreso persistente por roadmap. Confirma una vista agregada de progreso, pero no publica la fórmula, los estados ni una relación de datos de progreso. [Changelog del 18 de noviembre de 2024](https://roadmap.sh/changelog).
- El contrato público de roadmap y el contrato de contenido no contienen campos de usuario, estado, fecha de completitud ni porcentaje por nodo. Con las fuentes públicas disponibles no es defendible atribuirles una máquina de estados concreta. [Esquema de roadmap](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts) y [esquema de contenido](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap-topic.ts).

## Contenido opcional, alternativas y profundidad

- En los datos oficiales del roadmap de frontend, nodos `subtopic` llevan una `legend` con etiquetas como `Personal Recommendation` y `Alternative Option`. Esas etiquetas codifican una recomendación o elección entre opciones, no un estado de progreso. [Grafo oficial de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend).
- La sección de proyectos de frontend etiqueta proyectos como `beginner`, `intermediate` o `advanced`. La dificultad es así una clasificación de proyectos, separada de la alternativa/recomendación de los nodos del roadmap. [Proyectos oficiales de frontend](https://roadmap.sh/frontend/projects).
- Para roadmaps generados por IA, roadmap.sh habla de «3 levels deep», lo que describe profundidad de desglose. No debe usarse como sinónimo de opcionalidad ni de dificultad. [Changelog del 18 de noviembre de 2024](https://roadmap.sh/changelog).

## Vocabulario candidato para u-roadmaps

| Término propuesto | Definición operativa | Decisión respaldada por la investigación |
| --- | --- | --- |
| **Roadmap** | Grafo editorial versionable de un curso, con alcance y metadatos. | Mantenerlo separado de la vista y del progreso, siguiendo la separación documento-grafo/contenido de roadmap.sh. [Esquema oficial](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts) |
| **Nodo de aprendizaje** | Unidad semántica navegable del curso: tópico, subtema o actividad; tiene título y puede tener contenido. | No llamar «nodo» a títulos, líneas ni secciones decorativas: roadmap.sh mezcla esos elementos en su nodo genérico. [Grafo oficial](https://roadmap.sh/api/v1-official-roadmap/frontend) |
| **Grupo** | Contenedor semántico de nodos de aprendizaje, por ejemplo una unidad del curso. | Modelarlo explícitamente, no derivarlo de coordenadas o de una caja visual como en el grafo publicado. [Grafo oficial](https://roadmap.sh/api/v1-official-roadmap/frontend) |
| **Relación** | Arista tipada entre dos nodos, con al menos `prerrequisito` y, si se necesita, `secuencia` o `referencia`. | No reutilizar una arista visual sin semántica: el contrato externo solo expone `edges` y estilo. [Esquema oficial](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts) |
| **Contenido de nodo** | Explicación y recursos asociados a un nodo por su identificador estable. | Mantenerlo como entidad independiente permite editar recursos sin cambiar el grafo. [Modelo de tema](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap-topic.ts) |
| **Recurso** | Enlace curado y tipado dentro del contenido de un nodo. | Adoptar tipos de recurso solo si sirven al curso; no confundirlos con nodos. [Tipos oficiales](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap-topic.ts) |
| **Marcación de progreso** | Relación entre estudiante y nodo de aprendizaje, con estado definido por u-roadmaps y fechas opcionales. | Separarla del nodo editorial; roadmap.sh confirma seguimiento personal, pero no publica sus estados. [About](https://roadmap.sh/about) |
| **Recomendación** | Señal editorial no obligatoria sobre un nodo o recurso. | Es distinta de completitud; el precedente visible usa `Personal Recommendation`. [Grafo oficial](https://roadmap.sh/api/v1-official-roadmap/frontend) |
| **Alternativa** | Opción intercambiable para un objetivo de aprendizaje. | Es distinta de «avanzado» y de «opcional»; el precedente visible usa `Alternative Option`. [Grafo oficial](https://roadmap.sh/api/v1-official-roadmap/frontend) |
| **Nivel de dificultad** | Clasificación de complejidad de una actividad o proyecto. | Reservarlo para `inicial`, `intermedio` y `avanzado` (o el vocabulario que el curso acuerde), no para marcar opcionalidad. [Proyectos oficiales](https://roadmap.sh/frontend/projects) |

## Decisiones accionables

1. Separar cuatro modelos: `Roadmap`/grafo editorial, `Nodo de aprendizaje`, `Contenido de nodo`/`Recurso` y `Marcación de progreso`. El enlace estable de contenido a nodo de roadmap.sh valida especialmente la segunda separación. [README oficial](https://github.com/nilbuild/developer-roadmap/blob/master/readme.md).
2. Distinguir en el lenguaje y en el modelo `Grupo` de `Sección visual`: la primera es una agrupación curricular; la segunda es solo presentación del canvas. [Grafo oficial de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend).
3. Hacer que las relaciones tengan tipo explícito. Para el dominio intra-curso, `prerrequisito` debe ser la relación base; ninguna fuente revisada justifica inferirlo de la geometría de una arista. [Esquema oficial](https://github.com/nilbuild/developer-roadmap/blob/master/scripts/lib/official-roadmap.ts).
4. No usar un booleano único `optional`: representar por separado `recomendación`, `alternativa` y `nivel de dificultad`, porque el precedente oficial los emplea para propósitos diferentes. [Grafo de frontend](https://roadmap.sh/api/v1-official-roadmap/frontend) y [proyectos de frontend](https://roadmap.sh/frontend/projects).
5. Definir la máquina de estados de `Marcación de progreso` en los tickets de lenguaje, en vez de copiar estados inexistentes en la fuente pública. La evidencia solo respalda que es progreso individual y agregable por roadmap. [About](https://roadmap.sh/about) y [changelog](https://roadmap.sh/changelog).
