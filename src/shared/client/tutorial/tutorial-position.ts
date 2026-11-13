import type { PopoverDOM, Side } from 'driver.js';

export function positionTutorialPopover(
  popover: PopoverDOM,
  anchor: Element,
  exitControl: Element | null,
  preferredSide: Side = 'bottom',
  highlightedElements: readonly Element[] = [],
  offset = 0,
) {
  const rect = anchor.getBoundingClientRect();
  const bounds = popover.wrapper.getBoundingClientRect();
  const exit = exitControl?.getBoundingClientRect();
  const gap = 16;
  const anchorGap = gap + offset;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const clampX = (left: number) =>
    Math.max(gap, Math.min(left, window.innerWidth - bounds.width - gap));
  const clampY = (top: number) =>
    Math.max(gap, Math.min(top, window.innerHeight - bounds.height - gap));
  const highlightedBounds = highlightedElements.map((element) => element.getBoundingClientRect());
  const area =
    highlightedBounds.length && window.innerWidth < 640
      ? {
          top: Math.min(...highlightedBounds.map((rect) => rect.top)),
          right: Math.max(...highlightedBounds.map((rect) => rect.right)),
          bottom: Math.max(...highlightedBounds.map((rect) => rect.bottom)),
          left: Math.min(...highlightedBounds.map((rect) => rect.left)),
        }
      : rect;
  const candidates = {
    bottom: { left: clampX(centerX - bounds.width / 2), top: area.bottom + anchorGap },
    top: { left: clampX(centerX - bounds.width / 2), top: area.top - bounds.height - anchorGap },
    left: { left: area.left - bounds.width - anchorGap, top: clampY(centerY - bounds.height / 2) },
    right: { left: area.right + anchorGap, top: clampY(centerY - bounds.height / 2) },
  };
  const sides = [
    preferredSide,
    ...(['bottom', 'top', 'left', 'right'] as const).filter((side) => side !== preferredSide),
  ];
  const side = sides.find((side) => {
    const { left, top } = candidates[side];
    const right = left + bounds.width;
    const bottom = top + bounds.height;
    return (
      left >= gap &&
      top >= gap &&
      right <= window.innerWidth - gap &&
      bottom <= window.innerHeight - gap &&
      (!exit ||
        right + gap <= exit.left ||
        left - gap >= exit.right ||
        bottom + gap <= exit.top ||
        top - gap >= exit.bottom)
    );
  });
  const position = side
    ? candidates[side]
    : {
        left: clampX(centerX - bounds.width / 2),
        top: Math.max(exit ? exit.bottom + gap : gap, clampY(rect.bottom + gap)),
      };
  popover.wrapper.dataset.tutorialPlacement = side ?? 'over';
  popover.wrapper.style.setProperty('--tutorial-popover-left', `${position.left}px`);
  popover.wrapper.style.setProperty('--tutorial-popover-top', `${position.top}px`);
  popover.wrapper.style.setProperty(
    '--tutorial-arrow-left',
    `${Math.max(gap, Math.min(centerX - position.left, bounds.width - gap))}px`,
  );
  popover.wrapper.style.setProperty(
    '--tutorial-arrow-top',
    `${Math.max(gap, Math.min(centerY - position.top, bounds.height - gap))}px`,
  );
}
