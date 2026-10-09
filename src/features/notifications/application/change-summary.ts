import { NOTICE_TARGET } from './notice-targets/kinds';
import { nodeAccessChangeText } from '@/shared/node-access';
import { isNoticeVisible } from './notice-visibility';
import type { ChangeSummary } from '../contracts/change-summary';
import { projectTargetNotice } from './notice-targets';

type SummaryNotice = { data: unknown };
type SummaryNode = { id: string; title: string; isVisible: boolean; nodeTypeId?: string };

// Notices arrive newest first. Group insertion order preserves that ordering.
export function changeSummary(
  courseCode: string,
  notices: readonly SummaryNotice[],
  nodes: readonly SummaryNode[],
  accessible: ReadonlySet<string>,
): ChangeSummary {
  const currentNodes = new Map(nodes.map((node) => [node.id, node]));
  const groups = new Map<string, { title: string; items: string[] }>();
  const general: string[] = [];
  for (const notice of notices) {
    const stored = notice.data as Record<string, unknown>;
    const nodeId = typeof stored.nodeId === 'string' ? stored.nodeId : null;
    const node = nodeId ? currentNodes.get(nodeId) : undefined;
    if (!isNoticeVisible(stored, nodes, accessible)) continue;
    // Lifecycle notices share their read-time wording with the Inbox, naming Nodes by
    // their current title (a deleted Node by the title it had).
    const projected = projectTargetNotice(stored, node ? { nodeTitle: node.title } : {});
    const data = (projected?.data ?? stored) as Record<string, unknown>;
    const kind = data.changeKind;
    const fields = Array.isArray(data.changedFields) ? data.changedFields : [];
    const items: string[] = [];
    if (projected) {
      const item = projected.wording.summary ?? projected.wording.body;
      if (projected.wording.summaryGroup === 'node') items.push(item);
      else general.push(item);
    } else if (data.noticeTarget === NOTICE_TARGET.nodeAccess) {
      items.push(
        nodeAccessChangeText(
          node?.title ?? String(data.nodeTitle),
          String(data.knownValue),
          String(data.currentValue),
        ),
      );
    } else
      switch (kind) {
        case 'node-updated':
          if (fields.includes('title')) items.push('Se actualizó el título.');
          if (fields.includes('description') && nodeId && accessible.has(nodeId))
            items.push('Se actualizó la descripción.');
          if (fields.includes('nodeType'))
            general.push(`Se actualizó el tipo del Nodo «${node?.title ?? data.nodeTitle}».`);
          break;
        case 'node-available':
          items.push('Nodo disponible.');
          break;
        case 'node-retired':
          items.push('Nodo retirado.');
          break;
        case 'node-deleted':
          items.push('Nodo eliminado.');
          break;
        case 'node-blocked':
          items.push('Nodo bloqueado.');
          break;
        case 'resource-added':
          items.push(`Nuevo recurso «${data.resourceTitle}».`);
          break;
        case 'resource-updated':
          items.push(`Se actualizó el recurso «${data.resourceTitle}».`);
          if (typeof data.titleChange === 'string') items.push(data.titleChange);
          break;
        case 'resource-removed':
          items.push(`Se eliminó el recurso «${data.resourceTitle}».`);
          break;
        case 'roadmap-available':
          general.push('Roadmap disponible.');
          break;
      }
    if (!items.length) continue;
    const key = nodeId ?? 'roadmap';
    const group = groups.get(key) ?? {
      title: node?.title ?? (typeof data.nodeTitle === 'string' ? data.nodeTitle : 'Roadmap'),
      items: [],
    };
    group.items.push(...items);
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
