---
version: alpha
name: Roadmap-Interactivo-FCFM-design
description: Interpretación del lenguaje de diseño institucional adaptado para el Sistema de Roadmaps Académicos de la FCFM. Un entorno de white-paper universitario anclado por el color azul (`#024ad8`) como señal inequívoca de acción, texto e indicadores en tinta oscura (`#1a1a1a`), tipografía Plus Jakarta Sans para legibilidad de UI, y decoraciones angulares que guían visualmente el progreso. Los contenedores de nodos y paneles redondean a 8–16px, los diagramas se encuadran en marcos limpios, y bloques densos en tinta oscura anclan las secciones de gestión docente y paneles de resumen de fin de semestre.

colors:
  primary: "#024ad8"
  primary-bright: "#296ef9"
  primary-deep: "#0e3191"
  primary-soft: "#c9e0fc"
  on-primary: "#ffffff"
  ink: "#1a1a1a"
  ink-deep: "#000000"
  ink-soft: "#292929"
  on-ink: "#ffffff"
  canvas: "#ffffff"
  paper: "#ffffff"
  cloud: "#f7f7f7"
  fog: "#e8e8e8"
  steel: "#c2c2c2"
  graphite: "#636363"
  charcoal: "#3d3d3d"
  hairline: "#e8e8e8"
  hairline-strong: "#c2c2c2"
  link: "#024ad8"
  link-pressed: "#0e3191"
  bloom-coral: "#ff5050"
  bloom-rose: "#f9d4d2"
  bloom-deep: "#b3262b"
  bloom-wine: "#5a1313"
  storm-mist: "#8ebdce"
  storm-sea: "#7fadbe"
  storm-deep: "#356373"
  error: "#b3262b"

typography:
  display-xxl:
    fontFamily: Plus Jakarta Sans
    fontSize: 72px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0
  display-xs:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.38
    letterSpacing: 0
  body-emphasis:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: 0
  caption-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  caption-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  link-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: 0
  button-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.7px
    textTransform: uppercase
  button-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12.6px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.126px
  price-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0

rounded:
  none: 0px
  xs: 2px
  sm: 3px
  md: 4px
  lg: 8px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-primary-pressed:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.steel}"
    textColor: "{colors.on-primary}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-outline-ink:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-text-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.link-md}"
    padding: 4px 0
  badge-pill-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  badge-pill-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  badge-sale-coral:
    backgroundColor: "{colors.bloom-coral}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 44px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  text-input-search:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 40px
  card-product:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-product-feature:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 32px
  card-pricing-tier:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-pricing-tier-featured:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-customer-story:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-article-tile:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-category-icon:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.lg}"
    padding: 16px
  promo-strip-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 48px
  hero-promo-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 32px
  utility-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-md}"
    height: 36px
    padding: 0 24px
  nav-bar-top:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    height: 64px
    padding: 0 32px
  nav-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: 8px 16px
  category-tab:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.pill}"
    padding: 8px 20px
  category-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  faq-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.lg}"
    padding: 20px 24px
  chevron-decoration:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.none}"
  help-band-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    padding: 64px 32px
  footer-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    padding: 64px 32px
---

## Overview

El sistema interactivo de roadmaps está diseñado como una plataforma web educativa de alta claridad y rigor académico, enfocada en la navegación relacional de asignaturas universitarias[cite: 2]. El entorno se despliega sobre un lienzo blanco impoluto (`{colors.canvas}` — `#ffffff`) que aloja las interfaces del grafo y los paneles de control[cite: 1, 2], utilizando bandas grises tenues (`{colors.cloud}` / `{colors.fog}`) para estructurar la jerarquía administrativa de los contenidos del curso[cite: 1, 2]. Existe un único color de acción semántica fuerte — **Azul Eléctrico FCFM** (`{colors.primary}` — `#024ad8`) — destinado a marcar los hitos completados de la ruta, dependencias activas y los llamados principales a la acción académica[cite: 1, 2]. Los textos y etiquetas principales se rigen bajo el tono tinta (`{colors.ink}` — `#1a1a1a`)[cite: 1]. Toda la interfaz unifica su voz mediante la tipografía **Plus Jakarta Sans**, configurada en peso 500 para títulos de unidades y 400 para descripciones pedagógicas, garantizando una legibilidad óptima y mecánica en esquemas complejos de datos[cite: 1, 2].

