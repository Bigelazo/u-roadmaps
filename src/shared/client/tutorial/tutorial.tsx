'use client';

import 'driver.js/dist/driver.css';
import './tutorial.css';

import { driver, type Config, type Driver, type DriveStep, type PopoverDOM } from 'driver.js';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { positionTutorialPopover } from './tutorial-position';
import { placeTutorialExit, releaseTutorialExit } from './tutorial-exit-control';
import {
  acceptsPointer,
  focusCycle,
  isInsideKeyboardWidget,
  isNeutralTarget,
  moveFocus,
} from './tutorial-keyboard';
import {
  closeLayers,
  hasOpenLayer,
  isEditable,
  isEngineEvent,
  openPanels,
  openTransientLayers,
} from './tutorial-layers';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { TOAST_OBSTACLES_EVENT } from '@/shared/ui/use-toast-viewport-position';
import {
  clearTutorialClosingPopover,
  readTutorialClosingPopover,
  resolveElement,
  resolveStepTargets,
  revealTutorialTarget,
  TUTORIAL_EXIT_ATTRIBUTE,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  waitForElement,
  waitForStableElement,
  type TutorialActions,
  type TutorialStep,
} from './tutorial-support';

const actingClass = 'u-roadmaps-tour-acting';
const exclusiveClass = 'u-roadmaps-tour-exclusive';
const interactiveClass = 'u-roadmaps-tour-interactive';
const dummyElementId = 'driver-dummy-element';
const navigationKeys = new Set(['Escape', 'ArrowLeft', 'ArrowRight', 'Tab']);

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

