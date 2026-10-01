export type NodeTypeClassificationNotification = Readonly<{
  roadmapId: string;
  previousTypeName: string;
  nextTypeName: string;
  recipientIds: readonly string[];
}>;

export function nodeTypeClassificationNotification({
  roadmapId,
  previousTypeName,
  nextTypeName,
  visibleNodeCount,
  actorId,
  participants,
}: {
  roadmapId: string;
  previousTypeName: string;
  nextTypeName: string;
  visibleNodeCount: number;
  actorId: string;
  participants: readonly { userId: string; isActive: boolean }[];
}): NodeTypeClassificationNotification | undefined {
  if (previousTypeName === nextTypeName || visibleNodeCount === 0) return undefined;

  const recipientIds = participants
    .filter(({ userId, isActive }) => isActive && userId !== actorId)
    .map(({ userId }) => userId);
  if (recipientIds.length === 0) return undefined;

  return { roadmapId, previousTypeName, nextTypeName, recipientIds };
}
