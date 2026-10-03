import {
  accessTransitionNotifications,
  type AccessSnapshot,
  type NodeNotificationDescriptor,
} from './node-change-notifications';

export type DependencyPathNotificationDescriptor = Readonly<{
  eventId: string;
  dependencyId: string;
  roadmapId: string;
  changeKind: 'dependency-added' | 'dependency-removed';
  dependentNodeTitle: string;
  prerequisiteNodeTitle: string;
  recipientIds: readonly string[];
}>;

export type DependencyNotificationBatch = Readonly<{
  path?: DependencyPathNotificationDescriptor;
  nodes: readonly NodeNotificationDescriptor[];
}>;

type DependencyEndpoint = Readonly<{ title: string; isVisible: boolean }>;

export function dependencyChangeNotifications({
  before,
  after,
  actorId,
  dependencyId,
  roadmapId,
  changeKind,
  sourceNode,
  targetNode,
}: {
  before: AccessSnapshot;
  after: AccessSnapshot;
  actorId: string;
  dependencyId: string;
  roadmapId: string;
  changeKind: DependencyPathNotificationDescriptor['changeKind'];
  sourceNode: DependencyEndpoint;
  targetNode: DependencyEndpoint;
}): DependencyNotificationBatch {
  const recipientIds = after.participants
    .filter(({ userId }) => userId !== actorId)
    .map(({ userId }) => userId);
  const path =
    sourceNode.isVisible && targetNode.isVisible && recipientIds.length > 0
      ? {
          eventId: `${dependencyId}:${changeKind}`,
          dependencyId,
          roadmapId,
          changeKind,
          dependentNodeTitle: targetNode.title,
          prerequisiteNodeTitle: sourceNode.title,
          recipientIds,
        }
      : undefined;

  const nodes = accessTransitionNotifications({ before, after, actorId, roadmapId }).map(
    (notification) => ({
      ...notification,
      eventId: `${dependencyId}:${changeKind}:${notification.nodeId}:${notification.changeKind}`,
    }),
  );

  return {
    ...(path ? { path } : {}),
    nodes,
  };
}
