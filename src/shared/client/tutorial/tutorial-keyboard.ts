import { isShown } from './tutorial-layers';

const focusableSelector =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"], [role="menuitem"], [role="option"]';
const modalSelector = '[role="dialog"], [role="alertdialog"]';
const keyboardWidgetSelector =
  '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [role="slider"], [role="tablist"], [role="radiogroup"]';

export function isNeutralTarget(target: Element | null) {
  return !target || target === document.body || target === document.documentElement;
}

export function acceptsPointer(element: Element) {
  return getComputedStyle(element).pointerEvents !== 'none';
}

export function isInsideKeyboardWidget(target: Element) {
  return Boolean(target.closest(keyboardWidgetSelector) && !target.closest('.driver-popover'));
}

function isFocusable(element: Element, roots: readonly Element[]) {
  if (!element.matches(focusableSelector)) return false;
  if ((element as HTMLButtonElement).disabled) return false;
  if (element.closest('[aria-hidden="true"], [inert]')) return false;
  if (
    element.getAttribute('tabindex') === '-1' &&
    !roots.includes(element) &&
    !element.matches('[role="menuitem"], [role="option"]')
  )
    return false;
  return isShown(element) && acceptsPointer(element);
}

export function focusCycle(roots: readonly Element[], popover: Element | null) {
  const active = document.activeElement;
  const modal = active?.closest(modalSelector);
  const scoped =
    modal &&
    !modal.closest('.driver-popover') &&
    roots.some((root) => root === modal || root.contains(modal) || modal.contains(root))
      ? [...(popover ? [popover] : []), modal]
      : roots;
  const seen = new Set<Element>();
  return scoped
    .flatMap((root) => [root, ...root.querySelectorAll(focusableSelector)])
    .filter((element) => {
      if (seen.has(element)) return false;
      seen.add(element);
      return isFocusable(element, scoped);
    }) as HTMLElement[];
}

export function moveFocus(cycle: readonly HTMLElement[], backwards: boolean) {
  const index = cycle.indexOf(document.activeElement as HTMLElement);
  const next = backwards
    ? (cycle[index - 1] ?? cycle[cycle.length - 1])
    : (cycle[index + 1] ?? cycle[0]);
  next?.focus();
}
