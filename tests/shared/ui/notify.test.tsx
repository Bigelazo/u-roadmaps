import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notify } from '@/shared/ui/notify';
import { Toaster } from '@/shared/ui/toast';

function titles() {
  return [...document.querySelectorAll('[data-slot="toast-title"]')];
}

function toastTitles() {
  return titles().map((title) => title.textContent);
}

function toastOf(text: string) {
  return titles()
    .find((title) => title.textContent === text)
    ?.closest('[data-slot="toast"]');
}

describe('notify', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<Toaster />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a success toast that dismisses itself after 6 s and reports the close', () => {
    const onClose = vi.fn();
    act(() => void notify.success('Cambios guardados exitosamente.', { onClose }));

    expect(toastOf('Cambios guardados exitosamente.')?.getAttribute('data-type')).toBe('success');
    act(() => vi.advanceTimersByTime(5999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('announces errors assertively and dismisses them after 6 s', () => {
    const onClose = vi.fn();
    act(() => void notify.error('No se pudo guardar el nodo.', { onClose }));

    const toast = toastOf('No se pudo guardar el nodo.');
    expect(toast?.getAttribute('data-type')).toBe('error');
    expect(toast?.getAttribute('role')).toBe('alertdialog');
    act(() => vi.advanceTimersByTime(6000));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps neutral toasts until they are closed with the unified close label', () => {
    const onClose = vi.fn();
    act(() => void notify.neutral('El Nodo seleccionado ya no está disponible.', { onClose }));

    act(() => vi.advanceTimersByTime(60_000));
    expect(onClose).not.toHaveBeenCalled();
    expect(toastOf('El Nodo seleccionado ya no está disponible.')?.getAttribute('role')).toBe(
      'dialog',
    );

    fireEvent.mouseEnter(screen.getByRole('region', { name: 'Notificaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates the toast that shares an id instead of stacking a new one', () => {
    act(() => void notify.error('Primer error.', { id: 'session-error' }));
    act(() => void notify.error('Segundo error.', { id: 'session-error' }));

    expect(toastTitles()).toEqual(['Segundo error.']);
  });

  it('stacks toasts without ids', () => {
    act(() => {
      notify.success('Dependencia creada exitosamente.');
      notify.success('Nodo completado.');
    });

    expect(toastTitles()).toEqual(['Nodo completado.', 'Dependencia creada exitosamente.']);
  });

  it('closes a toast by id and reports the close', () => {
    const onClose = vi.fn();
    act(() => void notify.neutral('Aviso.', { id: 'notice', onClose }));
    act(() => notify.close('notice'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
