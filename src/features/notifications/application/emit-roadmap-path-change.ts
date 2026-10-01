import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapPathChangeNotice,
} from '../contracts';
import { emitRoadmapScopedNotice } from './emit-roadmap-scoped-notice';

export async function emitRoadmapPathChange(
  notice: RoadmapPathChangeNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  const requirement =
    notice.changeKind === 'dependency-added' ? 'ahora requiere' : 'ya no requiere';
  const noticeBody =
    `${notice.actorName.slice(0, 48)} actualizó la ruta de ${notice.courseCode.slice(0, 32)}: «${notice.dependentNodeTitle.slice(0, 64)}» ${requirement} «${notice.prerequisiteNodeTitle.slice(0, 64)}».`.slice(
      0,
      256,
    );

  await emitRoadmapScopedNotice(
    {
      ...notice,
      noticeTitle: 'Ruta actualizada',
      noticeBody,
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
