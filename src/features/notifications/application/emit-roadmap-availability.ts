import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapAvailabilityNotice,
} from '../contracts';
import { sendNotice } from './send-notice';

export async function emitRoadmapAvailability(
  notice: RoadmapAvailabilityNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  await sendNotice(
    {
      ...notice,
      changeKind: 'roadmap-available',
      payload: {
        roadmapId: notice.roadmapId,
        courseCode: notice.courseCode,
        year: notice.year,
        semester: notice.semester,
        targetKind: 'roadmap',
        changeKind: 'roadmap-available',
        occurredAt: notice.occurredAt.toISOString(),
        eventCount: 1,
        actorName: notice.actorName,
      },
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
