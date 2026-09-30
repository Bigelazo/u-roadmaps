import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

const { novu } = vi.hoisted(() => ({
  novu: { notifications: { list: vi.fn() } },
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

test('opening a Node acknowledges its Resource and Node notices but leaves another Node pending', async () => {
  const pathNotice = {
    id: 'path-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'roadmap',
      changeKind: 'dependency-added',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const resourceNotice = {
    id: 'resource-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'node-id',
      changeKind: 'resource-added',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const nodeNotice = {
    id: 'node-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'node-id',
      changeKind: 'node-updated',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const otherNodeNotice = {
    id: 'other-node-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'other-node-id',
      changeKind: 'node-updated',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  novu.notifications.list.mockResolvedValue({
    data: {
      notifications: [pathNotice, resourceNotice, nodeNotice, otherNodeNotice],
      hasMore: false,
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
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
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });

  await act(async () => {
    await result.current.acknowledge({ roadmapId: 'roadmap-id', nodeId: 'node-id' });
  });

  expect(resourceNotice.read).toHaveBeenCalledOnce();
  expect(nodeNotice.read).toHaveBeenCalledOnce();
  expect(pathNotice.read).not.toHaveBeenCalled();
  expect(otherNodeNotice.read).not.toHaveBeenCalled();
  expect(novu.notifications.list).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { roadmapId: 'roadmap-id' },
      read: false,
      createdLte: expect.any(Number),
    }),
  );
});

test('entering a Roadmap recognizes route notices and blocked Nodes while accessible Nodes stay pending', async () => {
  const pathNotice = {
    id: 'path-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'roadmap',
      changeKind: 'dependency-removed',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const blockedNodeNotice = {
    id: 'blocked-node-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'blocked-node-id',
      changeKind: 'node-blocked',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const classificationNotice = {
    id: 'classification-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'roadmap',
      changeKind: 'classification-updated',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  const accessibleNodeNotice = {
    id: 'accessible-node-notice',
    data: {
      roadmapId: 'roadmap-id',
      targetKind: 'node',
      nodeId: 'accessible-node-id',
      changeKind: 'dependency-added',
    },
    read: vi.fn(async () => ({ error: null })),
  };
  novu.notifications.list.mockResolvedValue({
    data: {
      notifications: [pathNotice, classificationNotice, blockedNodeNotice, accessibleNodeNotice],
      hasMore: false,
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
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
