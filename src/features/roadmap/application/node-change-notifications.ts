import {
  NODE_ACCESS_STATES,
  nodeAccessState,
  accessNoticeDestination,
  type NodeAccessState,
} from '@/shared/node-access';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';

export type NodeNotificationDescriptor = Readonly<{
  eventId?: string;
  nodeId: string;
  roadmapId: string;
  changeKind: 'node-available' | 'node-retired' | 'node-deleted' | 'node-blocked';
  nodeTitle: string;
  nodeTypeName: string;
  targetKind: 'node' | 'roadmap';
  previousAccess?: NodeAccessState;
  recipientIds: readonly string[];
}>;

export type AccessSnapshot = Readonly<{
  nodes: readonly {
    id: string;
    title: string;
    nodeType: { name: string };
    isVisible: boolean;
    isTeacherBlocked: boolean;
  }[];
  accessibleByUser: ReadonlyMap<string, ReadonlySet<string>>;
  participants: readonly { userId: string }[];
}>;

type AccessSnapshotParticipant = Readonly<{
  userId: string;
  role: 'STUDENT' | 'TEACHER';
  isActive: boolean;
}>;

export function projectAccessSnapshot({
  nodes,
  dependencies,
  participants,
  completions,
}: {
  nodes: AccessSnapshot['nodes'];
  dependencies: readonly { sourceNodeId: string; targetNodeId: string }[];
  participants: readonly AccessSnapshotParticipant[];
  completions: readonly { userId: string; roadmapNodeId: string }[];
}): AccessSnapshot {
  const visibleNodes = nodes.filter((node) => node.isVisible);
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
  const visibleDependencies = dependencies.filter(
    ({ sourceNodeId, targetNodeId }) =>
      visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId),
  );
  const completionIdsByUser = new Map<string, Set<string>>();
  for (const completion of completions) {
    const ids = completionIdsByUser.get(completion.userId) ?? new Set<string>();
    ids.add(completion.roadmapNodeId);
    completionIdsByUser.set(completion.userId, ids);
  }

  const accessibleByUser = new Map<string, ReadonlySet<string>>();
  const activeParticipants = participants.filter(({ isActive }) => isActive);
  for (const participant of activeParticipants) {
    const accessible =
      participant.role === 'TEACHER'
        ? visibleNodes.filter(({ isTeacherBlocked }) => !isTeacherBlocked).map(({ id }) => id)
        : [
            ...studentNodeAccessById({
              nodes: visibleNodes,
              dependencies: visibleDependencies,
              completedNodeIds: completionIdsByUser.get(participant.userId) ?? new Set(),
            }),
          ]
            .filter(([, access]) => access.status === 'ACCESSIBLE')
            .map(([id]) => id);
    accessibleByUser.set(participant.userId, new Set(accessible));
  }

  return {
    nodes,
    accessibleByUser,
    participants: activeParticipants.map(({ userId }) => ({ userId })),
  };
}

export function accessTransitionNotifications({
  before,
  after,
  actorId,
  roadmapId,
  excludedNodeIds = new Set(),
}: {
  before: AccessSnapshot;
  after: AccessSnapshot;
  actorId: string;
  roadmapId: string;
  excludedNodeIds?: ReadonlySet<string>;
}): NodeNotificationDescriptor[] {
  const notices: NodeNotificationDescriptor[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  for (const node of after.nodes) {
    if (excludedNodeIds.has(node.id)) continue;
    const previousNode = beforeNodes.get(node.id);
    if (!previousNode) continue;
    for (const previousAccess of NODE_ACCESS_STATES) {
      for (const currentAccess of NODE_ACCESS_STATES) {
        if (previousAccess === currentAccess) continue;
        const recipientIds = after.participants
          .filter(({ userId }) => {
            if (userId === actorId) return false;
            const beforeState = nodeAccessState(
              previousNode.isVisible,
              before.accessibleByUser.get(userId)?.has(node.id) ?? false,
            );
            const afterState = nodeAccessState(
              node.isVisible,
              after.accessibleByUser.get(userId)?.has(node.id) ?? false,
            );
            return beforeState === previousAccess && afterState === currentAccess;
          })
          .map(({ userId }) => userId);
        if (!recipientIds.length) continue;
        notices.push({
          nodeId: node.id,
          roadmapId,
          ...accessNoticeDestination(currentAccess),
          nodeTitle: node.title,
          nodeTypeName: node.nodeType.name,
          previousAccess,
          recipientIds,
        });
      }
    }
  }
  return notices;
}

export function visibilityNotifications({
  before,
  after,
  actorId,
  targetNodeId,
  targetChange,
  roadmapId,
}: {
  before: AccessSnapshot;
  after: AccessSnapshot;
  actorId: string;
  targetNodeId: string;
  targetChange?: 'node-available' | 'node-retired' | 'node-deleted';
  roadmapId: string;
}): NodeNotificationDescriptor[] {
  const notices: NodeNotificationDescriptor[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  if (targetChange === 'node-deleted') {
    const node = beforeNodes.get(targetNodeId) ?? afterNodes.get(targetNodeId);
    if (node) {
      const recipients = before.participants;
      notices.push({
        nodeId: targetNodeId,
        roadmapId,
        changeKind: targetChange,
        nodeTitle: node.title,
        nodeTypeName: node.nodeType.name,
        targetKind: 'roadmap',
        recipientIds: recipients.map(({ userId }) => userId).filter((id) => id !== actorId),
      });
    }
  }
  return [
    ...notices,
    ...accessTransitionNotifications({
      before,
      after,
      actorId,
      roadmapId,
      excludedNodeIds: targetChange === 'node-deleted' ? new Set([targetNodeId]) : new Set(),
    }),
  ];
}
