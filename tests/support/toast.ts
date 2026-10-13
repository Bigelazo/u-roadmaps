import { waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Toasts are found by their title: Base UI hides high-priority toasts from the
 * accessibility tree (they are announced through a separate live region).
 */
export function queryToasts(message: string) {
  return [...document.querySelectorAll('[data-slot="toast-title"]')]
    .filter((title) => title.textContent === message)
    .map((title) => title.closest<HTMLElement>('[data-slot="toast"]')!);
}

export function queryToast(message: string) {
  return queryToasts(message)[0] ?? null;
}

export function findToast(message: string) {
  return waitFor(() => {
    const toast = queryToast(message);
    if (!toast) throw new Error(`Toast not found: ${message}`);
    return toast;
  });
}

/** Expands the stack like a pointer would, then presses the toast's close button. */
export async function closeToast(user: UserEvent, toast: HTMLElement) {
  await user.hover(toast);
  await user.click(toast.querySelector<HTMLElement>('[data-slot="toast-close"]')!);
}
