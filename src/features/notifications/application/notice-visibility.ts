export type NoticeVisibilityNode = { id: string; isVisible: boolean; nodeTypeId?: string };

/** Visibility affects presentation only; hidden notices remain pending for recognition. */
export function isNoticeVisible(
  value: unknown,
  nodes: readonly NoticeVisibilityNode[],
  accessible: ReadonlySet<string>,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (data.noticeTarget === 'dependency')
    return [data.sourceNodeId, data.targetNodeId].every((nodeId) =>
      nodes.some((node) => node.id === nodeId && node.isVisible),
    );
  if (data.noticeTarget === 'node-type-name')
    return (
      typeof data.nodeTypeId === 'string' &&
      nodes.some((node) => node.nodeTypeId === data.nodeTypeId && node.isVisible)
    );
  const node = nodes.find(({ id }) => id === data.nodeId);
  // Access withdrawal and deletion describe a change in the Roadmap itself.
  if (data.noticeTarget === 'node-access' || data.changeKind === 'node-deleted') return true;
  // A new Node that no longer exists has nothing left to show.
  if (!node) return data.noticeTarget !== 'node-creation';
  if (!node.isVisible) return false;
  const fields = Array.isArray(data.changedFields) ? data.changedFields : [];
  const details =
    data.noticeTarget === 'node-description' ||
    data.changeKind === 'resource-added' ||
    data.changeKind === 'resource-updated' ||
    data.changeKind === 'resource-removed' ||
    (data.changeKind === 'node-updated' &&
      !fields.includes('title') &&
      !fields.includes('nodeType') &&
      !data.noticeTarget);
  return !details || accessible.has(node.id);
}
