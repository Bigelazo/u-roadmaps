import { act, render } from '@testing-library/react';
import type { Config } from 'driver.js';
import { afterEach, expect, it, vi } from 'vitest';
import { RoadmapTutorial } from '@/shared/client/tutorial/tutorial';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

const mock = vi.hoisted(() => ({
  config: {} as Config,
  index: 3,
  refresh: vi.fn(),
  destroy: vi.fn(),
  exit: null as ConfirmationDialogProps | null,
}));

vi.mock('@/shared/ui/confirmation-dialog', () => ({
  ConfirmationDialog: (props: ConfirmationDialogProps) => {
    mock.exit = props;
    return null;
  },
}));
vi.mock('driver.js', () => ({
  driver: (config: Config) => {
    mock.config = config;
    return {
      drive: vi.fn(),
      destroy: mock.destroy,
      isActive: () => true,
      getActiveIndex: () => mock.index,
      getState: () => ({}),
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
  mock.destroy.mockClear();
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

it.each([
  ['Salir', 'leaves', 1],
  ['Seguir con el tutorial', 'resumes', 0],
] as const)('asks before exiting; %s %s the tutorial', (_label, _outcome, destroyed) => {
  render(<RoadmapTutorial steps={[{ element: 'body', title: 'Paso', description: '' }]} />);
  act(() => mock.config.onCloseClick?.(document.body, {}, {} as never));

  const exit = mock.exit!;
  expect(exit.confirmation).toMatchObject({
    title: '¿Salir del tutorial?',
    cancelLabel: 'Seguir con el tutorial',
    actions: [{ id: 'leave', label: 'Salir' }],
  });
  mock.destroy.mockClear();
  act(() => (destroyed ? exit.onAction('leave') : exit.onCancel()));

  expect(mock.destroy).toHaveBeenCalledTimes(destroyed);
  expect(mock.exit?.confirmation).toBeNull();
});
