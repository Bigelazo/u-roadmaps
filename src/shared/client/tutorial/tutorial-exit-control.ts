import { isIgnoredLayer, isShown } from './tutorial-layers';

type Box = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type Shift = Readonly<{ x: number; y: number }>;

const gap = 8;
const obstacleSelector =
  '[data-slot="sidebar"][data-side="right"], [data-slot="sheet-content"], [role="dialog"], [role="alertdialog"], [data-tutorial-exit-avoid]';
const shiftProperty = '--tutorial-exit-shift';

function box(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function shifted(area: Box, { x, y }: Shift): Box {
  return { left: area.left + x, top: area.top + y, right: area.right + x, bottom: area.bottom + y };
}

function overlaps(a: Box, b: Box) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function contains(outer: Box, inner: Box) {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  );
}

function visibleArea(element: Element): Box {
  let area: Box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const clip = parent.getBoundingClientRect();
    area = {
      left: Math.max(area.left, clip.left),
      top: Math.max(area.top, clip.top),
      right: Math.min(area.right, clip.right),
      bottom: Math.min(area.bottom, clip.bottom),
    };
  }
  return area;
}

function currentShift(exit: HTMLElement): Shift {
  const [x = 0, y = 0] = (exit.style.getPropertyValue(shiftProperty) || '0 0')
    .split(' ')
    .map(Number);
  return { x, y };
}

function exitObstacles(exit: HTMLElement) {
  return [...document.querySelectorAll(obstacleSelector)]
    .filter(
      (element) =>
        !element.contains(exit) &&
        !exit.contains(element) &&
        !isIgnoredLayer(element) &&
        isShown(element),
    )
    .map((element) => box(element.getBoundingClientRect()));
}

export function placeTutorialExit(exit: HTMLElement) {
  const applied = currentShift(exit);
  const natural = shifted(box(exit.getBoundingClientRect()), { x: -applied.x, y: -applied.y });
  const obstacles = exitObstacles(exit);
  const area = visibleArea(exit);
  const candidates: Shift[] = [{ x: 0, y: 0 }];
  for (const obstacle of obstacles) {
    candidates.push(
      { x: obstacle.left - gap - natural.right, y: 0 },
      { x: 0, y: obstacle.top - gap - natural.bottom },
      { x: 0, y: obstacle.bottom + gap - natural.top },
    );
  }
  const fits = (shift: Shift) => {
    const placed = shifted(natural, shift);
    return contains(area, placed) && obstacles.every((obstacle) => !overlaps(placed, obstacle));
  };
  const best = candidates
    .filter(fits)
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0] ?? { x: 0, y: 0 };
  const next = `${Math.round(best.x)} ${Math.round(best.y)}`;
  if (exit.style.getPropertyValue(shiftProperty) === next) return;
  exit.style.setProperty(shiftProperty, next);
  exit.style.translate = `${Math.round(best.x)}px ${Math.round(best.y)}px`;
}

export function releaseTutorialExit(exit: HTMLElement | null) {
  exit?.style.removeProperty(shiftProperty);
  exit?.style.removeProperty('translate');
}
