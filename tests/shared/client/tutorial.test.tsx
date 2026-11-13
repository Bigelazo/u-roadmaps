import { act, render } from '@testing-library/react';
import type { Config, DriveStep } from 'driver.js';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { RoadmapTutorial, TutorialClosingPopover } from '@/shared/client/tutorial/tutorial';
import {
  markTutorialClosingPopover,
  readTutorialClosingPopover,
  TUTORIAL_TRIGGER_ATTRIBUTE,
} from '@/shared/client/tutorial/tutorial-support';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

const mock = vi.hoisted(() => ({
  config: {} as Config,
  index: 3,
  refresh: vi.fn(),
  destroy: vi.fn(),
  highlight: vi.fn(),
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
      highlight: mock.highlight,
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
  mock.highlight.mockClear();
  mock.index = 3;
  mock.exit = null;
  sessionStorage.clear();
  document.body.replaceChildren();
});

function visible(element: HTMLElement) {
  element.getBoundingClientRect = () => new DOMRect(10, 10, 100, 40);
  return element;
}

function steps(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    element: 'body',
    title: `Step ${index + 1}`,
    description: '',
  }));
}

function press(target: EventTarget, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

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

it('falls back to no element instead of the page body when a target is missing', () => {
  render(
    <RoadmapTutorial
      steps={[{ element: '[data-missing-target]', title: 'Paso', description: '' }]}
    />,
  );
  const step = mock.config.steps?.[0] as DriveStep;
  expect((step.element as () => Element | null)()).toBeNull();
});

it.each([
  ['an input', () => document.body.appendChild(document.createElement('input'))],
  [
    'an open menu',
    () => {
      const menu = visible(document.createElement('div'));
      menu.setAttribute('role', 'menu');
      document.body.appendChild(menu);
      return document.body;
    },
  ],
  [
    'an open side panel',
    () => {
      const panel = visible(document.createElement('div'));
      panel.dataset.slot = 'sidebar';
      panel.dataset.side = 'right';
      document.body.appendChild(panel);
      return document.body;
    },
  ],
])('leaves Escape to %s instead of asking to exit', async (_label, targetOf) => {
  vi.useFakeTimers();
  render(<RoadmapTutorial steps={steps(5)} />);
  press(targetOf(), 'Escape');
  await settle();
  expect(mock.exit?.confirmation).toBeNull();
});

it('asks to exit on Escape when no layer is open', async () => {
  vi.useFakeTimers();
  render(<RoadmapTutorial steps={steps(5)} />);
  press(document.body, 'Escape');
  await settle();
  expect(mock.exit?.confirmation).toMatchObject({ title: '¿Salir del tutorial?' });
});

it('keeps arrow keys inside an editable field', async () => {
  vi.useFakeTimers();
  render(<RoadmapTutorial steps={steps(5)} />);
  const field = document.body.appendChild(document.createElement('textarea'));
  press(field, 'ArrowRight');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(mock.index).toBe(3);

  press(document.body, 'ArrowRight');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(mock.index).toBe(4);
});

it('ignores Enter and Space on controls behind the overlay', () => {
  render(<RoadmapTutorial steps={steps(5)} />);
  const covered = document.body.appendChild(document.createElement('button'));
  covered.style.pointerEvents = 'none';
  const reached = vi.fn();
  covered.addEventListener('keydown', reached);

  expect(press(covered, 'Enter').defaultPrevented).toBe(true);
  expect(press(covered, ' ').defaultPrevented).toBe(true);
  expect(reached).not.toHaveBeenCalled();

  covered.style.pointerEvents = 'auto';
  expect(press(covered, 'Enter').defaultPrevented).toBe(false);
  expect(reached).toHaveBeenCalledOnce();
});

it('closes a menu left open by the previous step before showing the next one', async () => {
  vi.useFakeTimers();
  render(<RoadmapTutorial steps={steps(5)} />);
  const menu = visible(document.createElement('div'));
  menu.setAttribute('role', 'menu');
  document.body.appendChild(menu);
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') menu.remove();
  };
  document.addEventListener('keydown', closeOnEscape);

  await act(async () => {
    mock.config.onNextClick?.(document.body, {}, {} as never);
    await vi.advanceTimersByTimeAsync(1000);
  });

  document.removeEventListener('keydown', closeOnEscape);
  expect(menu.isConnected).toBe(false);
  expect(mock.index).toBe(4);
});

it('shows the closing popover under StrictMode and forgets it once shown', async () => {
  markTutorialClosingPopover();
  const trigger = document.body.appendChild(document.createElement('a'));
  trigger.setAttribute(TUTORIAL_TRIGGER_ATTRIBUTE, '');

  render(
    <StrictMode>
      <TutorialClosingPopover />
    </StrictMode>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(mock.highlight).toHaveBeenCalledOnce();
  expect(readTutorialClosingPopover()).toBe(false);
});