El gesto visual distintivo del sistema consiste en **chevron angulares azules** derivados de la lógica de dirección de rutas[cite: 1, 2]. Estos elementos enmarcan las cabeceras de los mapas de conocimiento y las tarjetas principales de asignaturas sin agregar ruido material[cite: 1, 2]. Fuera de estas guías direccionales, la interfaz mantiene una geometría limpia con **esquinas suavizadas de 8–16px** para los nodos temáticos, tarjetas de recursos y menús flotantes de Next.js, junto con un radio estricto de 4px para botones interactivos[cite: 1, 2].

La experiencia del usuario se divide en tres modalidades visuales claras: un **lienzo comercial interactivo** sobre fondo blanco para la exploración del grafo de aprendizaje (nodos de clases, bibliografía y ramificaciones)[cite: 1, 2]; un **bloque denso de tinta** (`{colors.ink}`) reservado para la vista de administración docente (herramientas de autoría, carga de archivos PDF/enlaces y paneles de métricas del curso)[cite: 1, 2]; y una **banda de transiciones claras** (`{colors.cloud}` / `{colors.fog}`) para las vistas complementarias de documentación, listas de requisitos previos y secciones de preguntas frecuentes metodológicas[cite: 1, 2]. El color azul nunca inunda los fondos; actúa quirúrgicamente como indicador de progreso o como foco interactivo[cite: 1].

**Key Characteristics:**
- Lienzo de aprendizaje blanco puro (`{colors.canvas}`) con interacciones en tinta oscura (`{colors.ink}`)[cite: 1, 2]; bandas de descanso en gris claro (`{colors.cloud}`, `{colors.fog}`) estructuran la cronología del semestre académico[cite: 1, 2].
- El Azul Eléctrico FCFM (`{colors.primary}`) es el color exclusivo para el marcado de progreso interactivo y botones primarios de navegación pedagógica[cite: 1, 2].
- Tipografía Plus Jakarta Sans unificada en toda la aplicación para asegurar consistencia técnica en la visualización de grafos complejos[cite: 1, 2].
- Los contenedores de nodos y paneles laterales de información utilizan `{rounded.xl}` (16px)[cite: 1, 2], manteniendo los botones operativos en `{rounded.md}` (4px) con texto en mayúsculas[cite: 1].
- Los chevrons geométricos (`{colors.primary}`) proporcionan indicaciones direccionales implícitas y refuerzan la continuidad del mapa de aprendizaje[cite: 1, 2].
- Las interfaces de gestión docente y configuración avanzada adoptan bloques oscuros (`{colors.ink}`) para separar la experiencia administrativa de la de aprendizaje activo[cite: 1, 2].
- Ritmo de la plataforma: barra de utilidades de campus → barra de navegación del curso → lienzo interactivo (Canvas) → panel lateral de recursos → pie de página institucional[cite: 1, 2].

## Colors

### Brand & Accent
- **Azul Eléctrico FCFM** (`{colors.primary}` — `#024ad8`): El núcleo de señalización del sistema. Se utiliza para indicar nodos temáticos completados, el camino crítico activo del grafo, enlaces bibliográficos primarios e indicadores de sub-navegación académica[cite: 1, 2].
- **Azul Brillante** (`{colors.primary-bright}` — `#296ef9`): Variante de alta visibilidad para elementos interactivos insertados dentro de los paneles oscuros de la vista docente o modales de administración[cite: 1, 2].
- **Azul Profundo** (`{colors.primary-deep}` — `#0e3191`): Estado presionado para los nodos interactivos del mapa y botones de confirmación de hitos[cite: 1, 2].
- **Azul Suave** (`{colors.primary-soft}` — `#c9e0fc`): Fondo pastel para los nodos seleccionados en el lienzo de React Flow o chips de especialización activa[cite: 1, 2].

### Surface
- **Canvas** (`{colors.canvas}` — `#ffffff`): El fondo base infinito para el lienzo interactivo del roadmap (React Flow Canvas)[cite: 1, 2].
- **Paper** (`{colors.paper}` — `#ffffff`): Superficie de las tarjetas de nodos de contenido y ventanas emergentes de recursos didácticos[cite: 1, 2].
- **Cloud** (`{colors.cloud}` — `#f7f7f7`): Tono gris para las capas secundarias de información y contenedores de material complementario o avanzado[cite: 1, 2].
- **Fog** (`{colors.fog}` — `#e8e8e8`): Banda de contraste para la cabecera del indicador de progreso semestral y divisores de unidades obligatorias[cite: 1, 2].
- **Steel** (`{colors.steel}` — `#c2c2c2`): Bordes de nodos inactivos o enlaces de dependencias pendientes de aprobación en el grafo[cite: 1, 2].
- **Bloom Coral / Bloom Rose** (`{colors.bloom-coral}` / `{colors.bloom-rose}` — `#ff5050`, `#f9d4d2`): Indicadores visuales de alta prioridad, tales como evaluaciones próximas, hitos críticos del calendario académico o alertas de repetición[cite: 1, 2].
- **Storm Mist / Sea / Deep** (`{colors.storm-mist}`, `{colors.storm-sea}`, `{colors.storm-deep}` — `#8ebdce`, `#7fadbe`, `#356373`): Gama cromática reservada para distinguir la "Capa de Profundización Autodidacta" y tópicos avanzados que exceden el currículo reglamentario[cite: 2].

