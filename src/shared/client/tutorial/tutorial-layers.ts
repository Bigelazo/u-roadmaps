const ignoredSurfaces = '.driver-popover, .u-roadmaps-tour-exit, [data-slot="toast-viewport"]';
const transientLayerSelector =
  '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [data-tutorial-layer]';
const panelSelector = '[data-slot="sidebar"][data-side="right"]';
const closeControlSelector = 'button[aria-label^="Cerrar"], button[aria-label^="Deseleccionar"]';

export function isShown(element: Element) {
  if (
    !element.isConnected ||
    element.closest('[hidden], [inert], [data-closed], [data-ending-style]')
  )
    return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function isIgnoredLayer(element: Element) {
  return Boolean(element.closest(ignoredSurfaces));
}

export function openTransientLayers() {
  const layers = new Set(document.querySelectorAll(transientLayerSelector));
  for (const trigger of document.querySelectorAll('[aria-expanded="true"][aria-controls]')) {
    const controlled = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    if (controlled) layers.add(controlled);
  }
  return [...layers].filter((layer) => !isIgnoredLayer(layer) && isShown(layer));
}

export function openPanels() {
  return [...document.querySelectorAll(panelSelector)].filter(isShown);
}

export function hasOpenLayer() {
  return openTransientLayers().length > 0 || openPanels().length > 0;
}

export function isEditable(element: Element) {
  return Boolean(
    element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'),
  );
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

const engineEvents = new WeakSet<Event>();

export function isEngineEvent(event: Event) {
  return engineEvents.has(event);
}

function dispatchEscape(layer: Element, reachesWindow: boolean) {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  engineEvents.add(event);
  const stopAtDocument = (candidate: Event) => {
    if (candidate === event) candidate.stopPropagation();
  };
  if (!reachesWindow) document.addEventListener('keydown', stopAtDocument);
  layer.dispatchEvent(event);
  document.removeEventListener('keydown', stopAtDocument);
}

async function dismiss(layer: Element, reachesWindow: boolean) {
  if (!isShown(layer)) return;
  dispatchEscape(layer, reachesWindow);
  await nextFrame();
  await nextFrame();
  if (isShown(layer)) layer.querySelector<HTMLElement>(closeControlSelector)?.click();
}

export async function closeLayers({
  keep,
  panelsBefore,
}: {
  keep: (layer: Element) => boolean;
  panelsBefore: ReadonlySet<Element>;
}) {
  const layers = openTransientLayers().filter((layer) => !keep(layer));
  const panels = openPanels().filter((panel) => !panelsBefore.has(panel) && !keep(panel));
  if (!layers.length && !panels.length) return;
  for (const layer of layers.reverse()) await dismiss(layer, false);
  for (const panel of panels) await dismiss(panel, true);
  const start = performance.now();
  while ([...layers, ...panels].some((layer) => isShown(layer)) && performance.now() - start < 400)
    await nextFrame();
}
