---
status: proposed
date: 2026-11-08
---

# Los atajos de teclado deben ser descubribles

Al revisar los diálogos de confirmación descubrimos que el lienzo permite eliminar varias Dependencias a la vez, aunque nada en la interfaz lo revela: ni siquiera quien desarrolla la aplicación lo sabía. La mayoría de las interacciones de teclado del Roadmap vienen de los valores por defecto de React Flow y de los componentes de Base UI, no de una decisión de producto, así que nadie las ha diseñado, documentado ni probado como funcionalidad. Proponemos tratarlas como funcionalidad: decidir cuáles se conservan, corregir las que fallan y hacerlas visibles. Este registro inventaría el estado actual como punto de partida para ese pulido. En Windows y Linux, ⌘ equivale a Ctrl.

## Inventario actual

### Lienzo: selección y eliminación

| Interacción | Efecto | Origen | Observaciones |
| --- | --- | --- | --- |
| ⌘ + clic en Nodos o Dependencias | Selección múltiple | React Flow (`multiSelectionKeyCode`) | Única forma de eliminar varias Dependencias con el puntero. |
| Shift + arrastrar sobre el fondo | Selección por área de Nodos y Dependencias | React Flow (`selectionKeyCode`) | Con Backspace después, elimina todas las Dependencias entre los Nodos del área en un solo gesto. |
| Backspace | Elimina las Dependencias seleccionadas, con confirmación | React Flow (`deleteKeyCode`) y `onEdgesDelete` en `RoadmapGraph.tsx` | Los Nodos seleccionados no se eliminan: `handleNodesChange` descarta los cambios `remove`. |
| Tab | Recorre Nodos y Dependencias con el foco | React Flow (`nodesFocusable`, Dependencias enfocables por defecto) | |
| Enter o Espacio sobre un elemento con foco | Lo selecciona | React Flow | Hay que verificar si en un Nodo abre el panel lateral como el clic, porque la selección por teclado no pasa por `onNodeClick`. |
| Esc sobre un elemento con foco | Lo deselecciona; si es el Nodo abierto, cierra el panel | React Flow y `handleKeyDownCapture` en `RoadmapGraph.tsx` | |

### Lienzo: mover Nodos (solo edición)

| Interacción | Efecto | Origen | Observaciones |
| --- | --- | --- | --- |
| Flechas con un Nodo seleccionado y con foco | Mueve el Nodo y persiste la posición | React Flow y `keyboardMovePendingRef` en `RoadmapGraph.tsx` | Probable defecto: React Flow desplaza 5 px y la aplicación ajusta a la cuadrícula de 20 px (`snapToRoadmapGrid`), así que el Nodo vuelve a su lugar. |
| Shift + flechas | Desplaza 20 px, una celda | React Flow (factor 4) | |
| ⌘ + clic en varios Nodos, luego flechas o arrastre | Mueve varios Nodos a la vez | React Flow | |

### Lienzo: navegación

| Interacción | Efecto | Origen | Observaciones |
| --- | --- | --- | --- |
| Rueda o pellizco | Zoom | React Flow | |
| Doble clic en el fondo | Acerca el zoom | React Flow (`zoomOnDoubleClick`) | |
| Espacio + arrastrar | Desplaza el lienzo | React Flow (`panActivationKeyCode`) | Redundante: arrastrar el fondo ya desplaza. |
| ⌘ + rueda | Zoom | React Flow (`zoomActivationKeyCode`) | Redundante con la rueda sola. |

### Esc definido por la aplicación

Se resuelve en este orden de prioridad:

1. Cancela el modo flecha de conexión táctil (`use-whole-node-connection.ts` y `RoadmapGraph.tsx`).
2. Cierra el menú radial de acciones del Nodo (`RoadmapGraph.tsx`).
3. Cierra la vista de estudiante de un Nodo abierta por el equipo docente (`RoadmapCanvasView.tsx`).
4. Cierra el panel del editor fuera de la Vista estudiantil (`RoadmapCanvasView.tsx`).

### Tutoriales

| Interacción | Efecto | Origen |
| --- | --- | --- |
| → y ← | Paso siguiente y anterior | `tutorial.tsx` |
| Esc | Abre «¿Salir del tutorial?»; dentro de ese diálogo, Esc vuelve al tutorial | `tutorial.tsx` |

Las flechas y Esc del tutorial se ignoran mientras el foco está en un diálogo, menú o lista ajenos al popover del tutorial. El teclado propio de driver.js está desactivado (`allowKeyboardControl: false`).

### Componentes estándar

- Diálogos de confirmación: Esc cierra, Tab queda atrapado en el diálogo y Enter activa el botón con foco.
- Selector de hora: flechas, Enter y búsqueda por escritura.
- Calendario: flechas por día, Re Pág y Av Pág por mes, Inicio y Fin por semana.
- Interruptores: Espacio.

No existen atajos de guardar, deshacer ni de formato en el editor Markdown.

## Consecuencias

- El pulido debe decidir qué atajos conservar. Espacio + arrastrar y ⌘ + rueda pueden desactivarse; la eliminación por área necesita una confirmación que diga cuántas Dependencias se eliminan.
- El movimiento con flechas debe desplazar una celda de la cuadrícula por pulsación, y Shift varias, para que funcione sin Shift.
- Los atajos que se conserven deben poder descubrirse: un panel de atajos abierto con `?` o desde el ícono del tutorial, pistas en los tooltips de Nodos y Dependencias, o un paso del tutorial docente.
- Cada atajo conservado necesita una prueba que lo cubra, porque hoy dependen de valores por defecto de bibliotecas que pueden cambiar al actualizarlas.
