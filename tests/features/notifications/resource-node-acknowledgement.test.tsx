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
    data: { notifications: [resourceNotice, nodeNotice, otherNodeNotice], hasMore: false },
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
  expect(otherNodeNotice.read).not.toHaveBeenCalled();
  expect(novu.notifications.list).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { roadmapId: 'roadmap-id' },
      read: false,
      createdLte: expect.any(Number),
    }),
  );
});
