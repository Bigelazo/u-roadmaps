'use client';

import { useEffect, useState } from 'react';

export const TOAST_OBSTACLES_EVENT = 'u-roadmaps:toast-obstacles';

type Area = Readonly<{ left: number; top: number; right: number; bottom: number }>;

function overlaps(a: Area, b: Area) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function clearOfAvoidedAreas(
  placement: Readonly<{ right: number; bottom: number }>,
  size: Readonly<{ width: number; height: number }>,
  avoided: readonly Area[],
  viewport: Readonly<{ width: number; height: number }>,
) {
  const gap = 12;
  const area = ({ right, bottom }: Readonly<{ right: number; bottom: number }>): Area => ({
    left: viewport.width - right - size.width,
    top: viewport.height - bottom - size.height,
    right: viewport.width - right,
    bottom: viewport.height - bottom,
  });
  const fits = (candidate: Readonly<{ right: number; bottom: number }>) => {
    const placed = area(candidate);
    return (
      placed.left >= 16 &&
      placed.top >= 16 &&
      avoided.every((obstacle) => !overlaps(placed, obstacle))
    );
  };
  if (fits(placement)) return placement;
  const candidates = avoided.flatMap((obstacle) => [
    { right: placement.right, bottom: viewport.height - obstacle.top + gap },
    { right: viewport.width - obstacle.left + gap, bottom: placement.bottom },
  ]);
  return candidates.find(fits) ?? placement;
}

export function useToastViewportPosition() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!viewport) return;
    const element = viewport;
    let frame = 0;
    const observed = new Set<Element>();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);

    function update() {
      frame = 0;
      const anchor = document.querySelector<HTMLElement>('[data-toast-anchor]');
      const obstacle = document.querySelector<HTMLElement>('[data-toast-obstacle]');
      const targets = [
        anchor,
        obstacle,
        anchor?.closest('.react-flow'),
        ...document.querySelectorAll('[data-slot="sidebar"]'),
        ...element.querySelectorAll('[data-slot="toast"]'),
      ];
      for (const target of targets) {
        if (target && !observed.has(target)) {
          resizeObserver?.observe(target);
          observed.add(target);
        }
      }
      for (const target of observed) {
        if (!target.isConnected) {
          resizeObserver?.unobserve(target);
          observed.delete(target);
        }
      }

      const bounds = anchor?.getBoundingClientRect();
      const rect =
        bounds &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.left > 0 &&
        bounds.left < window.innerWidth &&
        bounds.right > 0
          ? bounds
          : null;
      const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight;
      const sidebar = document.querySelector<HTMLElement>(
        '[data-slot="sidebar"][data-side="right"]',
      );
      const sidebarRect = sidebar?.getBoundingClientRect();
      const right = rect
        ? Math.max(20, window.innerWidth - rect.left + 16)
        : sidebarRect && sidebarRect.left > 1
          ? Math.max(20, window.innerWidth - sidebarRect.left + 20)
          : 20;
      let bottom = visible ? Math.max(20, window.innerHeight - rect.bottom) : 20;
      if (sidebar && sidebarRect && sidebarRect.left <= 1 && sidebarRect.height > 0) {
        bottom = Math.max(bottom, sidebar.offsetHeight + 12);
      }
      if (visible && obstacle && !obstacle.hidden) {
        const menu = obstacle.getBoundingClientRect();
        if (menu.width && menu.height) {
          bottom = Math.max(bottom, window.innerHeight - menu.top + 12);
        }
      }
      const toastHeight = Math.max(
        0,
        ...Array.from(
          element.querySelectorAll<HTMLElement>('[data-slot="toast"]'),
          (item) => item.offsetHeight,
        ),
      );
      bottom = Math.min(bottom, Math.max(20, window.innerHeight - toastHeight - 16));
      const placement = clearOfAvoidedAreas(
        { right: Math.min(right, Math.max(20, window.innerWidth - 216)), bottom },
        { width: element.getBoundingClientRect().width, height: toastHeight },
        Array.from(document.querySelectorAll('[data-toast-avoid]'), (avoided) =>
          avoided.getBoundingClientRect(),
        ).filter((avoided) => avoided.width > 0 && avoided.height > 0),
        { width: window.innerWidth, height: window.innerHeight },
      );
      element.style.setProperty('--toast-right', `${placement.right}px`);
      element.style.setProperty('--toast-bottom', `${placement.bottom}px`);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-open', 'data-closed'],
    });
    window.addEventListener('resize', schedule);
    window.addEventListener(TOAST_OBSTACLES_EVENT, schedule);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener(TOAST_OBSTACLES_EVENT, schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [viewport]);

  return setViewport;
}
