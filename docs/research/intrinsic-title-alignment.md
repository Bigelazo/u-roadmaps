# Alineación intrínseca de títulos del roadmap

**Fecha:** 2026-09-05  
**Alcance:** la etiqueta del nodo en `RoadmapNode.tsx` y las filas de dependencias del diálogo de ocultación en `RoadmapCanvas.tsx`. Este documento no propone cambios de producto ni de la geometría de los nodos.

## Conclusión

No existe una propiedad CSS que mida el borde derecho de la línea visual más larga *después* de que el navegador haya partido el texto. `w-fit` no implementa ese efecto: en Tailwind equivale a `width: fit-content`, que se resuelve a partir de los tamaños intrínsecos antes del wrapping y del espacio disponible.

El efecto que sí es estable y accesible es centrar una **caja de contenido** (icono + título, o título + flecha + título) dentro de un límite explícito, mientras cada título mantiene `text-left`. Para un título que ya no cabe, la caja debe ocupar el ancho máximo permitido; no debe intentar encogerse según las líneas resultantes.

## Por qué `w-fit` no cambió la captura

La especificación define el tamaño `fit-content` como `clamp(min-content, stretch-fit, max-content)` cuando el espacio disponible es definido. El tamaño `max-content` evita los saltos de línea suaves; en un ancho intermedio, el resultado es el `stretch-fit`, es decir, llena el espacio disponible. Por eso un título largo puede seguir midiendo exactamente la columna o el espacio restante aunque tenga `w-fit`.

La operación solicitada —«usar el carácter más lejano» de las líneas ya renderizadas— sería circular: el ancho decide los saltos y los saltos decidirían el supuesto nuevo ancho. CSS no expone una dimensión basada en esos fragmentos de línea.

Fuentes normativas:

- [CSS Sizing Level 3, definiciones de `max-content`, `min-content` y `fit-content`](https://www.w3.org/TR/css-sizing-3/#terms). En particular, `max-content` no toma oportunidades de salto suave y `fit-content` se define mediante esos tamaños y el espacio disponible.
- [CSS Sizing Level 3, ejemplo de `width: fit-content`](https://www.w3.org/TR/css-sizing-3/#fit-content-sizing). El caso de ancho intermedio llena el ancho disponible y luego parte el contenido.

## Regla por contexto de layout

`justify-self-center` solo alinea un grid item (o caja de bloque/absoluta en los casos que define CSS Align); no alinea un flex item. En una fila flex, el eje horizontal se gobierna en el padre mediante `justify-content`; `justify-content:center` centra el conjunto de items. Además, los flex items tienen por defecto un mínimo automático basado en contenido; `min-w-0` lo elimina y permite encoger un título cuando debe partirse.

Fuentes normativas:

- [CSS Box Alignment, `justify-self`](https://www.w3.org/TR/css-align-3/#justify-self-property)
- [CSS Flexbox, distribución por `justify-content`](https://www.w3.org/TR/css-flexbox-1/#justify-content-property)
- [CSS Flexbox, mínimo automático de flex items](https://www.w3.org/TR/css-flexbox-1/#min-size-auto)
- [CSS Grid, alineación y estiramiento de grid items](https://www.w3.org/TR/css-grid-1/#grid-item-sizing)

## Patrón recomendado

### Título dentro de una tarjeta del roadmap

El conjunto icono+título debe ser el elemento que el padre centra. El título se encoge solo cuando sea necesario y conserva la tinta a la izquierda. La envoltura evita usar `justify-self-*` sobre el párrafo, porque el párrafo es un flex item.

```tsx
<div className="flex h-full items-center justify-center">
  <div className="flex min-w-0 max-w-full items-center gap-2.5">
    <NodeTypeBadge /* ... */ />
    <p className="min-w-0 text-left text-[15.5px] leading-tight font-medium wrap-break-word text-ink">
      {title}
    </p>
  </div>
</div>
```

`max-w-full` limita al conjunto a la tarjeta; el `min-w-0` del título permite que el algoritmo flex lo reduzca después de reservar el icono y el `gap`. No añadir `flex-1`, `grow` ni `w-full` al título: esas reglas lo estiran y eliminan su tamaño intrínseco. Tampoco es necesario `w-fit` aquí: con `width: auto`, el tamaño base de un flex item de texto es contenido y Flexbox lo encoge cuando no cabe.

La tarjeta conserva su tamaño explícito derivado de `roadmapNodeSizeForTitle()`. Es necesario para React Flow y la disposición del grafo; no se debe intentar que el ancho de la tarjeta dependa de las líneas ya envueltas en CSS.

### Fila de dependencia del diálogo

Primero hay que decidir qué debe permanecer centrado:

1. **La flecha siempre en el centro del diálogo.** Mantener tres columnas simétricas. Dentro de cada columna, usar una envoltura flex con `justify-center`; el `span` es intrínseco hasta alcanzar el límite de su columna y su texto queda a la izquierda.

   ```tsx
   <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-3">
     <div className="flex min-w-0 justify-center">
       <span className="max-w-full text-left text-sm leading-5 font-medium">{source}</span>
     </div>
     <ArrowRight className="size-5 shrink-0" />
     <div className="flex min-w-0 justify-center">
       <span className="max-w-full text-left text-sm leading-5 font-medium">{target}</span>
     </div>
   </li>
   ```

   Si el `span` se deja como grid item directo, `justify-self-center` también es válido: Grid deja de estirarlo cuando no usa `stretch`. La envoltura flex hace explícito el límite de cada lado y permite reutilizar el patrón si el contenido deja de ser un solo `span`.

2. **El conjunto origen–flecha–destino en el centro.** Usar tracks de contenido limitados, no dos `1fr`; por ejemplo `grid-cols-[fit-content(45%)_auto_fit-content(45%)] justify-center`. Esta alternativa centra el conjunto real, pero la flecha ya no queda necesariamente en el centro del diálogo cuando los títulos tienen anchos distintos. Debe elegirse solo si esa es la intención visual.

En ambos casos, `text-left` controla la alineación de los glifos dentro de la caja; `justify-center` o `justify-self-center` controla la posición de la caja. Son responsabilidades distintas.

## Si se requiere literalmente el ancho de la línea más larga

Es una medición posterior al layout, no un problema de clases Tailwind. Solo justificaría JavaScript si una prueba visual confirma que centrar la caja limitada no cumple el requisito. El mecanismo sería medir los fragmentos del `Range` del título con `Range.getClientRects()`, elegir el `width` máximo y aplicarlo como `inline-size`; tendría que actualizarse con cambios de fuente, texto o ancho (por ejemplo, con `ResizeObserver`). Esto añade riesgo de reflow y oscilación, por lo que no es la recomendación inicial.

La API devuelve rectángulos de los fragmentos de contenido: [CSSOM View, `Range.getClientRects()`](https://drafts.csswg.org/cssom-view/#dom-range-getclientrects).

## Criterios de aceptación visual

- En un título corto, el bloque icono+título se centra como conjunto y la primera letra queda a la izquierda de su propia caja.
- En un título largo, el icono no se encoge y el texto parte solo en el espacio restante.
- En el diálogo, la flecha se mantiene en el centro **o** el conjunto completo se centra, según la variante elegida; no se intentan ambas a la vez.
- Las pruebas inspeccionan clases/estructura y una prueba de navegador cubre un título corto y uno largo con la fuente real, porque JSDOM no calcula la distribución ni las líneas de CSS.
