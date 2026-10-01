import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { novu } = vi.hoisted(() => ({
  novu: { on: vi.fn(() => () => undefined), notifications: { list: vi.fn() } },
}));

vi.mock('@novu/nextjs', () => ({
  NovuProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@novu/nextjs/hooks', () => ({
  useCounts: () => ({ counts: [] }),
  useNotifications: () => ({ notifications: [] }),
  useNovu: () => novu,
}));

import {
  NotificationsProvider,
  useNotificationAcknowledgement,
} from '@/features/notifications/components/NotificationsInbox';

const snapshotTime = Date.parse('2026-09-30T12:00:00.000Z');
const presentAtOpen = '2026-09-30T11:59:00.000Z';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(snapshotTime);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function notice(id: string, data: Record<string, unknown>, createdAt = presentAtOpen) {
  return {
    id,
    createdAt,
    subject: 'Resumen de cambios · Nodo «Unidad 1»',
    body: 'Se agruparon 2 cambios. Último cambio: Nodo actualizado.',
    data,
    read: vi.fn(async () => ({ error: null })),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider
      identity={{
        subscriber: 'user-id',
        subscriberHash: 'hash',
        applicationIdentifier: 'application',
      }}
    >
      {children}
    </NotificationsProvider>
  );
}

test('opening a Node acknowledges its Resource, Node, and Digest notices but leaves another Node pending', async () => {
  const pathNotice = notice('path-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'roadmap',
    changeKind: 'dependency-added',
  });
  const resourceNotice = notice('resource-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'node-id',
    changeKind: 'resource-added',
  });
  const nodeNotice = notice('node-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'node-id',
    changeKind: 'node-updated',
  });
  const digestNotice = notice('node-summary', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'node-id',
    changeKind: 'node-updated',
    eventCount: 3,
  });
  const otherNodeNotice = notice('other-node-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'other-node-id',
    changeKind: 'node-updated',
  });
  novu.notifications.list.mockResolvedValue({
    data: {
      notifications: [pathNotice, resourceNotice, nodeNotice, digestNotice, otherNodeNotice],
      hasMore: false,
    },
  });
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });

  await act(async () => {
    await result.current.acknowledge({ roadmapId: 'roadmap-id', nodeId: 'node-id' });
  });

  expect(resourceNotice.read).toHaveBeenCalledOnce();
  expect(nodeNotice.read).toHaveBeenCalledOnce();
  expect(digestNotice.read).toHaveBeenCalledOnce();
  expect(pathNotice.read).not.toHaveBeenCalled();
  expect(otherNodeNotice.read).not.toHaveBeenCalled();
  expect(novu.notifications.list).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { roadmapId: 'roadmap-id' },
      read: false,
      createdLte: snapshotTime,
    }),
  );
});

test('entering a Roadmap recognizes general notices and blocked Nodes while accessible Nodes stay pending', async () => {
  const pathNotice = notice('path-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'roadmap',
    changeKind: 'dependency-removed',
  });
  const blockedNodeNotice = notice('blocked-node-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'blocked-node-id',
    changeKind: 'node-blocked',
  });
  const classificationNotice = notice('classification-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'roadmap',
    changeKind: 'classification-updated',
  });
  const accessibleNodeNotice = notice('accessible-node-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'accessible-node-id',
    changeKind: 'dependency-added',
  });
  novu.notifications.list.mockResolvedValue({
    data: {
      notifications: [pathNotice, classificationNotice, blockedNodeNotice, accessibleNodeNotice],
      hasMore: false,
    },
  });
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });

  await act(async () => {
    await result.current.acknowledge({
      roadmapId: 'roadmap-id',
      accessibleNodeIds: new Set(['accessible-node-id']),
    });
  });

  expect(pathNotice.read).toHaveBeenCalledOnce();
  expect(classificationNotice.read).toHaveBeenCalledOnce();
  expect(blockedNodeNotice.read).toHaveBeenCalledOnce();
  expect(accessibleNodeNotice.read).not.toHaveBeenCalled();
});

test('a Digest summary delivered after opening a Node stays pending during the paginated read', async () => {
  const noticeAlreadyPresent = notice('existing-node-notice', {
    roadmapId: 'roadmap-id',
    targetKind: 'node',
    nodeId: 'node-id',
    changeKind: 'node-updated',
    eventCount: 1,
  });
  const lateSummary = notice(
    'late-summary',
    {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'node-id',
      changeKind: 'node-updated',
      eventCount: 2,
    },
    '2026-09-30T12:00:01.000Z',
  );
  novu.notifications.list
    .mockResolvedValueOnce({
      data: { notifications: [noticeAlreadyPresent], hasMore: true },
    })
    .mockResolvedValueOnce({ data: { notifications: [lateSummary], hasMore: false } });
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });

  await act(async () => {
    await result.current.acknowledge({ roadmapId: 'roadmap-id', nodeId: 'node-id' });
  });

  expect(noticeAlreadyPresent.read).toHaveBeenCalledOnce();
  expect(lateSummary.read).not.toHaveBeenCalled();
  expect(novu.notifications.list).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      after: 'existing-node-notice',
      createdLte: snapshotTime,
    }),
  );
});