### Text
- **Ink** (`{colors.ink}` — `#1a1a1a`): Color universal para enunciados académicos, títulos de clases, etiquetas de nodos y textos generales sobre el fondo blanco[cite: 1, 2].
- **Ink Deep** (`{colors.ink-deep}` — `#000000`): Negro puro aplicado a las conexiones de aristas críticas y marcos definidos de los componentes esenciales[cite: 1, 2].
- **Ink Soft** (`{colors.ink-soft}` — `#292929`): Tono alterno para leyendas secundarias dentro de los paneles de control docente[cite: 1, 2].
- **On Ink** (`{colors.on-ink}` — `#ffffff`): Texto en blanco puro para los encabezados y métricas dentro de los paneles de control administrativo oscuros[cite: 1, 2].
- **Charcoal** (`{colors.charcoal}` — `#3d3d3d`): Color atenuado para descripciones detalladas de unidades y requisitos previos en las barras laterales[cite: 1, 2].
- **Graphite** (`{colors.graphite}` — `#636363`): Metadatos del material docente, pesos de archivos, fechas de publicación e historial de cambios[cite: 1, 2].

### Semantic
- **Bloom Deep** (`{colors.bloom-deep}` — `#b3262b`) + **Bloom Wine** (`{colors.bloom-wine}` — `#5a1313`): Alertas de prerrequisitos no cumplidos o errores de consistencia lógica en la construcción del grafo de la asignatura[cite: 1, 2].
- **Storm Deep** (`{colors.storm-deep}` — `#356373`): Estado neutral para sub-rutas complementarias opcionales ya exploradas[cite: 1, 2].

## Typography

### Font Family

El sistema adopta una política de **fuente única**: Plus Jakarta Sans (con Arial como alternativa del sistema) en todas las interfaces de aprendizaje y autoría[cite: 1, 2]. Esta tipografía sans-serif de carácter geométrico estructural garantiza la legibilidad estricta incluso en escalas reducidas dentro del lienzo interactivo del grafo[cite: 1, 2]. Se emplea en peso 400 para textos explicativos de asignaturas, 500 para los títulos de los nodos temáticos, y 600/700 para marcar hitos logrados y botones operativos[cite: 1, 2].

