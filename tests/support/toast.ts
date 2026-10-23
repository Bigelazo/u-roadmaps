import { waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

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

export async function closeToast(user: UserEvent, toast: HTMLElement) {
  await user.hover(toast);
  await user.click(toast.querySelector<HTMLElement>('[data-slot="toast-close"]')!);
}
