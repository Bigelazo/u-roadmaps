import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  NotificationCountButton,
  NotificationsInbox,
  NotificationsProvider,
  RoadmapEntryNotifications,
  useNotificationAcknowledgement,
} from '@/features/notifications/components/NotificationsInbox';
import { viewOwnInbox } from '@/features/notifications/components/inbox-store';
import type { OwnInboxSnapshot } from '@/features/notifications/contracts/own-inbox-snapshot';
import { NodeName } from '@/features/roadmap/ui/NodeName';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const calculus = { courseCode: 'MA1001', year: 2026, semester: 2 };
const programming = { courseCode: 'CC1002', year: 2026, semester: 2 };

function notice(id: string, roadmapId: string, courseName: string, offering = calculus) {
  return {
    id,
    roadmapId,
    courseName,
    body: `${courseName} cambió`,
    data: { ...offering, occurredAt: '2026-10-03T12:00:00.000Z' },
    createdAt: '2026-10-03T12:00:00.000Z',
  };
}

const snapshot: OwnInboxSnapshot = {
  total: 5,
  offerings: [
    { roadmapId: 'calculus', ...calculus, unread: 3 },
    { roadmapId: 'programming', ...programming, unread: 2 },
  ],
  notices: [
    notice('calculus-notice', 'calculus', 'Cálculo'),
    notice('programming-notice', 'programming', 'Programación', programming),
  ],
};

function Acknowledge({ roadmapId }: { roadmapId: string }) {
  const { acknowledge } = useNotificationAcknowledgement();
  return (
    <button onClick={() => void acknowledge({ roadmapId, entryKey: 'entry' })} type="button">
      Entrar a {roadmapId}
    </button>
  );
}

function app(
  inbox: Promise<OwnInboxSnapshot | null> | null,
  userId = 'student',
  extra?: ReactNode,
) {
  const identity = { userId };
  return (
    <NotificationsProvider identity={identity} inbox={inbox}>
      <NotificationsInbox identity={identity} />
      <NotificationCountButton filter={calculus} label="Cálculo" />
      <NotificationCountButton filter={programming} label="Programación" />
      <RoadmapEntryNotifications NodeName={NodeName}>
        <Acknowledge roadmapId="calculus" />
        {extra}
      </RoadmapEntryNotifications>
    </NotificationsProvider>
  );
}

async function renderApp(inbox: Promise<OwnInboxSnapshot | null> | null, userId?: string) {
  let view!: ReturnType<typeof render>;
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    view = render(app(inbox, userId));
  });
  return view;
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

async function enterCalculus() {
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a calculus' }));
  await settle();
}

const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
beforeEach(() => {
  fetch.mockImplementation(async () => Response.json({ acknowledged: 3, summary: null }));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('EventSource', undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetch.mockReset();
  push.mockClear();
  refresh.mockClear();
});

test('the bell badge and its list come from the page-load snapshot without requests', async () => {
  await renderApp(Promise.resolve(snapshot));
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos, 5 sin leer' }));
  const list = await screen.findByRole('list', { name: 'Lista de avisos' });
  expect(within(list).getAllByRole('button')).toHaveLength(2);
  expect(fetch).not.toHaveBeenCalled();
});

test('a course count opens the bell filtered to that course', async () => {
  await renderApp(Promise.resolve(snapshot));
  expect(
    await screen.findByRole('button', { name: '2 avisos sin leer para Programación' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '3 avisos sin leer para Cálculo' }));
  const list = await screen.findByRole('list', { name: 'Lista de avisos' });
  expect(
    within(list)
      .getAllByRole('button')
      .map((row) => row.textContent),
  ).toEqual([expect.stringContaining('Cálculo')]);
  expect(fetch).not.toHaveBeenCalled();
});

test('entering a Roadmap removes its notices from the bell and its course count', async () => {
  await renderApp(Promise.resolve(snapshot));
  await enterCalculus();
  expect(screen.getByRole('button', { name: 'Avisos, 2 sin leer' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /para Cálculo/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Avisos, 2 sin leer' }));
  const list = await screen.findByRole('list', { name: 'Lista de avisos' });
  expect(within(list).getAllByRole('button')).toHaveLength(1);
});

test('a failed acknowledgement keeps the Roadmap notices', async () => {
  fetch.mockImplementation(async (path: string) =>
    path.endsWith('/acknowledge') ? Response.json({}, { status: 503 }) : Response.json({}),
  );
  await renderApp(Promise.resolve(snapshot));
  await enterCalculus();
  expect(fetch.mock.calls.map(([path]) => path)).toContain('/api/notifications/acknowledge');
  expect(screen.getByRole('button', { name: 'Avisos, 5 sin leer' })).toBeTruthy();
});

test('a later snapshot for the same User cannot resurrect acknowledged notices', async () => {
  const { rerender } = await renderApp(Promise.resolve(snapshot));
  await enterCalculus();
  rerender(app(Promise.resolve(snapshot)));
  await settle();
  expect(screen.getByRole('button', { name: 'Avisos, 2 sin leer' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /para Cálculo/ })).toBeNull();
});

test('switching User shows the new User snapshot', async () => {
  const { rerender } = await renderApp(Promise.resolve(snapshot));
  rerender(app(Promise.resolve({ total: 0, offerings: [], notices: [] }), 'teacher'));
  await settle();
  expect(screen.getByRole('button', { name: 'Avisos' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sin leer para/ })).toBeNull();
});

test('selecting a notice navigates to its course and closes the bell', async () => {
  await renderApp(Promise.resolve(snapshot));
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos, 5 sin leer' }));
  fireEvent.click(await screen.findByRole('button', { name: /Programación cambió/ }));
  expect(push).toHaveBeenCalledWith('/courses/CC1002/2026/2');
  expect(screen.queryByRole('list', { name: 'Lista de avisos' })).toBeNull();
});

test('an unavailable snapshot is reported instead of an empty inbox', async () => {
  await renderApp(Promise.resolve(null));
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos, contador no disponible' }));
  expect(await screen.findByText('No se pudieron cargar los avisos.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Avisos para Cálculo, contador no disponible' }),
  ).toBeTruthy();
});

test('a later snapshot replaces an unavailable one', async () => {
  const { rerender } = await renderApp(Promise.resolve(null));
  await screen.findByRole('button', { name: 'Avisos, contador no disponible' });
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => rerender(app(Promise.resolve(snapshot))));
  expect(screen.getByRole('button', { name: 'Avisos, 5 sin leer' })).toBeTruthy();
});

test('acknowledged Roadmaps leave the total consistent with the remaining offerings', () => {
  const view = viewOwnInbox(snapshot, new Set(['calculus', 'unknown']));
  expect(view.total).toBe(2);
  expect(view.unreadFor(calculus)).toBe(0);
  expect(view.unreadFor(programming)).toBe(2);
  expect(view.noticesFor().map(({ id }) => id)).toEqual(['programming-notice']);
  expect(view.noticesFor(calculus)).toEqual([]);
});
