import { isNoticeVisible, type NoticeVisibilityNode } from './notice-visibility';
import type { ChangeSummary } from '../contracts/change-summary';
import { projectTargetNotice, type ParticipantRole } from './notice-targets';

type SummaryNotice = { data: unknown };
type SummaryNode = NoticeVisibilityNode & { title: string };

/**
 * The Change summary shows what the Inbox shows, worded by each Notice target's descriptor.
 * Notices arrive newest first, and group insertion order preserves that ordering.
 */
export function changeSummary(
  courseCode: string,
  notices: readonly SummaryNotice[],
  nodes: readonly SummaryNode[],
  accessible: ReadonlySet<string>,
  role: ParticipantRole,
): ChangeSummary {
  const currentNodes = new Map(nodes.map((node) => [node.id, node]));
  const groups = new Map<string, { title: string; items: string[] }>();
  const general: string[] = [];
  for (const notice of notices) {
    if (!isNoticeVisible(notice.data, nodes, accessible, role)) continue;
    const stored = notice.data as Record<string, unknown>;
    const nodeId = typeof stored.nodeId === 'string' ? stored.nodeId : null;
    const node = nodeId ? currentNodes.get(nodeId) : undefined;
    // Nodes are named by their current title (a deleted Node by the title it had).
    const projected = projectTargetNotice(stored, node ? { nodeTitle: node.title } : {});
    if (!projected) continue;
    const item = projected.wording.summary ?? projected.wording.body;
    if (projected.wording.summaryGroup === 'general') {
      general.push(item);
      continue;
    }
    const key = nodeId ?? 'roadmap';
    const { nodeTitle } = projected.data;
    const group = groups.get(key) ?? {
      title: node?.title ?? (typeof nodeTitle === 'string' ? nodeTitle : 'Roadmap'),
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return {
    courseCode,
    groups: [
      ...groups.values(),
      ...(general.length ? [{ title: 'Ruta y clasificación', items: general }] : []),
    ],
  };
}
