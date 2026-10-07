import { isNoticeVisible } from './notice-visibility';
import type { ChangeSummary } from '../contracts/change-summary';

type SummaryNotice = { data: unknown };
type SummaryNode = { id: string; title: string; isVisible: boolean };

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
    const data = notice.data as Record<string, unknown>;
    const nodeId = typeof data.nodeId === 'string' ? data.nodeId : null;
    const node = nodeId ? currentNodes.get(nodeId) : undefined;
    const kind = data.changeKind;
    if (!isNoticeVisible(data, nodes, accessible)) continue;
    const fields = Array.isArray(data.changedFields) ? data.changedFields : [];
    const items: string[] = [];
    if (data.noticeTarget === 'node-access') {
      items.push(`Pasó de ${data.knownValue} a ${data.currentValue}.`);
    } else
      switch (kind) {
        case 'node-updated':
          if (data.noticeTarget === 'node-title')
            items.push(`«${data.knownTitle}» pasó a llamarse «${data.currentTitle}».`);
          else if (fields.includes('title')) items.push('Se actualizó el título.');
          if (fields.includes('description') && nodeId && accessible.has(nodeId))
            items.push('Se actualizó la descripción.');
          if (fields.includes('nodeType'))
            general.push(
              data.noticeTarget === 'node-type'
                ? `«${node?.title ?? data.nodeTitle}» pasó de tipo «${data.knownTypeName}» a tipo «${data.currentTypeName}».`
                : `Se actualizó el tipo del Nodo «${node?.title ?? data.nodeTitle}».`,
            );
          break;
        case 'node-available':
          items.push(
            data.noticeTarget === 'node-creation'
              ? `Nuevo Nodo «${node?.title ?? data.nodeTitle}»${data.nodeAccess === 'Bloqueado' ? ' (Bloqueado)' : ''}.`
              : 'Nodo disponible.',
          );
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
        case 'dependency-added':
        case 'dependency-removed':
          general.push(
            `«${data.dependentNodeTitle}» ${kind === 'dependency-added' ? 'ahora requiere' : 'ya no requiere'} «${data.prerequisiteNodeTitle}».`,
          );
          break;
        case 'classification-updated':
          general.push(`El tipo «${data.previousTypeName}» ahora se llama «${data.nextTypeName}».`);
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
