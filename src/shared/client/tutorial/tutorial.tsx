'use client';

import 'driver.js/dist/driver.css';
import './tutorial.css';

import { driver, type Config, type Driver, type DriveStep } from 'driver.js';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';

/** Marks the question-mark icon that opens a Roadmap tutorial on its origin page. */
export const TUTORIAL_TRIGGER_ATTRIBUTE = 'data-tutorial-trigger';

const closingPopoverKey = 'u-roadmaps:tutorial-closing-popover';

/** One step of a Roadmap tutorial; `prepare` runs before the step is shown. */
export type TutorialStep = Readonly<{
  element: string | (() => Element | null);
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  prepare?: () => Promise<void> | void;
}>;

/** Shared driver.js look and Spanish labels. Animations stay on (ADR-0022). */
const baseConfig: Config = {
  animate: true,
  popoverClass: 'u-roadmaps-tour',
  overlayColor: 'black',
  overlayOpacity: 0.55,
  stagePadding: 8,
  stageRadius: 12,
  smoothScroll: true,
  nextBtnText: 'Siguiente',
  prevBtnText: 'Anterior',
  doneBtnText: 'Finalizar',
  closeBtnLabel: 'Cerrar tutorial',
  progressText: '{{current}} de {{total}}',
};

function resolveElement(element: TutorialStep['element']) {
  return typeof element === 'string' ? document.querySelector(element) : element();
}

/** Resolves once the element exists, or after a short wait. */
export async function waitForElement(element: TutorialStep['element'], timeoutMs = 3000) {
  const start = performance.now();
  while (!resolveElement(element) && performance.now() - start < timeoutMs)
    await new Promise((resolve) => setTimeout(resolve, 50));
}

/** Click a page element as the tutorial, for instance to open a Node detail. */
export function clickElement(selector: string) {
  document.querySelector<HTMLElement>(selector)?.click();
}

/**
 * Runs a Roadmap tutorial as soon as its first element exists. It advances only through
 * its own controls; Esc, the close control and overlay clicks ask before leaving.
 */
export function RoadmapTutorial({ steps }: { steps: readonly TutorialStep[] }) {
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const confirmingRef = useRef(false);
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    let cancelled = false;
    let moving = false;
    const askExit = () => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setIsConfirmingExit(true);
    };
    const move = async (tour: Driver, offset: 1 | -1) => {
      if (confirmingRef.current || moving) return;
      const index = (tour.getActiveIndex() ?? 0) + offset;
      if (index < 0) return;
      if (index >= steps.length) {
        tour.destroy();
        return;
      }
      moving = true;
      try {
        await steps[index].prepare?.();
        await waitForElement(steps[index].element);
        tour.moveTo(index);
      } finally {
        moving = false;
      }
    };
    const tour = driver({
      ...baseConfig,
      showProgress: true,
      allowKeyboardControl: false,
      disableActiveInteraction: true,
      steps: steps.map((step): DriveStep => ({
        element: () => resolveElement(step.element) ?? document.body,
        popover: { title: step.title, description: step.description, side: step.side },
      })),
      onNextClick: () => void move(tour, 1),
      onPrevClick: () => void move(tour, -1),
      onDoneClick: () => void move(tour, 1),
      onCloseClick: askExit,
      onDestroyStarted: askExit,
      overlayClickBehavior: askExit,
    });
    driverRef.current = tour;

    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmingRef.current || !tour.isActive()) return;
      // Deferred, so the confirmation opened here does not also receive this Esc.
      if (event.key === 'Escape') setTimeout(askExit, 0);
      else if (event.key === 'ArrowRight') void move(tour, 1);
      else if (event.key === 'ArrowLeft') void move(tour, -1);
    };
    // Capture runs before the exit confirmation handles its own Esc.
    window.addEventListener('keydown', onKeyDown, true);

    void (async () => {
      await steps[0]?.prepare?.();
      if (steps[0]) await waitForElement(steps[0].element);
      if (!cancelled) tour.drive();
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown, true);
      tour.destroy();
      driverRef.current = null;
    };
  }, [steps]);

  const resume = () => {
    setIsConfirmingExit(false);
    // Released after the closing key or click has been handled.
    setTimeout(() => {
      confirmingRef.current = false;
    }, 0);
  };
  const leave = () => {
    driverRef.current?.destroy();
    resume();
  };

  return (
    <AlertDialog open={isConfirmingExit} onOpenChange={(open) => (open ? undefined : resume())}>
      <AlertDialogContent className="u-roadmaps-tour-exit z-[1000000001]">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir del tutorial?</AlertDialogTitle>
          <AlertDialogDescription>
            Podrás seguir explorando el mapa de práctica y repetir el tutorial cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="outline" onClick={leave}>
            Salir
          </AlertDialogCancel>
          <AlertDialogAction onClick={resume}>Seguir con el tutorial</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Called when "Salir" leaves the Practice roadmap for the tutorial's origin. */
export function markTutorialClosingPopover() {
  try {
    sessionStorage.setItem(closingPopoverKey, '1');
  } catch {
    // Without storage the origin simply shows no closing popover.
  }
}

/**
 * On the origin page, after a Roadmap tutorial was finished or left: highlights the
 * question-mark icon and says the tutorial can be repeated from there.
 */
export function TutorialClosingPopover() {
  useEffect(() => {
    let pending = false;
    try {
      pending = sessionStorage.getItem(closingPopoverKey) === '1';
      sessionStorage.removeItem(closingPopoverKey);
    } catch {
      return;
    }
    if (!pending) return;
    const selector = `[${TUTORIAL_TRIGGER_ATTRIBUTE}]`;
    let tour: Driver | null = null;
    let cancelled = false;
    void waitForElement(selector).then(() => {
      if (cancelled || !document.querySelector(selector)) return;
      tour = driver({ ...baseConfig, showButtons: ['next', 'close'], doneBtnText: 'Entendido' });
      tour.highlight({
        element: selector,
        popover: {
          title: 'Tutorial',
          description: 'Puedes repetir el tutorial cuando quieras desde este ícono.',
          side: 'bottom',
          showButtons: ['next', 'close'],
          nextBtnText: 'Entendido',
          onNextClick: () => tour?.destroy(),
        },
      });
    });
    return () => {
      cancelled = true;
      tour?.destroy();
    };
  }, []);
  return null;
}
