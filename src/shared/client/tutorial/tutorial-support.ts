/** Marks the question-mark icon that opens a Roadmap tutorial on its origin page. */
export const TUTORIAL_TRIGGER_ATTRIBUTE = 'data-tutorial-trigger';

/** Marks the "Salir" control, which stays usable above the tour at any moment. */
export const TUTORIAL_EXIT_ATTRIBUTE = 'data-tutorial-exit';

export const closingPopoverKey = 'u-roadmaps:tutorial-closing-popover';
/**
 * One step of a Roadmap tutorial; `prepare` runs before the step is shown. An action
 * step has `advanceWhen`: its control stays usable and the step advances only when an
 * action reported by the page matches, unless `allowManualAdvance` also permits navigation.
 * Any other action keeps the step and highlights
 * the expected control again; so does `element` resolving to a different control.
 */
export type TutorialStep<Action = never> = Readonly<{
  element: string | (() => Element | null);
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Let explanatory steps expose controls and scrolling in their highlighted region. */
  allowInteraction?: boolean;
  /** Highlight the bounding region of related elements together. */
  highlightElements?: () => readonly Element[];
  prepare?: () => Promise<void> | void;
  advanceWhen?: (action: Action) => boolean;
  /** Allow Next and revisiting this action step when repeating it is harmless. */
  allowManualAdvance?: boolean;
}>;

/** Where a page reports the actions that took effect, for action steps to follow. */
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

/** Called when "Salir" leaves the Practice roadmap for the tutorial's origin. */
export function markTutorialClosingPopover() {
  try {
    sessionStorage.setItem(closingPopoverKey, '1');
  } catch {
    // Without storage the origin simply shows no closing popover.
  }
}
