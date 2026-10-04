import { beforeEach, expect, test, vi } from 'vitest';

const { deliverNodeChange } = vi.hoisted(() => ({
  deliverNodeChange: vi.fn(async () => undefined),
}));

vi.mock('@/features/notifications/server', () => ({ deliverNodeChange }));

import { deliverRoadmapNodeNotifications } from '@/app/_adapters/roadmap-node-notifications';

beforeEach(() => {
  vi.clearAllMocks();
});

test('maps each Roadmap access descriptor to a safe notification delivery', async () => {
  deliverNodeChange.mockRejectedValueOnce(new Error('Notification persistence unavailable'));
  const notifications = [
    {
      nodeId: 'blocked-node-id',
      roadmapId: 'roadmap-id',
      changeKind: 'node-blocked' as const,
      nodeTitle: 'Nodo bloqueado',
      nodeTypeName: 'Contenido',
      targetKind: 'roadmap' as const,
      recipientIds: ['student-id'],
    },
    {
      nodeId: 'available-node-id',
      roadmapId: 'roadmap-id',
      changeKind: 'node-available' as const,
      nodeTitle: 'Nodo disponible',
      nodeTypeName: 'Contenido',
      targetKind: 'node' as const,
      recipientIds: ['other-student-id'],
    },
  ];

  await expect(
    deliverRoadmapNodeNotifications({
      actorId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      notifications,
    }),
  ).resolves.toBeUndefined();

  expect(deliverNodeChange).toHaveBeenCalledTimes(2);
  expect(deliverNodeChange).toHaveBeenNthCalledWith(1, {
    userId: 'teacher-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'blocked-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-blocked',
    changedFields: [],
    nodeTitle: 'Nodo bloqueado',
    nodeTypeName: 'Contenido',
    recipientIds: ['student-id'],
    targetKind: 'roadmap',
  });
  expect(deliverNodeChange).toHaveBeenNthCalledWith(2, {
    userId: 'teacher-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'available-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-available',
    changedFields: [],
    nodeTitle: 'Nodo disponible',
    nodeTypeName: 'Contenido',
    recipientIds: ['other-student-id'],
    targetKind: 'node',
  });
});

test('starts independent Node deliveries before either one finishes', async () => {
  let releaseFirst: (() => void) | undefined;
  deliverNodeChange.mockImplementationOnce(
    () =>
      new Promise<undefined>((resolve) => {
        releaseFirst = () => resolve(undefined);
      }),
  );

  const delivery = deliverRoadmapNodeNotifications({
    actorId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    notifications: [
      {
        nodeId: 'first-node-id',
        roadmapId: 'roadmap-id',
        changeKind: 'node-blocked',
        nodeTitle: 'First',
        nodeTypeName: 'Contenido',
        targetKind: 'roadmap',
        recipientIds: ['student-id'],
      },
      {
        nodeId: 'second-node-id',
        roadmapId: 'roadmap-id',
        changeKind: 'node-available',
        nodeTitle: 'Second',
        nodeTypeName: 'Contenido',
        targetKind: 'node',
        recipientIds: ['student-id'],
      },
    ],
  });

  expect(deliverNodeChange).toHaveBeenCalledTimes(2);
  releaseFirst?.();
  await expect(delivery).resolves.toBeUndefined();
});