Las secciones de metadatos del material docente — extensiones de archivo, fechas y códigos de cursos — se configuran en el rango de 12-14px a peso 400[cite: 1, 2]. Los botones de confirmación del progreso escalan a pesos de énfasis con transformación a mayúsculas para denotar finalidad e interactividad[cite: 1].

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xxl}` | 72px | 500 | 1.0 | 0 | Título principal de la asignatura en la cabecera |
| `{typography.display-xl}` | 56px | 500 | 1.0 | 0 | Encabezados de unidades temáticas mayores |
| `{typography.display-lg}` | 44px | 500 | 1.0 | 0 | Títulos de los paneles globales de progreso |
| `{typography.display-md}` | 32px | 500 | 1.0 | 0 | Cabeceras de la vista de autoría del profesor |
| `{typography.display-sm}` | 24px | 500 | 1.17 | 0 | Nombre del nodo temático seleccionado |
| `{typography.display-xs}` | 20px | 500 | 1.0 | 0 | Títulos de los recursos didácticos en barra lateral |
| `{typography.body-lg}` | 18px | 400 | 1.33 | 0 | Resumen pedagógico del hilo conductor del curso |
| `{typography.body-md}` | 16px | 400 | 1.38 | 0 | Texto de descripción de conceptos y clases |
| `{typography.body-emphasis}` | 16px | 500 | 1.38 | 0 | Conceptos clave o términos destacados en la unidad |
| `{typography.caption-md}` | 14px | 400 | 1.5 | 0 | Listas de archivos (PDFs, Enlaces), pesos y metadatos |
| `{typography.caption-bold}` | 14px | 700 | 1.3 | 0 | Etiquetas de evaluación obligatoria e hitos aprobados |
| `{typography.caption-sm}` | 12px | 400 | 1.33 | 0 | Notas académicas al pie y créditos del equipo docente |
| `{typography.link-md}` | 16px | 500 | 1.38 | 0 | Hipervínculos a material en U-Cursos u fuentes externas |
| `{typography.button-md}` | 14px | 600 | 1.4 | 0.7px | Botones interactivos principales (Marcar como leído) |
| `{typography.button-sm}` | 12.6px | 700 | 1.0 | 0.126px | Acciones compactas dentro del nodo (Añadir enlace) |
| `{typography.price-md}` | 24px | 500 | 1.17 | 0 | Porcentaje numérico del indicador de progreso total |

### Principles

Para resguardar el tono académico y riguroso, la tipografía mantiene un **peso estable de 500 para todos los tamaños display**, evitando tipografías excesivamente pesadas que restasen espacio de visualización al mapa relacional[cite: 1, 2]. Las variantes estilísticas quedan restringidas; la jerarquía y el avance del estudiante se transmiten exclusivamente por cambios de peso tipográfico y el uso estratégico del color funcional, garantizando neutralidad y seriedad institucional[cite: 1, 2].

### Note on Font Substitutes

En caso de requerir alternativas de código abierto para entornos de desarrollo locales:
- **Inter** en pesos 400 a 700: Proporciona una densidad similar para la barra lateral de recursos[cite: 1].
- **Manrope** en pesos 400 a 700: Recomendada para el lienzo del grafo debido a sus geometrías abiertas y legibilidad a escalas micro[cite: 1, 2].
- **Roboto**: Sustituto clásico estructurado para las tablas de metadatos de archivos[cite: 1, 2].

Se deben forzar los interlineados declarados en la tabla para mantener la compresión de datos requerida en interfaces relacionales densas[cite: 1, 2].

## Layout

### Spacing System

- **Unidad base**: Red de 8px con subdivisiones de 4px para un alineamiento preciso de aristas y conectores[cite: 1, 2].
- **Tokens**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 24px · `{spacing.xxl}` 32px · `{spacing.section}` 80px[cite: 1]
- **Separación de secciones**: `{spacing.section}` (80px) de margen vertical entre los módulos mayores de la página (Lienzo vs. Panel Analítico)[cite: 1, 2].
- **Márgenes de tarjetas de contenido**: `{spacing.xl}` (24px) internos para la ficha informativa de nodos; `{spacing.xxl}` (32px) para las vistas de control del docente; y `{spacing.md}` (16px) para los elementos compactos de la lista de archivos[cite: 1, 2].
- **Gutter**: Separación fija de 24px en las rejillas de visualización complementaria[cite: 1].

El espaciado garantiza un equilibrio entre la amplitud requerida para interactuar con el mapa de grafos y la densidad necesaria para consultar listas de archivos docentes[cite: 2].

### Grid & Container

- **Ancho máximo de pantalla**: Contenedor centrado a 1366px para la interfaz de escritorio, permitiendo que el área de dibujo interactiva (Canvas) se extienda full-bleed según sea requerido[cite: 1, 2].
- **Área del Grafo (Canvas)**: Componente interactivo dominante que ocupa el área central superior, con paneles de metadatos superpuestos en los costados[cite: 2].
- **Malla de Asignaturas**: Distribución fluida de columnas según la resolución del dispositivo para desplegar las tarjetas de los cursos del semestre[cite: 1, 2].

### Whitespace Philosophy

El uso del espacio en blanco sigue una filosofía de **limpieza instrumental y pedagógica**[cite: 1]. El lienzo del grafo posee márgenes holgados para evitar la sobrecarga cognitiva durante la visualización de ramificaciones del conocimiento[cite: 2]; en contraposición, las barras de recursos académicos e historiales de archivos compactan sus líneas para desplegar la mayor cantidad de información útil sin forzar scroll innecesario[cite: 1, 2].

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Plano | Sin bordes ni sombras. Fondos planos. | El lienzo infinito de React Flow, secciones de fondo gris de la app[cite: 1, 2] |
| 1 — Hairline | Borde de 1px sólido en `{colors.hairline}` (`#e8e8e8`). | Celdas de prerrequisitos, bordes de inputs de edición, contenedores FAQ[cite: 1, 2] |
| 2 — Elevación Suave | Sombra sutil `0 2px 8px rgba(26, 26, 26, 0.08)`. | Nodos del roadmap en el lienzo, tarjetas de material docente, chips flotantes[cite: 1, 2] |
| 3 — Panel Flotante | Sombra pronunciada `0 8px 24px rgba(26, 26, 26, 0.12)`. | Modales de confirmación de fin de ciclo, menú flotante de inserción de nodos[cite: 1, 2] |