export function RoadmapTutorial<Action = never>({
  steps,
  actions,
}: {
  steps: readonly TutorialStep<Action>[];
  actions?: TutorialActions<Action>;
}) {
  const [descriptionPortal, setDescriptionPortal] = useState<{
    target: HTMLElement;
    content: ReactNode;
    reposition: () => void;
  } | null>(null);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const confirmingRef = useRef(false);
  const driverRef = useRef<Driver | null>(null);

  useLayoutEffect(() => {
    descriptionPortal?.reposition();
  }, [descriptionPortal]);

  useEffect(() => {
    let cancelled = false;
    let moving = false;
    let following = false;
    let highlighting = false;
    let leaveStep: (() => void) | void;
    let panelsAtEntry: ReadonlySet<Element> = new Set();
    let interactiveElements: Element[] = [];
    let popoverArea = '';
    const groupHighlight = document.createElement('div');
    groupHighlight.setAttribute('aria-hidden', 'true');
    groupHighlight.setAttribute('data-tutorial-highlight-group', '');
    groupHighlight.style.position = 'fixed';
    groupHighlight.style.pointerEvents = 'none';
    const stepAt = (index: number | undefined) => (index === undefined ? undefined : steps[index]);
    const resolveHighlight = (step: TutorialStep<Action>) => {
      const elements = step.highlightElements?.();
      if (!elements?.length) return resolveElement(step.element);
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
    const getExitControl = () =>
      document.querySelector<HTMLElement>(`[${TUTORIAL_EXIT_ATTRIBUTE}]`);
    const announcePopoverArea = (wrapper: HTMLElement | null) => {
      const rect = wrapper?.isConnected ? wrapper.getBoundingClientRect() : null;
      const area = rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : '';
      if (area === popoverArea) return;
      popoverArea = area;
      window.dispatchEvent(new Event(TOAST_OBSTACLES_EVENT));
    };
    const positionPopover = (renderedPopover?: PopoverDOM) => {
      const step = stepAt(tour.getActiveIndex());
      const popover = renderedPopover ?? tour.getState().popover;
      if (!step || !popover) return;
      const highlighted = step.highlightElements?.() ?? [];
      positionTutorialPopover(
        popover,
        resolveElement(step.element) ?? highlighted[0] ?? null,
        getExitControl(),
        step.side,
        highlighted,
        step.popoverOffset,
      );
      announcePopoverArea(popover.wrapper);
    };
    const askExit = () => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setIsConfirmingExit(true);
    };
    const prepareTarget = async (step: TutorialStep<Action>) => {
      await waitForElement(step.element);
      await waitForStableElement(step.element);
      await revealTutorialTarget(resolveStepTargets(step), step.focusZoom);
    };
    const isActionStep = (index: number | undefined): index is number =>
      index !== undefined && steps[index]?.advanceWhen !== undefined;
    const isInteractiveStep = (index: number | undefined) =>
      index !== undefined && (isActionStep(index) || Boolean(steps[index]?.allowInteraction));
    const isRequiredActionStep = (index: number | undefined): index is number =>
      isActionStep(index) && !steps[index].allowManualAdvance;
    const disablesInteraction = (step: TutorialStep<Action>) =>
      !step.advanceWhen && !step.allowInteraction;
    const syncInteraction = (index: number | undefined) => {
      const step = tour.isActive() ? stepAt(index) : undefined;
      const exclusive = Boolean(step?.exclusiveInteraction && !disablesInteraction(step));
      document.body.classList.toggle(
        actingClass,
        Boolean(step) && !exclusive && isInteractiveStep(index),
      );
      document.body.classList.toggle(exclusiveClass, exclusive);
      const next = exclusive && step ? resolveStepTargets(step) : [];
      for (const element of interactiveElements)
        if (!next.includes(element)) element.classList.remove(interactiveClass);
      for (const element of next) element.classList.add(interactiveClass);
      interactiveElements = next;
    };
    const restoreHighlight = (index: number) => {
      const element = tour.getActiveElement();
      if (!element || element.classList.contains('driver-active-element')) return;
      element.classList.add('driver-active-element');
      if (disablesInteraction(steps[index])) element.classList.add('driver-no-interaction');
    };
    const ownsLayer = (step: TutorialStep<Action>) => {
      const targets = resolveStepTargets(step);
      return (layer: Element) =>
        targets.some((target) => layer.contains(target)) || Boolean(step.ownsLayer?.(layer));
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
      leaveStep?.();
      leaveStep = undefined;
      following = false;
      try {
        await closeLayers({ keep: ownsLayer(steps[index]), panelsBefore: panelsAtEntry });
        await steps[index].prepare?.();
        await prepareTarget(steps[index]);
        if (cancelled) return;
        syncInteraction(index);
        tour.moveTo(index);
        leaveStep = steps[index].onEnter?.();
        panelsAtEntry = new Set(openPanels());
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
        element: () => resolveHighlight(step) as Element,
        disableActiveInteraction: disablesInteraction(step),
        popover: {
          title: step.title,
          description: typeof step.description === 'string' ? step.description : ' ',
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
      onHighlightStarted: () => {
        highlighting = true;
      },
      onHighlighted: () => {
        highlighting = false;
        positionPopover();
      },
      onPopoverRender: (popover) => {
        popover.wrapper.setAttribute('data-toast-avoid', '');
        const description = stepAt(tour.getActiveIndex())?.description;
        setDescriptionPortal(
          typeof description === 'function'
            ? {
                target: popover.description,
                content: description(),
                reposition: () => positionPopover(popover),
              }
            : null,
        );
        positionPopover(popover);
        if (!following) return;
        following = false;
        popover.wrapper.inert = true;
        queueMicrotask(() => {
          popover.wrapper.inert = false;
        });
      },
      onDestroyStarted: askExit,
      onDestroyed: () => {
        setDescriptionPortal(null);
        leaveStep?.();
        leaveStep = undefined;
        syncInteraction(undefined);
        releaseTutorialExit(getExitControl());
        announcePopoverArea(null);
      },
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
    const revealAgain = async (index: number) => {
      const step = steps[index];
      await revealTutorialTarget(resolveStepTargets(step), step.focusZoom);
      if (!cancelled && tour.isActive() && tour.getActiveIndex() === index && !moving)
        tour.refresh();
    };
    const unsubscribe = actions?.subscribe((action) => {
      const step = stepAt(tour.getActiveIndex());
      if (!tour.isActive() || !step?.advanceWhen) return;
      if (step.advanceWhen(action)) void move(tour, 1, true);
      else if (!confirmingRef.current) highlightAgain();
    });
    const followTimer = setInterval(() => {
      const index = tour.getActiveIndex();
      const exitControl = getExitControl();
      if (exitControl && tour.isActive()) placeTutorialExit(exitControl);
      if (moving) return;
      syncInteraction(index);
      if (confirmingRef.current || highlighting || index === undefined || !tour.isActive()) return;
      restoreHighlight(index);
      positionPopover();
      const target = resolveHighlight(steps[index]);
      const active = tour.getActiveElement();
      const shown = active && active.id !== dummyElementId && active.isConnected ? active : null;
      if (target !== shown) {
        highlightAgain();
        if (!shown && target && !isInteractiveStep(index)) void revealAgain(index);
        return;
      }
      if (steps[index].highlightElements || isInteractiveStep(index)) tour.refresh();
    }, 150);

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const onViewportChange = () => {
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        const index = tour.getActiveIndex();
        if (index === undefined || moving || confirmingRef.current || !tour.isActive()) return;
        void revealAgain(index);
      }, 250);
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const keyTarget = (event: KeyboardEvent) =>
      event.target instanceof Element ? event.target : null;
    const isInert = (target: Element | null) =>
      !isNeutralTarget(target) && !acceptsPointer(target!);
    const blocksInertTarget = (event: KeyboardEvent) => {
      if (isEngineEvent(event) || confirmingRef.current || !tour.isActive()) return false;
      if (navigationKeys.has(event.key) || !isInert(keyTarget(event))) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };
    const focusRoots = () => {
      const step = stepAt(tour.getActiveIndex());
      const popover = tour.getState().popover?.wrapper ?? null;
      const roots: Element[] = popover ? [popover] : [];
      if (step && !disablesInteraction(step)) {
        if (step.exclusiveInteraction) roots.push(...interactiveElements);
        else roots.push(...resolveStepTargets(step), ...openTransientLayers());
      }
      const exitControl = getExitControl();
      if (exitControl) roots.push(exitControl);
      return { roots, popover };
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEngineEvent(event) || confirmingRef.current || !tour.isActive()) return;
      if (event.key === 'Tab') {
        const { roots, popover } = focusRoots();
        const cycle = focusCycle(roots, popover);
        if (!cycle.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        moveFocus(cycle, event.shiftKey);
        return;
      }
      if (blocksInertTarget(event)) return;
      const target = keyTarget(event);
      const local = target !== null && (isEditable(target) || isInsideKeyboardWidget(target));
      if (event.key === 'Escape') {
        if (local || hasOpenLayer()) return;
        clearTimeout(exitTimer);
        exitTimer = setTimeout(askExit, 0);
      } else if (event.key === 'ArrowRight' && !local) void move(tour, 1);
      else if (event.key === 'ArrowLeft' && !local) void move(tour, -1);
    };
    const onKeyRelease = (event: KeyboardEvent) => {
      blocksInertTarget(event);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyRelease, true);
    window.addEventListener('keypress', onKeyRelease, true);

    void (async () => {
      await steps[0]?.prepare?.();
      if (steps[0]) await prepareTarget(steps[0]);
      if (!cancelled) {
        tour.drive();
        syncInteraction(0);
        leaveStep = steps[0]?.onEnter?.();
        panelsAtEntry = new Set(openPanels());
      }
    })();
    return () => {
      cancelled = true;
      leaveStep?.();
      unsubscribe?.();
      clearInterval(followTimer);
      clearTimeout(exitTimer);
      clearTimeout(revealTimer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyRelease, true);
      window.removeEventListener('keypress', onKeyRelease, true);
      tour.destroy();
      for (const element of interactiveElements) element.classList.remove(interactiveClass);
      document.body.classList.remove(actingClass, exclusiveClass);
      groupHighlight.remove();
      releaseTutorialExit(getExitControl());
      announcePopoverArea(null);
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
    <>
      {descriptionPortal && createPortal(descriptionPortal.content, descriptionPortal.target)}
      <ConfirmationDialog
        confirmation={
          isConfirmingExit
            ? {
                title: '¿Salir del tutorial?',
                description:
                  'Podrás seguir explorando el mapa de práctica y repetir el tutorial cuando quieras.',
                intent: 'default',
                cancelLabel: 'Seguir con el tutorial',
                actions: [{ id: 'leave', label: 'Salir' }],
              }
            : null
        }
        className="u-roadmaps-tour-exit z-(--tutorial-z-exit-confirmation)"
        onCancel={resume}
        onAction={leave}
      />
    </>
  );
}

export function TutorialClosingPopover() {
  useEffect(() => {
    if (!readTutorialClosingPopover()) return;
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
      clearTutorialClosingPopover();
    });
    return () => {
      cancelled = true;
      tour?.destroy();
    };
  }, []);
  return null;
}
