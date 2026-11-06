import { act, render } from '@testing-library/react';
import type { Config } from 'driver.js';
import { afterEach, expect, it, vi } from 'vitest';
import { RoadmapTutorial } from '@/shared/client/tutorial/tutorial';

const mock = vi.hoisted(() => ({
  config: {} as Config,
  index: 3,
  refresh: vi.fn(),
}));

vi.mock('@/shared/ui/confirmation-dialog', () => ({ ConfirmationDialog: () => null }));
vi.mock('driver.js', () => ({
  driver: (config: Config) => {
    mock.config = config;
    return {
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: () => true,
      getActiveIndex: () => mock.index,
      getActiveElement: () => document.body,
      refresh: mock.refresh,
      moveTo: (index: number) => {
        mock.index = index;
        config.onHighlightStarted?.(document.body, {}, {} as never);
      },
    };
  },
}));

afterEach(() => {
  vi.useRealTimers();
  mock.refresh.mockClear();
  mock.index = 3;
});

it('lets the step 4 to 5 animation finish before refreshing an action target', async () => {
  vi.useFakeTimers();
  render(
    <RoadmapTutorial
      steps={Array.from({ length: 5 }, (_, index) => ({
        element: 'body',
        title: `Step ${index + 1}`,
        description: '',
        ...(index === 4 ? { advanceWhen: () => false } : {}),
      }))}
    />,
  );
  await act(async () => {
    mock.config.onNextClick?.(document.body, {}, {} as never);
    await vi.advanceTimersByTimeAsync(100);
  });
  act(() => vi.advanceTimersByTime(450));
  expect(mock.refresh).not.toHaveBeenCalled();

  act(() => {
    mock.config.onHighlighted?.(document.body, {}, {} as never);
    vi.advanceTimersByTime(150);
  });
  expect(mock.refresh).toHaveBeenCalledOnce();
});
