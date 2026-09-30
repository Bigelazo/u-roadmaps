import { expect, test, vi } from 'vitest';
import {
  NotificationTransportError,
  type NotificationTransport,
  type RoadmapClassificationChangeNotice,
} from '@/features/notifications/contracts';
import { emitRoadmapClassificationChange } from '@/features/notifications/application/emit-roadmap-classification-change';

const notice: RoadmapClassificationChangeNotice = {
  eventId: 'classification-event-1',
  roadmapId: 'roadmap-1',
  courseOfferingId: 'offering-1',
  courseCode: 'CC3002',
  year: 2026,
  semester: 2,
  previousTypeName: 'Lectura',
  nextTypeName: 'Lecturas guiadas',
  actorId: 'teacher-1',
  actorName: 'Docente A',
  occurredAt: new Date('2026-09-30T15:00:00.000Z'),
  recipients: [{ userId: 'student-1', name: 'Estudiante A' }],
};

function fakeTransport(trigger: NotificationTransport['trigger']): NotificationTransport {
  return {
    ensureSubscribers: vi.fn(async () => undefined),
    trigger,
  };
}

test('sends one Roadmap-level notice that preserves both names in the rename', async () => {
  const trigger = vi.fn<NotificationTransport['trigger']>(async () => ({}));
  const transport = fakeTransport(trigger);

  await emitRoadmapClassificationChange(
    notice,
    transport,
    async () => ['student-1'],
    'roadmap-classification-changed',
  );

  expect(transport.ensureSubscribers).toHaveBeenCalledExactlyOnceWith({
    eventId: notice.eventId,
    recipients: notice.recipients,
  });
  expect(trigger).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      workflowId: 'roadmap-classification-changed',
      transactionId: 'classification-event-1:classification-updated:0',
      recipients: ['student-1'],
      payload: expect.objectContaining({
        targetKind: 'roadmap',
        changeKind: 'classification-updated',
        noticeTitle: 'Tipo «Lectura» → «Lecturas guiadas»',
        noticeBody: expect.stringContaining('actualizó la clasificación'),
      }),
    }),
  );
  expect(trigger.mock.calls[0]?.[0].payload).not.toHaveProperty('nodeId');
});

test('rechecks active recipients on retries and keeps the same transaction identity', async () => {
  const trigger = vi
    .fn<NotificationTransport['trigger']>()
    .mockRejectedValueOnce(new NotificationTransportError('temporary failure', true))
    .mockResolvedValueOnce({});
  const findActiveRecipients = vi.fn(async () => ['student-1']);

  await emitRoadmapClassificationChange(
    notice,
    fakeTransport(trigger),
    findActiveRecipients,
    'roadmap-classification-changed',
  );

  expect(findActiveRecipients).toHaveBeenCalledTimes(2);
  expect(trigger).toHaveBeenCalledTimes(2);
  expect(trigger.mock.calls[0]?.[0].transactionId).toBe(trigger.mock.calls[1]?.[0].transactionId);
});
