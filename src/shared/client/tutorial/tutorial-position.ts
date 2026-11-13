import type { PopoverDOM, Side } from 'driver.js';
import { isIgnoredLayer, isShown } from './tutorial-layers';

type Box = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type Placement = Readonly<{ side: Side | 'over'; left: number; top: number; width?: number }>;

const gap = 16;
const minimumWidth = 240;
const blockingLayerSelector =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
const controlSelector =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';

function box(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function overlapArea(a: Box, b: Box) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function union(boxes: readonly Box[]): Box {
  return {
    left: Math.min(...boxes.map((rect) => rect.left)),
    top: Math.min(...boxes.map((rect) => rect.top)),
    right: Math.max(...boxes.map((rect) => rect.right)),
    bottom: Math.max(...boxes.map((rect) => rect.bottom)),
  };
}

function blockingLayers(popover: HTMLElement) {
  return [...document.querySelectorAll(blockingLayerSelector)].filter(
    (layer) => !popover.contains(layer) && !isIgnoredLayer(layer) && isShown(layer),
  );
}

function protectedControls(roots: readonly Element[]) {
  return roots.flatMap((root) =>
    [...(root.matches(controlSelector) ? [root] : []), ...root.querySelectorAll(controlSelector)]
      .filter(isShown)
      .map((control) => box(control.getBoundingClientRect())),
  );
}

export function positionTutorialPopover(
  popover: PopoverDOM,
  anchor: Element | null,
  exitControl: Element | null,
  preferredSide: Side = 'bottom',
  highlightedElements: readonly Element[] = [],
  offset = 0,
) {
  const wrapper = popover.wrapper;
  if (wrapper.style.getPropertyValue('--tutorial-popover-width'))
    wrapper.style.removeProperty('--tutorial-popover-width');
  let bounds = wrapper.getBoundingClientRect();
  const viewport: Box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  if (!anchor) {
    apply(
      wrapper,
      {
        side: 'over',
        left: (viewport.right - bounds.width) / 2,
        top: (viewport.bottom - bounds.height) / 2,
      },
      bounds,
      null,
    );
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const exit = exitControl ? box(exitControl.getBoundingClientRect()) : null;
  const anchorGap = gap + offset;
  const highlightedBounds = highlightedElements.map((element) =>
    box(element.getBoundingClientRect()),
  );
  const area =
    highlightedBounds.length && window.innerWidth < 640 ? union(highlightedBounds) : box(rect);
  const targets = [anchor, ...highlightedElements];
  const layers = blockingLayers(wrapper);
  const hostLayers = layers.filter((layer) => targets.some((target) => layer.contains(target)));
  const layerBoxes = layers
    .filter((layer) => !hostLayers.includes(layer))
    .map((layer) => box(layer.getBoundingClientRect()));
  const hostControls = protectedControls(hostLayers).filter(
    (control) => overlapArea(control, box(rect)) === 0,
  );
  const controls = protectedControls([...targets, ...layers]);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const clampX = (left: number, width: number) =>
    Math.max(gap, Math.min(left, viewport.right - width - gap));
  const clampY = (top: number, height: number) =>
    Math.max(gap, Math.min(top, viewport.bottom - height - gap));
  const sideCandidate = (side: Side, width: number, height: number): Placement => {
    if (side === 'bottom')
      return { side, left: clampX(centerX - width / 2, width), top: area.bottom + anchorGap };
    if (side === 'top')
      return { side, left: clampX(centerX - width / 2, width), top: area.top - height - anchorGap };
    if (side === 'left')
      return {
        side,
        left: area.left - width - anchorGap,
        top: clampY(centerY - height / 2, height),
      };
    return { side, left: area.right + anchorGap, top: clampY(centerY - height / 2, height) };
  };
  const placed = (placement: Placement, width: number, height: number): Box => ({
    left: placement.left,
    top: placement.top,
    right: placement.left + width,
    bottom: placement.top + height,
  });
  const clear = (candidate: Box) =>
    candidate.left >= gap &&
    candidate.top >= gap &&
    candidate.right <= viewport.right - gap &&
    candidate.bottom <= viewport.bottom - gap &&
    (!exit || overlapArea(inflate(candidate, gap), exit) === 0) &&
    layerBoxes.every((layer) => overlapArea(candidate, layer) === 0) &&
    hostControls.every((control) => overlapArea(candidate, control) === 0) &&
    [box(rect), ...highlightedBounds].every(
      (target) => overlapArea(candidate, inflate(target, 8)) === 0,
    );
  const sides: Side[] = [
    preferredSide,
    ...(['bottom', 'top', 'left', 'right'] as const).filter((side) => side !== preferredSide),
  ];
  for (const side of sides) {
    const candidate = sideCandidate(side, bounds.width, bounds.height);
    if (clear(placed(candidate, bounds.width, bounds.height))) {
      apply(wrapper, candidate, bounds, { centerX, centerY });
      return;
    }
  }
  for (const side of sides.filter((side) => side === 'left' || side === 'right')) {
    const room =
      side === 'left' ? area.left - anchorGap - gap : viewport.right - area.right - anchorGap - gap;
    if (room < minimumWidth || room >= bounds.width) continue;
    wrapper.style.setProperty('--tutorial-popover-width', `${Math.floor(room)}px`);
    const narrow = wrapper.getBoundingClientRect();
    const candidate = sideCandidate(side, narrow.width, narrow.height);
    if (clear(placed(candidate, narrow.width, narrow.height))) {
      apply(wrapper, { ...candidate, width: narrow.width }, narrow, { centerX, centerY });
      return;
    }
    wrapper.style.removeProperty('--tutorial-popover-width');
  }
  bounds = wrapper.getBoundingClientRect();
  const fallbacks: Placement[] = [
    ...sides.map((side) => {
      const candidate = sideCandidate(side, bounds.width, bounds.height);
      return {
        ...candidate,
        left: clampX(candidate.left, bounds.width),
        top: clampY(candidate.top, bounds.height),
      };
    }),
    ...[gap, viewport.right - bounds.width - gap].flatMap((left) =>
      [gap, viewport.bottom - bounds.height - gap].map((top) => ({
        side: 'over' as const,
        left,
        top,
      })),
    ),
    ...(exit
      ? [
          {
            side: 'over' as const,
            left: clampX(centerX - bounds.width / 2, bounds.width),
            top: clampY(exit.bottom + gap, bounds.height),
          },
        ]
      : []),
  ];
  const cost = (placement: Placement) => {
    const candidate = placed(placement, bounds.width, bounds.height);
    return (
      controls.reduce((total, control) => total + overlapArea(candidate, control) * 20, 0) +
      (exit ? overlapArea(inflate(candidate, gap), exit) * 200 : 0) +
      [area, ...highlightedBounds].reduce(
        (total, target) => total + overlapArea(candidate, inflate(target, 8)) * 10,
        0,
      ) +
      layerBoxes.reduce((total, layer) => total + overlapArea(candidate, layer), 0)
    );
  };
  const best = fallbacks.reduce((winner, candidate) =>
    cost(candidate) < cost(winner) ? candidate : winner,
  );
  apply(wrapper, { ...best, side: 'over' }, bounds, null);
}

function inflate(area: Box, by: number): Box {
  return {
    left: area.left - by,
    top: area.top - by,
    right: area.right + by,
    bottom: area.bottom + by,
  };
}

function apply(
  wrapper: HTMLElement,
  placement: Placement,
  bounds: DOMRect,
  center: { centerX: number; centerY: number } | null,
) {
  wrapper.dataset.tutorialPlacement = placement.side;
  wrapper.style.setProperty('--tutorial-popover-left', `${placement.left}px`);
  wrapper.style.setProperty('--tutorial-popover-top', `${placement.top}px`);
  if (!center) return;
  wrapper.style.setProperty(
    '--tutorial-arrow-left',
    `${Math.max(gap, Math.min(center.centerX - placement.left, bounds.width - gap))}px`,
  );
  wrapper.style.setProperty(
    '--tutorial-arrow-top',
    `${Math.max(gap, Math.min(center.centerY - placement.top, bounds.height - gap))}px`,
  );
}