La tridimensionalidad se maneja de forma controlada. La interfaz delega la sensación de profundidad en el **contraste de color** antes que en efectos volumétricos[cite: 1]. La elevación suave se aplica en los nodos interactivos para denotar que son elementos arrastrables y clickeables sobre el lienzo[cite: 2].

### Decorative Depth

El uso de los **chevrons decorativos** en azul funciona como ancla conceptual del camino de aprendizaje[cite: 2]. Se disponen de manera lateral en los bloques introductorios del curso para simbolizar avance y dirección[cite: 1, 2]. Los materiales multimedia asociados a cada tema se encuadran en contenedores `{rounded.xl}` con bordes finos, aislando el recurso del espacio interactivo general[cite: 1, 2].

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Conectores de aristas rectilíneos, chevrons direccionales, barras de progreso continuas[cite: 1, 2] |
| `{rounded.xs}` | 2px | Indicadores flotantes sobre el mapa, pequeñas etiquetas de estado[cite: 1] |
| `{rounded.sm}` | 3px | Bordes internos de los botones de interacción micro del grafo[cite: 1, 2] |
| `{rounded.md}` | 4px | Botones de acción principales, campos de texto, inputs de carga de material[cite: 1, 2] |
| `{rounded.lg}` | 8px | Contenedores de nodos temáticos en el lienzo, filas colapsables de prerrequisitos[cite: 1, 2] |
| `{rounded.xl}` | 16px | Tarjetas informativas de unidades, modales, paneles de control lateral[cite: 1, 2] |
| `{rounded.pill}` | 9999px | Filtros globales de visualización (Capa Obligatoria / Capa de Profundización)[cite: 2] |

Se mantiene la dicotomía formal: **las acciones y operaciones son de bordes rectos y firmes (4px)** para inspirar precisión técnica[cite: 1], mientras que **los contenedores de conocimiento y flujos son suavizados (16px)** para una navegación amigable y estructurada[cite: 1, 2].

### Photography & Geometry

Los iconos representativos de las asignaturas o escuelas son de formato cuadrado rígido padding interno, con una presencia de marca limpia[cite: 1, 2]. Las visualizaciones en miniatura dentro del panel informativo adoptan la proporción clásica 16:9 con curvatura `{rounded.xl}`[cite: 1].

## Components

### Buttons

**`button-primary`** — Acción principal de progresión académica
- Fondo `{colors.primary}`, texto `{colors.on-primary}`, tipografía `{typography.button-md}` (mayúsculas, espaciado 0.7px), padding `{spacing.sm} {spacing.xl}` (12 × 24), alto 44px, redondeado `{rounded.md}`[cite: 1].
- Estado presionado `button-primary-pressed` — fondo `{colors.primary-deep}`[cite: 1].
- Estado inactivo `button-primary-disabled` — fondo `{colors.steel}`[cite: 1].
- Aplicación: "Marcar Unidad como Completada", "Publicar Roadmap", "Guardar Cambios de Ruta"[cite: 2].

**`button-ink`** — Botón operativo administrativo para profesores
- Fondo `{colors.ink}`, texto `{colors.on-primary}`, padding `{spacing.sm} {spacing.xl}`, alto 44px, redondeado `{rounded.md}`, tipografía `{typography.button-md}`[cite: 1].
- Aplicación: Acceso al panel de autoría, descarga de reportes de usabilidad SUS, configuraciones globales[cite: 2].

**`button-outline`** — Acción secundaria en el mapa de aprendizaje
- Fondo `{colors.canvas}`, texto `{colors.primary}`, borde de 1px en `{colors.primary}`, padding `{spacing.sm} {spacing.xl}`, alto 44px, redondeado `{rounded.md}`[cite: 1].
- Aplicación: "Expandir Material Extra", "Ver Dependencias Anteriores", "Centrar Vista de Grafo"[cite: 2].

**`button-outline-ink`** — Botón neutro de interacción de archivos
- Fondo `{colors.canvas}`, texto `{colors.ink}`, borde de 1px en `{colors.ink}`, padding `{spacing.sm} {spacing.xl}`, alto 44px, redondeado `{rounded.md}`[cite: 1].
- Aplicación: "Visualizar Archivo Adjunto", "Inspeccionar Historial"[cite: 2].

