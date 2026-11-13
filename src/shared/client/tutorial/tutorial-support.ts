import type { ReactNode } from 'react';

export const TUTORIAL_TRIGGER_ATTRIBUTE = 'data-tutorial-trigger';

export const TUTORIAL_EXIT_ATTRIBUTE = 'data-tutorial-exit';

export const closingPopoverKey = 'u-roadmaps:tutorial-closing-popover';
export type TutorialStep<Action = never> = Readonly<{
  element: string | (() => Element | null);
  title: string;
  description: string | (() => ReactNode);
  side?: 'top' | 'right' | 'bottom' | 'left';
  popoverOffset?: number;
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

export function markTutorialClosingPopover() {
  try {
    sessionStorage.setItem(closingPopoverKey, '1');
    // eslint-disable-next-line no-empty -- Without storage the origin simply shows no closing popover.
  } catch {}
}

export function readTutorialClosingPopover() {
  try {
    return sessionStorage.getItem(closingPopoverKey) === '1';
  } catch {
    return false;
  }
}

export function clearTutorialClosingPopover() {
  try {
    sessionStorage.removeItem(closingPopoverKey);
    // eslint-disable-next-line no-empty -- Without storage there is no pending closing popover to clear.
  } catch {}
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

export async function waitForStableElement(element: TutorialStep['element'], timeoutMs = 800) {
  const start = performance.now();
  let previous = '';
  while (performance.now() - start < timeoutMs) {
    const rect = resolveElement(element)?.getBoundingClientRect();
    const current = rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : '';
    if (current && current === previous) return;
    previous = current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
