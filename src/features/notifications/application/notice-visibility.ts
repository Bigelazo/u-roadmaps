import { descriptorForNoticeTarget, noticeTargetDescriptors, type ShownTo } from './notice-targets';

export type NoticeVisibilityNode = { id: string; isVisible: boolean; nodeTypeId: string };

/** The Notice targets of each `shownTo` class, as the Inbox SQL matches them. */
export const NOTICE_TARGETS_SHOWN_TO: Partial<Record<ShownTo, string[]>> = {};
for (const { shownTo, noticeTarget } of noticeTargetDescriptors)
  (NOTICE_TARGETS_SHOWN_TO[shownTo] ??= []).push(noticeTarget);

/**
 * Whether a stored notice is shown, as its Notice target declares (`shownTo`). Rows no
 * descriptor owns are shown as stored. Visibility affects presentation only; hidden notices
 * remain pending for recognition.
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
  switch (shownTo) {
    case undefined:
    case 'everyone':
      return true;
    case 'node-viewers':
      return visible(data.nodeId);
    case 'node-openers':
      return visible(data.nodeId) && accessible.has(data.nodeId as string);
    case 'dependency-viewers':
      return visible(data.sourceNodeId) && visible(data.targetNodeId);
    case 'node-type-viewers':
      return nodes.some((node) => node.nodeTypeId === data.nodeTypeId && node.isVisible);
  }
}
