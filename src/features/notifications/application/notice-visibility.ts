import { descriptorForNoticeTarget, seesEveryNode, type ParticipantRole } from './notice-targets';

export type NoticeVisibilityNode = { id: string; isVisible: boolean; nodeTypeId: string };

export function isNoticeVisible(
  value: unknown,
  nodes: readonly NoticeVisibilityNode[],
  accessible: ReadonlySet<string>,
  role: ParticipantRole | null,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const shownTo = descriptorForNoticeTarget(data.noticeTarget)?.shownTo;
  const staff = seesEveryNode(role);
  const visible = (nodeId: unknown) =>
    nodes.some((node) => node.id === nodeId && (staff || node.isVisible));
  const opens = (nodeId: unknown) => visible(nodeId) && (staff || accessible.has(nodeId as string));
  switch (shownTo) {
    case undefined:
      return false;
    case 'everyone':
      return true;
    case 'node-viewers':
      return visible(data.nodeId);
    case 'node-openers':
      return opens(data.nodeId);
    case 'dependency-viewers':
      return visible(data.sourceNodeId) && visible(data.targetNodeId);
    case 'node-type-viewers':
      return nodes.some((node) => node.nodeTypeId === data.nodeTypeId && node.isVisible);
  }
}
