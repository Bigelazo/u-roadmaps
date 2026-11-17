import type { ReactNode } from 'react';

export const TUTORIAL_EXIT_ATTRIBUTE = 'data-tutorial-exit';

export type TutorialStep<Action = never> = Readonly<{
  element: string | (() => Element | null);
  title: string;
  description: string | (() => ReactNode);
  side?: 'top' | 'right' | 'bottom' | 'left';
  allowInteraction?: boolean;
  focusZoom?: number;
  onEnter?: () => (() => void) | void;
  highlightElements?: () => readonly Element[];
  prepare?: () => Promise<void> | void;
  advanceWhen?: (action: Action) => boolean;
  allowManualAdvance?: boolean;
  exclusiveInteraction?: boolean;
  ownsLayer?: (layer: Element) => boolean;
}>;

export type TutorialActions<Action> = Readonly<{
  report: (action: Action) => void;
  subscribe: (listener: (action: Action) => void) => () => void;
}>;

export function createTutorialActions<Action>(): TutorialActions<Action> {
  const listeners = new Set<(action: Action) => void>();
  return {
    report: (action) => listeners.forEach((listener) => listener(action)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function resolveElement(element: TutorialStep['element']) {
  return typeof element === 'string' ? document.querySelector(element) : element();
}

export function resolveStepTargets(step: Pick<TutorialStep, 'element' | 'highlightElements'>) {
  const elements = step.highlightElements?.() ?? [];
  if (elements.length) return [...elements];
  const element = resolveElement(step.element);
  return element ? [element] : [];
}

export async function waitForElement(element: TutorialStep['element'], timeoutMs = 3000) {
  const start = performance.now();
  while (!resolveElement(element) && performance.now() - start < timeoutMs)
    await new Promise((resolve) => setTimeout(resolve, 50));
}

export function clickElement(selector: string) {
  document.querySelector<HTMLElement>(selector)?.click();
}

export const TUTORIAL_REVEAL_EVENT = 'u-roadmaps:tutorial-reveal';

export type TutorialRevealDetail = Readonly<{
  elements: readonly Element[];
  focusZoom?: number;
  waitUntil: (movement: Promise<void>) => void;
}>;

export async function revealTutorialTarget(elements: readonly Element[], focusZoom?: number) {
  const movements: Promise<void>[] = [];
  const origin = elements[0];
  if (!origin) return;
  origin.dispatchEvent(
    new CustomEvent<TutorialRevealDetail>(TUTORIAL_REVEAL_EVENT, {
      bubbles: true,
      detail: { elements, focusZoom, waitUntil: (movement) => movements.push(movement) },
    }),
  );
  await Promise.all(movements.map((movement) => movement.catch(() => undefined)));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function isAnimating(target: Element) {
  for (let element: Element | null = target; element; element = element.parentElement) {
    const running = element
      .getAnimations?.()
      .some(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getTiming().iterations !== Infinity,
      );
    if (running) return true;
  }
  return false;
}

export async function waitForStableElement(element: TutorialStep['element'], timeoutMs = 800) {
  const start = performance.now();
  let previous = '';
  while (performance.now() - start < timeoutMs) {
    const target = resolveElement(element);
    const rect = target?.getBoundingClientRect();
    const current = rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : '';
    if (target && current === previous && !isAnimating(target)) return;
    previous = current;
    await nextFrame();
  }
}
