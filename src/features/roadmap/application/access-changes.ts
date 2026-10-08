import { nodeAccessState } from '@/shared/node-access';
import type { AccessSnapshot } from './node-change-notifications';
import type { RoadmapChangeFact } from './change-port';

export function accessChanges(before: AccessSnapshot, after: AccessSnapshot): RoadmapChangeFact[] {
  const previousNodes = new Map(before.nodes.map((node) => [node.id, node]));
  return after.nodes.flatMap((node) => {
    const old = previousNodes.get(node.id);
    if (!old) return [];
    return after.participants.flatMap(({ userId }): RoadmapChangeFact[] => {
      const previous = nodeAccessState(
        old.isVisible,
        before.accessibleByUser.get(userId)?.has(node.id) ?? false,
      );
      const current = nodeAccessState(
        node.isVisible,
        after.accessibleByUser.get(userId)?.has(node.id) ?? false,
      );
      return previous === current
        ? []
        : [
            {
              kind: 'node-access',
              nodeId: node.id,
              recipientId: userId,
              previous,
              current,
              nodeTitle: node.title,
              nodeTypeName: node.nodeType.name,
            },
          ];
    });
  });
}
