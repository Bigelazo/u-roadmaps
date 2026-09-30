import { beforeEach, expect, test, vi } from 'vitest';

const { deliverRoadmapPathChange, deliverRoadmapNodeNotifications } = vi.hoisted(() => ({
  deliverRoadmapPathChange: vi.fn(async () => undefined),
  deliverRoadmapNodeNotifications: vi.fn(async () => undefined),
}));

vi.mock('@/features/notifications/server', () => ({ deliverRoadmapPathChange }));
vi.mock('@/app/_adapters/roadmap-node-notifications', () => ({ deliverRoadmapNodeNotifications }));

import { deliverRoadmapDependencyNotifications } from '@/app/_adapters/roadmap-dependency-notifications';

beforeEach(() => {
  vi.clearAllMocks();
});

test('maps confirmed Dependency and access descriptors to their respective notices', async () => {
  deliverRoadmapPathChange.mockRejectedValueOnce(new Error('Novu unavailable'));
  const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
  const notifications = {
    path: {
      roadmapId: 'roadmap-id',
      changeKind: 'dependency-added' as const,
      dependentNodeTitle: 'Evaluación 1',
      prerequisiteNodeTitle: 'Leyes de Newton',
      recipientIds: ['student-id'],
    },
    nodes: [
      {
        nodeId: 'blocked-node-id',
        roadmapId: 'roadmap-id',
        changeKind: 'node-blocked' as const,
        nodeTitle: 'Evaluación 1',
        nodeTypeName: 'Evaluación',
        targetKind: 'roadmap' as const,
        recipientIds: ['student-id'],
      },
    ],
  };

  await expect(
    deliverRoadmapDependencyNotifications({
      actorId: 'teacher-id',
      identifier,
      notifications,
    }),
  ).resolves.toBeUndefined();

  expect(deliverRoadmapPathChange).toHaveBeenCalledExactlyOnceWith({
    userId: 'teacher-id',
    identifier,
    ...notifications.path,
  });
  expect(deliverRoadmapNodeNotifications).toHaveBeenCalledExactlyOnceWith({
    actorId: 'teacher-id',
    identifier,
    notifications: notifications.nodes,
  });
});
