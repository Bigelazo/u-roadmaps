import { expect, test, vi } from 'vitest';
import {
  NotificationTransportError,
  type NotificationTransport,
  type RoadmapPathChangeNotice,
} from '@/features/notifications/contracts';
import { emitRoadmapPathChange } from '@/features/notifications/application/emit-roadmap-path-change';

const notice: RoadmapPathChangeNotice = {
  eventId: 'path-event-1',
  roadmapId: 'roadmap-1',
  courseOfferingId: 'offering-1',
  courseCode: 'CC3002',
  year: 2026,
  semester: 2,
  changeKind: 'dependency-added',
  dependentNodeTitle: 'Evaluación 1',
  prerequisiteNodeTitle: 'Leyes de Newton',
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

test('sends the route change to active recipients with a Roadmap destination and human-readable dependency', async () => {
  const trigger = vi.fn<NotificationTransport['trigger']>(async () => ({}));
  const transport = fakeTransport(trigger);

  await emitRoadmapPathChange(notice, transport, async () => ['student-1'], 'roadmap-path-changed');

  expect(transport.ensureSubscribers).toHaveBeenCalledWith({
    eventId: 'path-event-1',
    recipients: notice.recipients,
  });
  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      workflowId: 'roadmap-path-changed',
      transactionId: 'path-event-1:dependency-added:0',
      recipients: ['student-1'],
      payload: expect.objectContaining({
        targetKind: 'roadmap',
        changeKind: 'dependency-added',
        noticeTitle: 'Ruta actualizada',
        noticeBody: expect.stringContaining('«Evaluación 1» ahora requiere «Leyes de Newton»'),
      }),
    }),
  );
  expect(trigger.mock.calls[0]?.[0].payload).not.toHaveProperty('nodeId');
});

test('removal uses the inverse route wording and rechecks active membership on retry', async () => {
  const trigger = vi
    .fn<NotificationTransport['trigger']>()
    .mockRejectedValueOnce(new NotificationTransportError('temporary failure', true))
    .mockResolvedValueOnce({});
  const findActiveRecipients = vi.fn(async () => ['student-1']);

  await emitRoadmapPathChange(
    { ...notice, changeKind: 'dependency-removed' },
    fakeTransport(trigger),
    findActiveRecipients,
    'roadmap-path-changed',
  );

  expect(findActiveRecipients).toHaveBeenCalledTimes(2);
  expect(trigger).toHaveBeenCalledTimes(2);
  expect(trigger.mock.calls[0]?.[0].transactionId).toBe(trigger.mock.calls[1]?.[0].transactionId);
  expect(trigger.mock.calls[0]?.[0].payload.noticeBody).toContain(
    '«Evaluación 1» ya no requiere «Leyes de Newton»',
  );
});
