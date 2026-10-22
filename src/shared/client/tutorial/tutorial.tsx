'use client';

import 'driver.js/dist/driver.css';
import './tutorial.css';

import { driver, type Config, type Driver, type DriveStep } from 'driver.js';
import { useEffect, useRef, useState } from 'react';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import {
  closingPopoverKey,
  resolveElement,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  waitForElement,
  type TutorialActions,
  type TutorialStep,
} from './tutorial-support';

const actingClass = 'u-roadmaps-tour-acting';

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

function skipDriverPopoverFocus() {
  const focus = HTMLElement.prototype.focus;
  const restore = () => {
    HTMLElement.prototype.focus = focus;
  };
  HTMLElement.prototype.focus = restore;
  queueMicrotask(restore);
}

export function RoadmapTutorial<Action = never>({
  steps,
  actions,
}: {
  steps: readonly TutorialStep<Action>[];
  actions?: TutorialActions<Action>;
}) {
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const confirmingRef = useRef(false);
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    let cancelled = false;
    let moving = false;
    let following = false;
    const groupHighlight = document.createElement('div');
    groupHighlight.setAttribute('aria-hidden', 'true');
    groupHighlight.setAttribute('data-tutorial-highlight-group', '');
    groupHighlight.style.position = 'fixed';
    groupHighlight.style.pointerEvents = 'none';
    const resolveHighlight = (step: TutorialStep<Action>) => {
      const elements = step.highlightElements?.();
      if (!elements?.length) return resolveElement(step.element) ?? document.body;
      const bounds = elements.map((element) => element.getBoundingClientRect());
      const left = Math.min(...bounds.map((rect) => rect.left));
      const top = Math.min(...bounds.map((rect) => rect.top));
      Object.assign(groupHighlight.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(...bounds.map((rect) => rect.right)) - left}px`,
        height: `${Math.max(...bounds.map((rect) => rect.bottom)) - top}px`,
      });
      if (!groupHighlight.isConnected) document.body.appendChild(groupHighlight);
      return groupHighlight;
    };
    const askExit = () => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setIsConfirmingExit(true);
    };
    const isActionStep = (index: number | undefined): index is number =>
      index !== undefined && steps[index]?.advanceWhen !== undefined;
    const isRequiredActionStep = (index: number | undefined): index is number =>
      isActionStep(index) && !steps[index].allowManualAdvance;
    const disablesInteraction = (step: TutorialStep<Action>) =>
      !step.advanceWhen && !step.allowInteraction;
    const restoreHighlight = (index: number) => {
      const element = tour.getActiveElement();
      if (!element || element.classList.contains('driver-active-element')) return;
      element.classList.add('driver-active-element');
      if (disablesInteraction(steps[index])) element.classList.add('driver-no-interaction');
    };
    const move = async (tour: Driver, offset: 1 | -1, byAction = false) => {
      if (confirmingRef.current || moving) return;
      if (offset === 1 && !byAction && isRequiredActionStep(tour.getActiveIndex())) return;
      const index = (tour.getActiveIndex() ?? 0) + offset;
      if (index < 0) return;
      if (offset === -1 && isRequiredActionStep(index)) return;
      if (index >= steps.length) {
        tour.destroy();
        return;
      }
      moving = true;
      following = false;
      try {
        await steps[index].prepare?.();
        await waitForElement(steps[index].element);
        document.body.classList.toggle(actingClass, isActionStep(index));
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
      steps: steps.map((step, index): DriveStep => ({
        element: () => resolveHighlight(step),
        disableActiveInteraction: disablesInteraction(step),
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
          ...(isRequiredActionStep(index)
            ? {
                showButtons:
                  index > 0 && !isRequiredActionStep(index - 1)
                    ? ['previous' as const, 'close' as const]
                    : ['close' as const],
              }
            : index === 0 || isRequiredActionStep(index - 1)
              ? { showButtons: ['next' as const, 'close' as const] }
              : {}),
        },
      })),
      onNextClick: () => void move(tour, 1),
      onPrevClick: () => void move(tour, -1),
      onDoneClick: () => void move(tour, 1),
      onCloseClick: askExit,
      onPopoverRender: () => {
        if (!following) return;
        following = false;
        skipDriverPopoverFocus();
      },
      onDestroyStarted: askExit,
      overlayClickBehavior: askExit,
    });
    driverRef.current = tour;

    const highlightAgain = () => {
      const index = tour.getActiveIndex();
      if (!tour.isActive() || index === undefined || moving) return;
      const active = document.activeElement;
      following = Boolean(active && active !== document.body && !active.closest('.driver-popover'));
      tour.moveTo(index);
    };
    const unsubscribe = actions?.subscribe((action) => {
      const index = tour.getActiveIndex();
      const step = index === undefined ? undefined : steps[index];
      if (!tour.isActive() || !step?.advanceWhen) return;
      if (step.advanceWhen(action)) void move(tour, 1, true);
      else if (!confirmingRef.current) highlightAgain();
    });
    const followTimer = setInterval(() => {
      const index = tour.getActiveIndex();
      document.body.classList.toggle(actingClass, tour.isActive() && isActionStep(index));
      if (confirmingRef.current || index === undefined || !tour.isActive()) return;
      restoreHighlight(index);
      if (steps[index].highlightElements) {
        resolveHighlight(steps[index]);
        tour.refresh();
        return;
      }
      if (!isActionStep(index)) return;
      const element = resolveElement(steps[index].element);
      if (element && element !== tour.getActiveElement()) highlightAgain();
      else tour.refresh();
    }, 150);

    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmingRef.current || !tour.isActive()) return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
        ) &&
        !event.target.closest('.driver-popover')
      )
        return;
      if (event.key === 'Escape') {
        clearTimeout(exitTimer);
        exitTimer = setTimeout(askExit, 0);
      } else if (event.key === 'ArrowRight') void move(tour, 1);
      else if (event.key === 'ArrowLeft') void move(tour, -1);
    };
    window.addEventListener('keydown', onKeyDown, true);

    void (async () => {
      await steps[0]?.prepare?.();
      if (steps[0]) await waitForElement(steps[0].element);
      if (!cancelled) tour.drive();
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
      clearInterval(followTimer);
      clearTimeout(exitTimer);
      document.body.classList.remove(actingClass);
      window.removeEventListener('keydown', onKeyDown, true);
      tour.destroy();
      groupHighlight.remove();
      driverRef.current = null;
    };
  }, [steps, actions]);

  const resume = () => {
    setIsConfirmingExit(false);
    queueMicrotask(() => {
      confirmingRef.current = false;
    });
  };
  const leave = () => {
    driverRef.current?.destroy();
    resume();
  };

  return (
    <ConfirmationDialog
      confirmation={
        isConfirmingExit
          ? {
              title: '¿Salir del tutorial?',
              description:
                'Podrás seguir explorando el mapa de práctica y repetir el tutorial cuando quieras.',
              intent: 'default',
              cancelLabel: 'Salir',
              actions: [{ id: 'resume', label: 'Seguir con el tutorial' }],
            }
          : null
      }
      className="u-roadmaps-tour-exit z-(--tutorial-z-exit-confirmation)"
      onCancel={leave}
      onDismiss={resume}
      onAction={resume}
    />
  );
}

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
