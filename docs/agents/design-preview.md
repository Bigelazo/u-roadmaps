# Laboratorio visual

`/design-preview` es el laboratorio visual temporal de U-Roadmaps. Existe durante el diseño y la implementación para que las decisiones visuales se revisen juntas antes de copiarlas a producción. No es una pantalla del producto y se eliminará antes de la entrega productiva final.

## Antes de implementar interfaz

- Abre `/design-preview` en el servidor de desarrollo y localiza el espécimen correspondiente.
- Consulta `DESIGN.md` para los principios globales y los metadatos visibles del espécimen para su estado canónico.
- Si existe un diseño aprobado para implementación, úsalo como referencia visual. La implementación productiva debe añadir las propiedades, datos, accesibilidad y comportamiento funcional que necesite sin depender del código del laboratorio.
- Si solo existe una línea base o un candidato experimental, no lo presentes como diseño aprobado. Un agente puede proponer o recomendar candidatos, pero únicamente el propietario puede aprobarlos explícitamente.
- No importes implementaciones experimentales del laboratorio en producción. Copia la intención visual y adáptala a la arquitectura productiva.

## Alcance

El laboratorio cataloga unidades visuales reutilizables y sus estados relevantes, aunque actualmente estén escritas dentro de una página. Incluye navegación, acciones, tarjetas de cursos, autenticación, nodos y dependencias, detalle de nodos, edición, progreso, recursos y estados de carga, vacío, error, foco, selección y contenido extremo cuando correspondan.

No incluye páginas completas, wrappers sin identidad visual, proveedores, hooks, adaptadores de datos ni otros componentes puramente técnicos.

## Estados canónicos

Cada variante de un espécimen declara dos ejes independientes:

- **Madurez**: `baseline`, `experimental` o `approved for implementation`.
- **Adopción en producción**: `not implemented`, `partial` o `implemented`.

Que un diseño exista en producción no significa que esté aprobado. Del mismo modo, un diseño puede estar aprobado antes de ser implementado. La aprobación cubre el componente completo y todos los estados que declare como requeridos; cualquier estado pendiente impide aprobarlo.

Mantén visible la versión vigente y, cuando exista, una sola candidata a reemplazarla. Git conserva las iteraciones anteriores. Los metadatos declarados junto al espécimen y mostrados en la página son la fuente de verdad; no dupliques un inventario de estados en Markdown.

## Límites del laboratorio

- Usa fixtures estáticos y deterministas con el vocabulario de `CONTEXT.md`.
- Permite estado local para abrir, cerrar, seleccionar, alternar variantes y evaluar transiciones.
- No realices autenticación, fetch, navegación real ni mutaciones persistentes.
- Muestra simultáneamente marcos etiquetados de escritorio y móvil cuando el diseño responsive cambie de forma relevante.
- Renderiza todos los especímenes en la página única; no los difieras por visibilidad.
- Usa Motion for React con la política de `DESIGN.md`; no hace falta documentar un contrato de animación por espécimen.
- Revisa el laboratorio manualmente. No añadas tests unitarios, funcionales, E2E, snapshots ni regresión visual para su contenido.

## Evolución

El primer hito del laboratorio ampliado reúne todas las líneas base actuales antes de rediseñar componentes. Renderiza el componente productivo con fixtures cuando sea práctico; si su acoplamiento a sesión, router o backend lo impide, crea un espécimen visual fiel.

Retira del laboratorio activo las comparaciones cuyo resultado ya esté decidido. Jade y Archivo SemiCondensed son fundamentos vigentes; Hoja, Chivo e IBM Plex Sans Condensed quedan únicamente en la historia de Git. El símbolo de ruta en forma de U fue rechazado como logo y no es un candidato activo.