**`button-text-link`** — Enlace directo a recursos externos o U-Cursos
- Fondo `{colors.canvas}`, texto `{colors.primary}`, tipo `{typography.link-md}`, padding `{spacing.xxs} 0`[cite: 1].
- Aplicación: Enlaces complementarios a carpetas institucionales oficiales o repositorios de código[cite: 2].

### Cards & Containers

**`card-product`** — Nodo Temático Estándar (Componente del Grafo)
- Fondo `{colors.canvas}`, redondeado `{rounded.xl}`, padding `{spacing.xl}`, sombra de Elevación Suave[cite: 1, 2].
- Disposición: Título de la clase/tópico (`{typography.display-xs}`), barra indicadora de estado de aprobación, resumen micro de conceptos, accesos directos rápidos inferiores[cite: 1, 2].

**`card-product-feature`** — Ficha Detallada de Unidad de Aprendizaje
- Fondo `{colors.cloud}`, redondeado `{rounded.xl}`, padding `{spacing.xxl}` (32px)[cite: 1].
- Disposición: Distribución en dos secciones; bloque de metadatos de la unidad a la izquierda, cuerpo explicativo pedagógico con su listado de material obligatorio y avanzado a la derecha[cite: 1, 2].

**`card-pricing-tier`** + **`card-pricing-tier-featured`** — Indicadores de Capas de Contenido
- Fondo `{colors.canvas}`, redondeado `{rounded.xl}`, padding `{spacing.xl}`, elevación suave[cite: 1].
- Muestran las especificaciones de las rutas. La versión destacada (`-featured`) envuelve la "Ruta Reglamentaria Obligatoria" mostrando un sutil borde superior azul `{colors.primary}` para denotar prioridad semántica sobre la ruta extra[cite: 1, 2].

**`card-customer-story`** — Panel de Progreso Personalizado del Estudiante
- Fondo `{colors.canvas}`, redondeado `{rounded.xl}`, padding `{spacing.md}`, Elevación Suave[cite: 1, 2].
- Muestra el estado del alumno en el semestre: Hitos alcanzados, porcentaje de completitud gráfica y sugerencias de especialización autodidacta[cite: 2].

**`card-article-tile`** — Módulo de Cambios y Actualizaciones Docentes
- Fondo `{colors.canvas}`, redondeado `{rounded.xl}`, padding `{spacing.md}`, elevación suave[cite: 1].
- Bloque informativo que alerta al alumno sobre la adición de nueva bibliografía o refinamientos en la ruta por parte del profesor[cite: 2].

**`card-category-icon`** — Selector de Áreas Temáticas / Malla Curricular
- Fondo `{colors.canvas}`, redondeado `{rounded.lg}` (8px), padding `{spacing.md}`[cite: 1].
- Icono representativo del núcleo formativo (v.g., Ciencias de la Computación, Matemáticas, Proyectos) con etiqueta en tipografía destacada[cite: 1, 2].

**`hero-promo-card`** — Bloque de Bienvenida e Introducción de Asignatura
- Fondo `{colors.canvas}`, redondeado `{rounded.xl}`, padding `{spacing.xxl}`[cite: 1].
- Presenta el código oficial del curso, nombre del profesor guía, resumen del hilo conductor y el botón de inicio de navegación del grafo, flanqueado por los chevrons azules[cite: 1, 2].

**`promo-strip-dark`** — Panel de Control Docente: Ingesta de Datos
- Fondo `{colors.ink}`, texto `{colors.on-ink}`, redondeado `{rounded.xl}`, padding `48px` internos[cite: 1].
- Entorno de trabajo oscuro para el catedrático, diseñado para la carga masiva de PDFs y estructuración de enlaces semestrales[cite: 2].

### Inputs & Forms

**`text-input`** + **`text-input-focused`** — Campos de Edición del Roadmap
- Fondo `{colors.canvas}`, texto `{colors.ink}`, redondeado `{rounded.md}`, padding `{spacing.sm} {spacing.md}`, alto 44px[cite: 1].
- Borde fino de 1px que pasa a negro sólido al activarse para la edición de nombres de nodos o descripciones conceptuales[cite: 1, 2].

**`text-input-search`** — Filtrado de Nodos y Conceptos
- Fondo `{colors.canvas}`, redondeado `{rounded.md}`, padding `{spacing.sm} {spacing.md}`, alto 40px, buscador con icono de lupa para localizar palabras clave dentro de la ruta[cite: 1, 2].

