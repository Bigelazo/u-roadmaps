import type {
  NodeChangeNotice,
  RoadmapPathChangeNotice,
  RoadmapClassificationChangeNotice,
} from '../contracts';

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

export function roadmapPathChangeMessage(notice: RoadmapPathChangeNotice) {
  const requirement =
    notice.changeKind === 'dependency-added' ? 'ahora requiere' : 'ya no requiere';
  return {
    noticeTitle: 'Ruta actualizada',
    noticeBody: `${notice.actorName} actualizó la ruta de ${notice.courseCode}: «${notice.dependentNodeTitle}» ${requirement} «${notice.prerequisiteNodeTitle}».`,
  };
}

export function roadmapClassificationChangeMessage(notice: RoadmapClassificationChangeNotice) {
  return {
    noticeTitle: `Tipo «${notice.previousTypeName}» → «${notice.nextTypeName}»`,
    noticeBody: `${notice.actorName} actualizó la clasificación del Roadmap de ${notice.courseCode}.`,
  };
}
