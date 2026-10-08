import type { NodeChangeNotice, ResourceChangeNotice } from '../contracts';

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
  return {
    noticeTitle: notice.nodeTitle,
    noticeBody: body,
    label,
  };
}

export function resourceMessage(notice: ResourceChangeNotice) {
  const noticeTitle = `Cambio de recurso: ${notice.resourceTitle}`;
  const noticeBody = `${notice.actorName} modificó un recurso en un Nodo del Roadmap de ${notice.courseCode}.`;
  return { noticeTitle, noticeBody };
}
