import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapPathChangeNotice,
} from '../contracts';
import { emitRoadmapScopedNotice } from './emit-roadmap-scoped-notice';

export function roadmapPathChangeMessage(
  notice: Pick<
    RoadmapPathChangeNotice,
    'actorName' | 'courseCode' | 'changeKind' | 'dependentNodeTitle' | 'prerequisiteNodeTitle'
  >,
) {
  const requirement =
    notice.changeKind === 'dependency-added' ? 'ahora requiere' : 'ya no requiere';
  return {
    noticeTitle: 'Ruta actualizada',
    noticeBody:
      `${notice.actorName.slice(0, 48)} actualizó la ruta de ${notice.courseCode.slice(0, 32)}: «${notice.dependentNodeTitle.slice(0, 64)}» ${requirement} «${notice.prerequisiteNodeTitle.slice(0, 64)}».`.slice(
        0,
        256,
      ),
  };
}

export async function emitRoadmapPathChange(
  notice: RoadmapPathChangeNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  const { noticeTitle, noticeBody } = roadmapPathChangeMessage(notice);

  await emitRoadmapScopedNotice(
    {
      ...notice,
      noticeTitle,
      noticeBody,
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
