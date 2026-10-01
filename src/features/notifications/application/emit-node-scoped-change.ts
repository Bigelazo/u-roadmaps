import type {
  ActiveRecipientLookup,
  NodeChangeNotice,
  NotificationTransport,
  ResourceChangeNotice,
} from '../contracts';
import { sendNotice } from './send-notice';

export function nodeMessage(notice: NodeChangeNotice) {
  const label =
    notice.changeKind === 'node-available'
      ? 'Nodo disponible'
      : notice.changeKind === 'node-updated'
        ? 'Nodo actualizado'
        : notice.changeKind === 'node-retired'
          ? 'Nodo retirado'
          : notice.changeKind === 'node-deleted'
            ? 'Nodo eliminado'
            : 'Nodo bloqueado';
  const type =
    notice.changeKind === 'node-deleted' && notice.nodeTypeName
      ? ` Tipo anterior: ${notice.nodeTypeName}.`
      : '';
  const body = `${label}: ${notice.actorName} informó este cambio en el Roadmap de ${notice.courseCode}.${type}`;
  return { noticeTitle: notice.nodeTitle.slice(0, 256), noticeBody: body.slice(0, 256), label };
}

export function resourceMessage(notice: ResourceChangeNotice) {
  const noticeTitle = `Cambio de recurso: ${notice.resourceTitle}`.slice(0, 256);
  const noticeBody =
    `${notice.actorName} modificó un recurso en un Nodo del Roadmap de ${notice.courseCode}.`.slice(
      0,
      256,
    );
  return { noticeTitle, noticeBody };
}

export async function emitNodeScopedChange(
  notice: NodeChangeNotice | ResourceChangeNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  const message = 'resourceTitle' in notice ? resourceMessage(notice) : nodeMessage(notice);
  await sendNotice(
    {
      ...notice,
      payload: {
        roadmapId: notice.roadmapId,
        courseCode: notice.courseCode,
        year: notice.year,
        semester: notice.semester,
        targetKind: 'node',
        nodeId: notice.nodeId,
        nodeTitle: notice.nodeTitle,
        noticeTitle: message.noticeTitle,
        noticeBody: message.noticeBody,
        ...('nodeTypeName' in notice && notice.nodeTypeName
          ? { nodeTypeName: notice.nodeTypeName }
          : {}),
        ...('targetKind' in notice && notice.targetKind ? { targetKind: notice.targetKind } : {}),
        changeKind: notice.changeKind,
        occurredAt: notice.occurredAt.toISOString(),
        eventCount: 1,
        actorName: notice.actorName,
        ...('resourceTitle' in notice ? { resourceTitle: notice.resourceTitle } : {}),
      },
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
