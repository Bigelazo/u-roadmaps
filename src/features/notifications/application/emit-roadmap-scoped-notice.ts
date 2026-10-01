import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapAvailabilityRecipient,
} from '../contracts';
import { sendNotice } from './send-notice';

type RoadmapScopedNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseCode: string;
  year: number;
  semester: number;
  changeKind: string;
  occurredAt: Date;
  actorName: string;
  noticeTitle: string;
  noticeBody: string;
  recipients: readonly RoadmapAvailabilityRecipient[];
}>;

export async function emitRoadmapScopedNotice(
  notice: RoadmapScopedNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  await sendNotice(
    {
      ...notice,
      payload: {
        roadmapId: notice.roadmapId,
        courseCode: notice.courseCode,
        year: notice.year,
        semester: notice.semester,
        targetKind: 'roadmap',
        changeKind: notice.changeKind,
        occurredAt: notice.occurredAt.toISOString(),
        eventCount: 1,
        actorName: notice.actorName,
        noticeTitle: notice.noticeTitle,
        noticeBody: notice.noticeBody,
      },
    },
    transport,
    findActiveRecipients,
    workflowId,
  );
}
