import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  IconTooltip,
  longPressDelayMs,
  longPressTooltipDurationMs,
} from '@/shared/ui/icon-tooltip';

beforeEach(() => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      readonly pointerType: string;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerType = options.pointerType ?? 'mouse';
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderOrderButton({ enabled = true } = {}) {
  const onClick = vi.fn();
  render(
    <IconTooltip
      label="Ordenar"
      enabled={enabled}
      delay={0}
      render={
        <button type="button" aria-label="Ordenar" onClick={onClick}>
          <svg aria-hidden="true" />
        </button>
      }
    />,
  );
  return { button: screen.getByRole('button', { name: 'Ordenar' }), onClick };
}

function tooltip() {
  return document.querySelector('[data-slot="tooltip-content"]');
}

function touch(button: HTMLElement, type: 'pointerDown' | 'pointerUp' | 'pointerMove', x = 10) {
  fireEvent[type](button, { pointerType: 'touch', clientX: x, clientY: 10 });
}

test('names an icon-only control on keyboard focus', async () => {
  const user = userEvent.setup();
  renderOrderButton();

  await user.tab();

  await waitFor(() => expect(tooltip()?.textContent).toBe('Ordenar'));
});

test('stays silent while the control already shows its label', async () => {
  const user = userEvent.setup();
  const { button, onClick } = renderOrderButton({ enabled: false });

  await user.tab();
  await user.hover(button);
  expect(tooltip()).toBeNull();

  await user.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

test('opens on a touch long-press without activating the control, then closes', () => {
  vi.useFakeTimers();
  const { button, onClick } = renderOrderButton();

  touch(button, 'pointerDown');
  act(() => vi.advanceTimersByTime(longPressDelayMs));
  expect(tooltip()?.textContent).toBe('Ordenar');

  touch(button, 'pointerUp');
  const clickProceeded = fireEvent.click(button);
  expect(clickProceeded).toBe(false);
  expect(onClick).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(longPressTooltipDurationMs));
  expect(tooltip()?.getAttribute('data-closed')).not.toBeNull();
});

test('keeps a short tap activating the control without a tooltip', () => {
  vi.useFakeTimers();
  const { button, onClick } = renderOrderButton();

  touch(button, 'pointerDown');
  act(() => vi.advanceTimersByTime(longPressDelayMs - 100));
  touch(button, 'pointerUp');
  fireEvent.click(button);
  act(() => vi.advanceTimersByTime(longPressDelayMs));

  expect(tooltip()).toBeNull();
  expect(onClick).toHaveBeenCalledOnce();
});

test('drops the long-press when the finger moves away to pan', () => {
  vi.useFakeTimers();
  const { button } = renderOrderButton();

  touch(button, 'pointerDown');
  touch(button, 'pointerMove', 40);
  act(() => vi.advanceTimersByTime(longPressDelayMs));

  expect(tooltip()).toBeNull();
});
