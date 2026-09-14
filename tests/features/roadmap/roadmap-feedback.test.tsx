import { act, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';

afterEach(() => vi.useRealTimers());

test.each([
  ['error', RoadmapErrorToast],
  ['success', RoadmapSuccessToast],
] as const)(
  'dismisses %s feedback after six seconds even when its parent rerenders',
  (_kind, Toast) => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="Resultado del roadmap" onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(3000));
    rerender(<Toast message="Resultado del roadmap" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  },
);

test.each([
  ['error', RoadmapErrorToast],
  ['success', RoadmapSuccessToast],
] as const)('cancels the %s feedback timer when the surface unmounts', (_kind, Toast) => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const { unmount } = render(<Toast message="Resultado del roadmap" onDismiss={onDismiss} />);

  act(() => vi.advanceTimersByTime(3000));
  unmount();
  act(() => vi.advanceTimersByTime(6000));
  expect(onDismiss).not.toHaveBeenCalled();
});
