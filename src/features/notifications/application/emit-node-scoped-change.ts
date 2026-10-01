import type {
  ActiveRecipientLookup,
  NodeChangeNotice,
  NotificationTransport,
  ResourceChangeNotice,
} from '../contracts';
import { NotificationTransportError } from '../contracts';

const REQUEST_TIMEOUT_MS = 3_000;

function nodeMessage(notice: NodeChangeNotice) {
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

function resourceMessage(notice: ResourceChangeNotice) {
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
  if (!workflowId || !notice.recipients.length) return;
  const message = 'resourceTitle' in notice ? resourceMessage(notice) : nodeMessage(notice);
  for (let offset = 0; offset < notice.recipients.length; offset += 500) {
    const recipients = notice.recipients.slice(offset, offset + 500);
    await transport
      .ensureSubscribers({ eventId: notice.eventId, recipients })
      .catch(() => undefined);
  }
  for (let offset = 0; offset < notice.recipients.length; offset += 100) {
    const batch = notice.recipients.slice(offset, offset + 100);
    const transactionId = `${notice.eventId}:${notice.changeKind}:${offset}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const activeIds = await findActiveRecipients(batch.map(({ userId }) => userId));
        if (!activeIds.length) break;
        await withTimeout(
          transport.trigger({
            workflowId,
            roadmapId: notice.roadmapId,
            eventId: notice.eventId,
            transactionId,
            recipients: activeIds,
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
              ...('targetKind' in notice && notice.targetKind
                ? { targetKind: notice.targetKind }
                : {}),
              changeKind: notice.changeKind,
              occurredAt: notice.occurredAt.toISOString(),
              eventCount: 1,
              actorName: notice.actorName,
              ...('resourceTitle' in notice ? { resourceTitle: notice.resourceTitle } : {}),
            },
          }),
          REQUEST_TIMEOUT_MS,
        );
        break;
      } catch (error) {
        if (error instanceof NotificationTransportError && !error.retryable) break;
        if (attempt === 1) break;
      }
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new NotificationTransportError('Notification transport timed out.', true)),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