**`badge-pill-ink`** — Indicador de Estado Obligatorio
- Fondo `{colors.ink}`, texto `{colors.on-primary}`, redondeado `{rounded.lg}`, padding 6px 12px, define visualmente que un nodo pertenece al "Contenido Reglamentario" del curso[cite: 1, 2].

**`badge-pill-outline`** — Indicador de Estado Pendiente
- Fondo `{colors.canvas}`, texto `{colors.ink}`, borde de 1px. Señala unidades bloqueadas por falta de prerrequisitos[cite: 1, 2].

**`badge-sale-coral`** — Alerta de Evaluación
- Fondo `{colors.bloom-coral}`, texto `{colors.on-primary}`, redondeado `{rounded.sm}`, destaca nodos que contienen exámenes, controles o entregas de proyectos[cite: 1, 2].

### Navigation

**`utility-strip`** — Barra Superior del Campus Virtual
- Fondo `{colors.ink}`, texto `{colors.on-primary}`, alto 36px, enlaces de acceso rápido a U-Cursos, Malla General FCFM y autenticación institucional[cite: 1, 2].

**`nav-bar-top`** — Cabecera de Navegación del Curso
- Fondo `{colors.canvas}`, alto 64px, desglosa el logotipo DCC/FCFM, selector del semestre activo y accesos directos al Canvas del Grafo, Panel Docente y Sección de Ayuda[cite: 1, 2].

**`nav-link`** — Enlaces de la Cabecera
- Texto en tinta oscura. Al estar en la vista activa (v.g. Canvas), genera una línea inferior de 2px en azul `{colors.primary}` bajo el texto[cite: 1, 2].

**`category-tab`** + **`category-tab-active`** — Selector de Capas de Visibilidad
- Pastillas interactivas situadas sobre el lienzo para alternar de forma fluida el tipo de visualización: "Ver Todo / Solo Obligatorio / Rutas Avanzadas"[cite: 1, 2].

### Signature Components

**`chevron-decoration`** — El Chevron de Continuidad Pedagógica
- Fondo `{colors.primary}`, sin redondeado ni sombras. Geometría angular pura que escolta los banners principales, simbolizando la dirección de la ruta formativa[cite: 1, 2].

**`faq-row`** — Fila Colapsable de Requisitos de Unidad
- Contenedor `{rounded.lg}` con borde fino. Desglosa de forma compacta los conocimientos previos recomendados antes de iniciar un nodo del grafo[cite: 1, 2].

**`help-band-dark`** — Sección de Cierre y Soporte Metodológico
- Bloque oscuro de base (`{colors.ink}`) que ofrece a los estudiantes canales de comunicación directa con el equipo de profesores ayudantes y manuales de uso del software[cite: 1, 2].

**`footer-dark`** — Pie de Página Institucional
- Bloque denso en tinta oscura que cierra la página, ordenando enlaces de los departamentos de la Facultad (DCC, FCFM, U-Chile) e información de autoría de la memoria[cite: 1, 2].

## Do's and Don'ts

### Do
- Utilizar `{colors.primary}` de forma exclusiva para marcar progreso real en el roadmap, aristas activas o llamados vitales de aprendizaje[cite: 1, 2].
- Mantener los títulos de los nodos formativos en Plus Jakarta Sans peso 500 con interlineado estricto para resguardar la armonía espacial del grafo[cite: 1, 2].
- Implementar la separación formal de radios: 16px `{rounded.xl}` para las tarjetas contenedoras de información y 4px `{rounded.md}` para los botones operativos[cite: 1].
- Alternar los fondos del lienzo (`{colors.canvas}`) con paneles de descripción claros (`{colors.cloud}`) para mantener un ritmo visual descansado[cite: 1, 2].
- Asegurar que todo mapa interactivo concluya en su parte inferior con las herramientas de soporte estudiantil y la persistencia de datos relacionales SQL[cite: 1, 2].
- Respetar que las etiquetas de botones se procesen en mayúsculas con el espaciado de letras normado[cite: 1].

