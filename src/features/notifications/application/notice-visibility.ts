import { descriptorForNoticeTarget } from './notice-targets';

export type NoticeVisibilityNode = { id: string; isVisible: boolean; nodeTypeId: string };

/**
 * Whether a stored notice is shown, as its Notice target declares (`shownTo`). A row no
 * descriptor owns may carry hidden or Blocked node details, so with a `nodeId` it is shown
 * like `node-openers`; without one it is shown as stored. Visibility affects presentation
 * only; hidden notices remain pending for recognition.
 */
export function isNoticeVisible(
  value: unknown,
  nodes: readonly NoticeVisibilityNode[],
  accessible: ReadonlySet<string>,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const shownTo = descriptorForNoticeTarget(data.noticeTarget)?.shownTo;
  const visible = (nodeId: unknown) => nodes.some((node) => node.id === nodeId && node.isVisible);
  const opens = (nodeId: unknown) => visible(nodeId) && accessible.has(nodeId as string);
  switch (shownTo) {
    case undefined:
      return typeof data.nodeId !== 'string' || opens(data.nodeId);
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
