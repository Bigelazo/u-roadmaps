# Research: testing e2e de un canvas React Flow con Playwright

Ticket: [#15](https://github.com/Bigelazo/u-roadmaps/issues/15). Mapa wayfinder: [#1](https://github.com/Bigelazo/u-roadmaps/issues/1).

## Conclusión

React Flow recomienda Cypress o Playwright para probar una aplicación que lo usa porque necesita medir nodos en un DOM real para renderizar aristas; con Playwright no requiere configuración adicional. [React Flow: Testing](https://reactflow.dev/learn/advanced-use/testing)

La suite oficial de xyflow mantiene pruebas e2e independientes del framework bajo `tests/playwright/e2e`, ejecutadas contra flujos de ejemplo. [xyflow: README de Playwright](https://github.com/xyflow/xyflow/blob/main/tests/playwright/README.md)

## Selectores

- Para controles propios de la aplicación, priorizar `getByRole`, `getByLabel` y `getByTestId`; Playwright recomienda atributos de cara al usuario o contratos explícitos y desaconseja selectores CSS/XPath acoplados a la estructura DOM. [Playwright: Locators](https://playwright.dev/docs/locators)
- Para nodos y aristas propios, añadir `data-testid` estable mediante `domAttributes`; React Flow admite esos atributos DOM tanto en nodos como en aristas. [React Flow: Accessibility, DOM attributes](https://reactflow.dev/learn/advanced-use/accessibility#dom-attributes)
- Un nodo renderizado expone `.react-flow__node` y `data-id` en el wrapper; los tests oficiales combinan ambas cosas para identificar nodos. Esto es un detalle de implementación usado por xyflow, no un contrato de nuestra aplicación, por lo que debe aislarse en un helper de selectores. [NodeWrapper](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/NodeWrapper/index.tsx) [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)
- Un handle expone `.react-flow__handle` y atributos como `data-nodeid`, `data-handleid` y `data-handlepos`; seleccionar un handle por `data-nodeid` y, cuando haya varios, por `data-handleid` evita depender de su posición visual. [Handle](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/Handle/index.tsx)
- La arista renderizada usa `.react-flow__edge` y `data-id`; la suite oficial aserta la conexión nueva por su `data-id` y por el conteo de aristas. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)
- El pane y el viewport se identifican como `.react-flow__pane` y `.react-flow__viewport`; xyflow lee el `style.transform` del viewport para comprobar pan y zoom. [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts) [xyflow helper de transform](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/utils.ts)
- Si se implementan controles de React Flow, sus etiquetas ARIA son configurables con `ariaLabelConfig`; por tanto, `getByRole('button', { name: ... })` es preferible a seleccionar sus clases internas. [React Flow: Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)

## Interacciones soportadas

Los ejemplos siguientes son patrones de pruebas e2e. Los identificadores `node-*` y `handle-*` representan `data-testid` propios.

### Click y selección

Un click de locator espera que el objetivo sea único, visible, estable, capaz de recibir eventos y habilitado; después se debe esperar el efecto observable con una aserción web-first. [Playwright: Auto-waiting](https://playwright.dev/docs/actionability) [Playwright: Assertions](https://playwright.dev/docs/test-assertions)

```ts
const node = page.getByTestId('node-algebra');
await node.click();
await expect(node).toHaveClass(/selected/);
```

xyflow aplica exactamente el patrón `locator.click()` seguido de `toHaveClass(/selected/)` para selección de nodos. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)

### Arrastrar un nodo y crear una conexión

`locator.dragTo()` está soportado por Playwright, pero para control preciso del gesto Playwright documenta la secuencia de bajo nivel `hover`, `mouse.down`, `mouse.move` y `mouse.up`. [Playwright: Actions, drag and drop](https://playwright.dev/docs/input#drag-and-drop)

```ts
const node = page.getByTestId('node-algebra');
await node.hover();
await page.mouse.down();
await page.mouse.move(500, 400, { steps: 4 });
await page.mouse.up();
```

La suite oficial de xyflow usa esa secuencia, no `dragTo()`, para arrastrar nodos y comprueba que cambió el transform del nodo. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)

```ts
const source = page.getByTestId('handle-algebra-source');
const target = page.getByTestId('handle-calculo-target');

await source.hover();
await page.mouse.down();
await target.hover();
await expect(page.locator('.react-flow__connectionline')).toBeInViewport();
await page.mouse.up();
await expect(page.getByTestId('edge-algebra-calculo')).toBeVisible();
```

xyflow crea conexiones con `hover` sobre el handle de origen, `mouse.down`, movimiento al de destino y `mouse.up`; durante el gesto aserta la línea de conexión y al terminar la arista creada. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)

`page.mouse` opera en píxeles CSS relativos al viewport, mientras que el canvas transforma posiciones con pan y zoom; para destinos que no tengan locator propio, calcular las coordenadas desde `boundingBox()` del elemento visible y no desde `node.position`. [Playwright: Mouse](https://playwright.dev/docs/api/class-mouse) [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts)

### Pan y zoom

React Flow configura por defecto pan mediante pointer drag y zoom mediante scroll o pinch; estas interacciones pueden cambiarse con props de interacción. [React Flow: Panning and Zooming](https://reactflow.dev/learn/concepts/the-viewport)

```ts
const pane = page.locator('.react-flow__pane');
const viewport = page.locator('.react-flow__viewport');

await pane.hover();
await page.mouse.down();
await page.mouse.move(700, 500, { steps: 4 });
await page.mouse.up();

await pane.hover();
await page.mouse.wheel(0, 100);
```

xyflow comprueba pan comparando el `translate` antes y después del gesto, y zoom comparando el `scale` tras `mouse.wheel`. [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts)

`mouse.wheel()` no espera a que termine el desplazamiento, así que la prueba debe esperar un estado observable posterior, como el transform, el texto de un indicador de zoom o el nodo esperado en pantalla. [Playwright: Mouse wheel](https://playwright.dev/docs/api/class-mouse#mouse-wheel)

## Patrones de xyflow que conviene adoptar

- Preparar un flujo pequeño y determinista por caso e2e, navegar a su ruta antes de cada prueba y esperar un elemento que demuestre que el canvas ya se midió, por ejemplo un nodo visible o la primera arista. xyflow espera nodos visibles y, en los tests de pane, espera una arista antes de interactuar; la documentación de React Flow exige esperar la medición antes de probar aristas. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts) [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts) [React Flow: Testing edges](https://reactflow.dev/learn/advanced-use/testing#testing-edges)
- Usar aserciones que reintentan (`toBeVisible`, `toHaveCount`, `toHaveClass`) en vez de consultar un estado una vez; Playwright las repite hasta que pasa la condición o vence su timeout. [Playwright: Assertions](https://playwright.dev/docs/test-assertions)
- Probar también el resultado negativo que pertenezca al producto: xyflow verifica que `draggable: false` no mueva un nodo y que `connectable: false` no cree una arista. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)
- Para selección múltiple, mantener `Shift`, ejecutar el drag sobre el pane y soltar la tecla después del gesto; ese es el patrón usado por xyflow. [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)
- Aislar cada prueba, incluida su estado de datos, para prevenir fallos en cascada; Playwright lo recomienda explícitamente. [Playwright: Best practices](https://playwright.dev/docs/best-practices#make-tests-as-isolated-as-possible)

## Frontera e2e vs. unit/integration

React Flow indica que Jest necesita mocks de `ResizeObserver`, `DOMMatrixReadOnly`, dimensiones y `getBBox`; además recomienda desactivar el drag de nodos y pane para eventos de mouse fuera de un navegador. [React Flow: Testing with Jest](https://reactflow.dev/learn/advanced-use/testing#using-jest)

- Dejar en unit/integration las reglas puras del dominio: prerequisitos válidos, prevención de ciclos, autorización, serialización y la reducción de cambios de nodos/aristas. React Flow expone `applyNodeChanges`, `applyEdgeChanges` y `addEdge` para aplicar esos cambios, y permite validar conexiones con `isValidConnection`. [React Flow: Adding Interactivity](https://reactflow.dev/learn/concepts/adding-interactivity) [React Flow: isValidConnection](https://reactflow.dev/api-reference/types/is-valid-connection)
- Cubrir con e2e los contratos que sólo existen al integrar navegador, React Flow y aplicación: docente crea, arrastra, conecta y elimina; el guardado sobrevive a una recarga; estudiante abre un roadmap, selecciona un nodo y navega al detalle. Esta separación sigue la recomendación de Playwright de verificar comportamiento visible al usuario y no detalles de implementación. [Playwright: Best practices](https://playwright.dev/docs/best-practices#test-user-visible-behavior)
- No duplicar en la aplicación las pruebas internas de xyflow, como la aritmética exacta de su transform; comprobar en cambio la consecuencia que pertenece al producto, como una arista persistida o la navegación a la unidad. xyflow ya prueba pan, zoom, drag y conexiones en su suite propia. [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts) [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)

## Riesgos de flakiness y mitigaciones

- **Canvas aún no medido:** una arista depende de las dimensiones de nodos; esperar primero un nodo visible o una arista renderizada elimina la carrera que la documentación de React Flow identifica para pruebas de aristas. [React Flow: Testing edges](https://reactflow.dev/learn/advanced-use/testing#testing-edges)
- **Gestos demasiado cortos:** `nodeDragThreshold` vale `1` por defecto y establece los píxeles que el mouse debe moverse antes de iniciar un drag; mover varios píxeles y varios pasos es más robusto. Los fixtures e2e de xyflow fijan `nodeDragThreshold: 0`, por lo que puede fijarse a cero sólo en un fixture dedicado si la interacción de producción no depende de ese umbral. [React Flow: ReactFlow props](https://reactflow.dev/api-reference/react-flow#nodedragthreshold) [xyflow fixture de nodos](https://github.com/xyflow/xyflow/blob/main/examples/react/src/generic-tests/nodes/general.ts) [xyflow issue #4775](https://github.com/xyflow/xyflow/issues/4775)
- **Punto de acción cubierto o re-renderizado:** los locators vuelven a localizar el elemento en cada acción y las acciones esperan visibilidad, estabilidad y recepción de eventos; no usar `force: true` salvo que se quiera ignorar deliberadamente esos checks. [Playwright: Locators](https://playwright.dev/docs/locators) [Playwright: Auto-waiting](https://playwright.dev/docs/actionability)
- **Coordenadas fijas y zoom/pan:** obtener `boundingBox()` después de que el destino esté visible; los píxeles del mouse son del viewport, no las coordenadas lógicas del flow. [Playwright: Mouse](https://playwright.dev/docs/api/class-mouse) [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts)
- **Esperas temporales:** evitar `waitForTimeout`; preferir una aserción que reintenta sobre la línea de conexión, la arista, el conteo o el estado persistido. Playwright recomienda aserciones web-first, y su documentación señala que las aserciones no reintentables pueden volver flaky una prueba asíncrona. [Playwright: Best practices](https://playwright.dev/docs/best-practices#use-web-first-assertions) [Playwright: Assertions](https://playwright.dev/docs/test-assertions)
- **Diferencias de navegador:** xyflow ejecuta Chromium, Firefox y WebKit, con dos reintentos, un worker y trazas en el primer reintento en CI; adoptar la misma instrumentación facilita diagnosticar gestos inestables. [xyflow Playwright config](https://github.com/xyflow/xyflow/blob/main/tests/playwright/playwright.shared.config.ts)
- **Touch:** la propia suite de xyflow usa CDP para touch y salta esos tests fuera de Chromium, por lo que el soporte táctil debe tener una matriz de pruebas explícita y no inferirse del mouse desktop. [xyflow pane e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/pane.spec.ts)

## Testing Decisions para SPEC.md

1. Usar Playwright para e2e del canvas; mantener las reglas de dominio y cambios sintéticos de grafo en unit/integration. [React Flow: Testing](https://reactflow.dev/learn/advanced-use/testing) [React Flow: Adding Interactivity](https://reactflow.dev/learn/concepts/adding-interactivity)
2. Definir `data-testid` propios para nodos, handles, aristas y controles de la aplicación mediante `domAttributes` o markup propio; encapsular cualquier selector `.react-flow__*`. [React Flow: Accessibility, DOM attributes](https://reactflow.dev/learn/advanced-use/accessibility#dom-attributes) [Playwright: Locators](https://playwright.dev/docs/locators)
3. Usar para drag y conexión `hover` + `mouse.down` + `mouse.move({ steps })` + `mouse.up`, con destinos localizados o calculados desde `boundingBox()`. [Playwright: Actions](https://playwright.dev/docs/input#drag-and-drop) [xyflow nodes e2e](https://github.com/xyflow/xyflow/blob/main/tests/playwright/e2e/nodes.spec.ts)
4. Esperar medición antes de cualquier gesto y asertar el resultado observable con matchers que reintentan; no introducir esperas fijas. [React Flow: Testing edges](https://reactflow.dev/learn/advanced-use/testing#testing-edges) [Playwright: Assertions](https://playwright.dev/docs/test-assertions)
5. Cubrir e2e mínimo de docente: crear, arrastrar, conectar, eliminar y persistir tras recargar; cubrir e2e mínimo de estudiante: abrir roadmap y seleccionar nodo hacia su detalle. Esos son flujos visibles de usuario, no internals de xyflow. [Playwright: Best practices](https://playwright.dev/docs/best-practices#test-user-visible-behavior)
6. Fijar viewport y datos de fixture; mover más que el umbral de drag o fijar `nodeDragThreshold={0}` sólo en el fixture de e2e; activar trazas al reintento en CI. [React Flow: ReactFlow props](https://reactflow.dev/api-reference/react-flow#nodedragthreshold) [xyflow fixture de nodos](https://github.com/xyflow/xyflow/blob/main/examples/react/src/generic-tests/nodes/general.ts) [xyflow Playwright config](https://github.com/xyflow/xyflow/blob/main/tests/playwright/playwright.shared.config.ts)

## Fuentes permitidas consultadas

- [Playwright: Locators](https://playwright.dev/docs/locators)
- [Playwright: Actions](https://playwright.dev/docs/input)
- [Playwright: Mouse API](https://playwright.dev/docs/api/class-mouse)
- [Playwright: Auto-waiting](https://playwright.dev/docs/actionability)
- [Playwright: Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright: Best practices](https://playwright.dev/docs/best-practices)
- [React Flow: Testing](https://reactflow.dev/learn/advanced-use/testing)
- [React Flow: Adding Interactivity](https://reactflow.dev/learn/concepts/adding-interactivity)
- [React Flow: Panning and Zooming](https://reactflow.dev/learn/concepts/the-viewport)
- [React Flow: Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)
- [xyflow: pruebas e2e Playwright](https://github.com/xyflow/xyflow/tree/main/tests/playwright)