### Don't
- No introducir códigos de color ajenos a la paleta institucional para calificar asignaturas; delegar las distinciones en las capas de React Flow[cite: 2].
- No usar sombras difusas o pesadas sobre los nodos; el mapa debe simular un esquema analítico limpio de tipo white-paper[cite: 1, 2].
- No redondear los botones de acción más allá de los 4px reglamentarios; el software debe lucir como una herramienta de ingeniería civil[cite: 1, 2].
- No disminuir el tamaño tipográfico en las descripciones conceptuales por debajo del límite de 12px para cuidar la accesibilidad[cite: 1].
- No usar el motivo decorativo del chevron dentro de los nodos individuales; pertenece únicamente a las cabeceras arquitectónicas del curso[cite: 1, 2].
- No alterar las opacidades de los textos para generar jerarquías; recurrir en su lugar a las variantes de color `{colors.charcoal}` o `{colors.graphite}`[cite: 1].

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 480px | Lienzo del grafo se bloquea a modo consulta con controles simplificados; menús de archivos colapsan en acordeón total; padding de sección baja a 48px[cite: 1, 2]. |
| Mobile-Large | 480–767px | Estructura de columna única; los paneles de control e ingesta docente se transforman en modales de pantalla completa[cite: 1, 2]. |
| Tablet | 768–1023px | Rejilla de asignaturas a 2 columnas; el Canvas interactivo activa controles táctiles optimizados; barra lateral de recursos pasa a modo desplegable oculto[cite: 1, 2]. |
| Desktop | 1024–1279px | Despliegue estándar: 3 columnas de tarjetas de cursos; visualización completa del grafo y panel lateral fijo de documentos[cite: 1, 2]. |
| Desktop-Large | ≥ 1280px | Optimización máxima a 1366px de ancho; renderizado simultáneo del grafo relacional, flujos de dependencias y barras de herramientas docentes avanzadas[cite: 1, 2]. |

### Touch Targets

Todos los elementos interactivos resguardan un área mínima de contacto de 44×44px en entornos móviles. Los nodos temáticos del mapa incrementan sus zonas de pulsación invisibles sobre las aristas para evitar frustración en pantallas táctiles[cite: 1, 2]. Las pestañas de selección de capa (`category-tab`) expanden sus dimensiones internas en dispositivos móviles para facilitar la usabilidad según la escala SUS[cite: 1, 2].

### Collapsing Strategy

- **Barra de Campus**: Stays visible en todas las resoluciones; condensa sus accesos en un menú compacto de cuenta estudiantil en anchos menores a 768px[cite: 1, 2].
- **Navegación Superior**: Se unifica en un menú lateral de hamburguesa en tabletas y móviles, manteniendo siempre al alcance el acceso directo al lienzo y al estado del usuario[cite: 1, 2].
- **Lienzo del Grafo**: Mantiene la integridad formal de sus esquemas; los chevrons de guía reducen su escala en tabletas y se suprimen en móvil para privilegiar el espacio de lectura del nodo[cite: 1, 2].
- **Módulos de Archivos**: Pasan de tablas horizontales multi-columna en escritorio a bloques modulares apilados con acordeones independientes en resoluciones móviles[cite: 1, 2].

### Image & Diagram Behavior

El área reactiva de React Flow preserva sus esquinas redondeadas en cualquier resolución[cite: 1, 2]. Los diagramas explicativos y esquemas metodológicos se redimensionan manteniendo su aspecto nativo de 16:9 por medio de reajustes en sus coordenadas de visualización, impidiendo deformaciones y garantizando que el estudiante reconozca su progreso en cualquier dispositivo[cite: 1, 2].

## Iteration Guide

1. Modificar un único componente del ecosistema académico a la vez; no intentar rediseñar el lienzo interactivo y el panel de carga docente en una sola iteración[cite: 2].
2. Invocar de manera explícita los tokens declarados (`{colors.primary}`, `{typography.display-sm}`, `card-product`) en los comentarios del código de Next.js[cite: 1, 2].
3. Ejecutar las herramientas de validación de diseño para precaver contrastes erróneos en las aristas del grafo o referencias rotas en las capas de información[cite: 2].
4. Documentar los estados de los nodos (`-selected`, `-completed`, `-locked`) como entidades de estilos independientes; nunca incrustar lógica de progreso de forma oculta en el texto[cite: 2].
5. Priorizar el uso de `{typography.body-md}` para las explicaciones de clases; reservar los tamaños display estrictamente para los nombres oficiales de unidades y asignaturas[cite: 1, 2].
6. Gestionar el Azul Eléctrico con extrema cautela: un exceso de estímulos brillantes arruinaría la claridad del hilo conductor del curso[cite: 1, 2].
7. Limitar las superficies de la aplicación a los seis modos predefinidos en la paleta para asegurar paridad visual con los sistemas de la FCFM[cite: 1, 2].
