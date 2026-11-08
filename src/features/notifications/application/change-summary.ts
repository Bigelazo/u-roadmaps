import { isNoticeVisible, type NoticeVisibilityNode } from './notice-visibility';
import type {
  ChangeSummary,
  ChangeSummaryGroup,
  ChangeSummaryItem,
  ChangeSummaryNode,
  ChangeSummaryPart,
} from '../contracts/change-summary';
import {
  projectTargetNotice,
  targetContext,
  type ParticipantRole,
  type SummaryPart,
} from './notice-targets';
import { unknownNodeType, type NodeTypeAppearance } from '@/shared/node-type';

type SummaryNotice = { data: unknown };
type SummaryNode = NoticeVisibilityNode & { title: string; nodeType: NodeTypeAppearance };
type SummaryNodeType = NodeTypeAppearance & { id: string };

export function changeSummary(
  courseCode: string,
  notices: readonly SummaryNotice[],
  nodes: readonly SummaryNode[],
  nodeTypes: readonly SummaryNodeType[],
  accessible: ReadonlySet<string>,
  role: ParticipantRole,
): ChangeSummary {
  const currentNodes = new Map(nodes.map((node) => [node.id, node]));
  const groups = new Map<string, ChangeSummaryGroup>();
  const general: ChangeSummaryItem[] = [];
  for (const notice of notices) {
    if (!isNoticeVisible(notice.data, nodes, accessible, role)) continue;
    const stored = notice.data as Record<string, unknown>;
    const nodeId = typeof stored.nodeId === 'string' ? stored.nodeId : null;
    const node = nodeId ? currentNodes.get(nodeId) : undefined;
    const projected = projectTargetNotice(stored, node ? { nodeTitle: node.title } : {});
    if (!projected) continue;
    const nodeType = (nodeIdField: string) =>
      summaryNodeType(stored, stored[nodeIdField], currentNodes, nodeTypes);
    const { summaryParts } = projected.wording;
    const item: ChangeSummaryItem = summaryParts
      ? summaryParts.map((part) => summaryPart(part, nodeType))
      : (projected.wording.summary ?? projected.wording.body);
    if (projected.wording.summaryGroup === 'general') {
      general.push(item);
      continue;
    }
    const key = nodeId ?? 'roadmap';
    const { nodeTitle } = projected.data;
    const title = node?.title ?? (typeof nodeTitle === 'string' ? nodeTitle : null);
    const group = groups.get(key) ?? {
      title: title ?? 'Roadmap',
      ...(nodeId && title !== null ? { node: { title, nodeType: nodeType('nodeId') } } : {}),
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

function summaryPart(
  part: SummaryPart,
  nodeType: (nodeIdField: string) => NodeTypeAppearance,
): ChangeSummaryPart {
  if (typeof part === 'string') return part;
  const node: ChangeSummaryNode = {
    title: part.nodeTitle,
    nodeType: nodeType(part.nodeIdField),
  };
  return { node };
}

function summaryNodeType(
  stored: Record<string, unknown>,
  nodeId: unknown,
  currentNodes: ReadonlyMap<string, SummaryNode>,
  nodeTypes: readonly SummaryNodeType[],
): NodeTypeAppearance {
  const current = typeof nodeId === 'string' ? currentNodes.get(nodeId) : undefined;
  if (current) return appearance(current.nodeType);
  if (nodeId !== stored.nodeId) return unknownNodeType;
  const { nodeTypeId, nodeTypeName, nodeTypeIcon, nodeTypeColor } = targetContext(stored.context);
  if (
    typeof nodeTypeName === 'string' &&
    typeof nodeTypeIcon === 'string' &&
    typeof nodeTypeColor === 'string'
  )
    return { name: nodeTypeName, icon: nodeTypeIcon, color: nodeTypeColor };
  const known =
    nodeTypes.find(({ id }) => id === nodeTypeId) ??
    nodeTypes.find(({ name }) => name === nodeTypeName);
  if (known) return appearance(known);
  return typeof nodeTypeName === 'string'
    ? { ...unknownNodeType, name: nodeTypeName }
    : unknownNodeType;
}

function appearance({ name, icon, color }: NodeTypeAppearance): NodeTypeAppearance {
  return { name, icon, color };
}
