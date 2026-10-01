import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapClassificationChangeNotice,
} from '../contracts';
import { emitRoadmapScopedNotice } from './emit-roadmap-scoped-notice';

export async function emitRoadmapClassificationChange(
  notice: RoadmapClassificationChangeNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  const noticeTitle = `Tipo «${notice.previousTypeName}» → «${notice.nextTypeName}»`.slice(0, 256);
  const noticeBody =
    `${notice.actorName.slice(0, 96)} actualizó la clasificación del Roadmap de ${notice.courseCode.slice(0, 32)}.`.slice(
      0,
      256,
    );

  await emitRoadmapScopedNotice(
    {
      ...notice,
      changeKind: 'classification-updated',
      noticeTitle,
      noticeBody,
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
