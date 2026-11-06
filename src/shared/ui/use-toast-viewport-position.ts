'use client';

import { useEffect, useState } from 'react';

/** Keep global feedback beside the canvas controls, including resized side panels. */
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
      // Preserve useful text width on phones: stay left of the trigger and move
      // above its open menu instead of squeezing feedback beside that wider menu.
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
      // A compact editor is a bottom sheet over the canvas and its controls. Its height ignores
      // the entry transform, which never triggers another measurement.
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
      element.style.setProperty(
        '--toast-right',
        `${Math.min(right, Math.max(20, window.innerWidth - 216))}px`,
      );
      element.style.setProperty('--toast-bottom', `${bottom}px`);
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
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [viewport]);

  return setViewport;
}
