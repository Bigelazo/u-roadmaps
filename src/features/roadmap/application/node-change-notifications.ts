export type NodeNotificationDescriptor = Readonly<{
  nodeId: string;
  roadmapId: string;
  changeKind: 'node-available' | 'node-retired' | 'node-deleted' | 'node-blocked';
  nodeTitle: string;
  nodeTypeName: string;
  targetKind: 'node' | 'roadmap';
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
  if (targetChange) {
    const node = beforeNodes.get(targetNodeId) ?? afterNodes.get(targetNodeId);
    if (node) {
      const recipients =
        targetChange === 'node-available'
          ? after.participants.filter(({ userId }) =>
              after.accessibleByUser.get(userId)?.has(targetNodeId),
            )
          : before.participants;
      notices.push({
        nodeId: targetNodeId,
        roadmapId,
        changeKind: targetChange,
        nodeTitle: node.title,
        nodeTypeName: node.nodeType.name,
        targetKind: targetChange === 'node-available' ? 'node' : 'roadmap',
        recipientIds: recipients.map(({ userId }) => userId).filter((id) => id !== actorId),
      });
    }
  }
  for (const node of after.nodes) {
    if (!node.isVisible || node.id === targetNodeId) continue;
    const changedRecipients = after.participants.flatMap(({ userId }) => {
      if (userId === actorId) return [];
      const wasAccessible = before.accessibleByUser.get(userId)?.has(node.id) ?? false;
      const isAccessible = after.accessibleByUser.get(userId)?.has(node.id) ?? false;
      return wasAccessible === isAccessible ? [] : [{ userId, isAccessible }];
    });
    for (const isAvailable of [true, false]) {
      const recipientIds = changedRecipients
        .filter(({ isAccessible }) => isAccessible === isAvailable)
        .map(({ userId }) => userId);
      if (!recipientIds.length) continue;
      notices.push({
        nodeId: node.id,
        roadmapId,
        changeKind: isAvailable ? 'node-available' : 'node-blocked',
        nodeTitle: node.title,
        nodeTypeName: node.nodeType.name,
        targetKind: isAvailable ? 'node' : 'roadmap',
        recipientIds,
      });
    }
  }
  return notices;
}
