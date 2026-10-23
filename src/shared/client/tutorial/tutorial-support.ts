export const TUTORIAL_TRIGGER_ATTRIBUTE = 'data-tutorial-trigger';

export const TUTORIAL_EXIT_ATTRIBUTE = 'data-tutorial-exit';

export const closingPopoverKey = 'u-roadmaps:tutorial-closing-popover';
export type TutorialStep<Action = never> = Readonly<{
  element: string | (() => Element | null);
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  allowInteraction?: boolean;
  highlightElements?: () => readonly Element[];
  prepare?: () => Promise<void> | void;
  advanceWhen?: (action: Action) => boolean;
  allowManualAdvance?: boolean;
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
  } catch {
    // Without storage the origin simply shows no closing popover.
  }
}
