import { expect, test, vi } from 'vitest';
import {
  NotificationTransportError,
  type NotificationTransport,
  type RoadmapAvailabilityNotice,
} from '@/features/notifications/contracts';
import { emitRoadmapAvailability } from '@/features/notifications/application/emit-roadmap-availability';

function notice(recipientCount = 2): RoadmapAvailabilityNotice {
  return {
    eventId: 'roadmap-1',
    roadmapId: 'roadmap-1',
    courseOfferingId: 'offering-1',
    courseCode: 'INFO100',
    year: 2026,
    semester: 2,
    courseName: 'Introducción a la informática',
    actorId: 'teacher-1',
    actorName: 'Docente A',
    occurredAt: new Date('2026-09-30T15:00:00.000Z'),
    recipients: Array.from({ length: recipientCount }, (_, index) => ({
      userId: `student-${index}`,
      name: `Estudiante ${index}`,
    })),
  };
}

function fakeTransport(trigger: NotificationTransport['trigger']): NotificationTransport {
  return {
    ensureSubscribers: vi.fn(async () => undefined),
    trigger,
  };
}

test('provisions active participants and sends the contracted scalar payload after filtering inactive users', async () => {
  const trigger = vi.fn<NotificationTransport['trigger']>(async () => ({}));
  const transport = fakeTransport(trigger);
  const lookup = vi.fn(async () => ['student-0']);

  await emitRoadmapAvailability(notice(), transport, lookup, 'roadmap-available');

  expect(transport.ensureSubscribers).toHaveBeenCalledOnce();
  expect(lookup).toHaveBeenCalledWith(['student-0', 'student-1']);
  expect(trigger).toHaveBeenCalledOnce();
  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      workflowId: 'roadmap-available',
      transactionId: 'roadmap-1:roadmap-available:0',
      recipients: ['student-0'],
      payload: expect.objectContaining({
        roadmapId: 'roadmap-1',
        changeKind: 'roadmap-available',
        eventCount: 1,
      }),
    }),
  );
  expect(Object.keys(trigger.mock.calls[0]?.[0].payload ?? {})).toHaveLength(9);
});

test('rechecks active membership before a retry and reuses the same idempotency key', async () => {
  const trigger = vi
    .fn<NotificationTransport['trigger']>()
    .mockRejectedValueOnce(new NotificationTransportError('temporary failure', true))
    .mockResolvedValueOnce({});
  const lookup = vi.fn(async () => ['student-0']);

  await emitRoadmapAvailability(notice(1), fakeTransport(trigger), lookup, 'roadmap-available');

  expect(lookup).toHaveBeenCalledTimes(2);
  expect(trigger).toHaveBeenCalledTimes(2);
  expect(trigger.mock.calls[0][0].transactionId).toBe(trigger.mock.calls[1][0].transactionId);
});

test('splits fan-out into Novu recipient limits and omits the trigger when everyone is inactive', async () => {
  const trigger = vi.fn(async () => ({}));
  const transport = fakeTransport(trigger);
  const lookup = vi.fn(async () => []);

  await emitRoadmapAvailability(notice(101), transport, lookup, 'roadmap-available');

  expect(transport.ensureSubscribers).toHaveBeenCalledTimes(1);
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(trigger).not.toHaveBeenCalled();
});

test('keeps each Novu trigger within its 100-recipient API limit', async () => {
  const trigger = vi.fn<NotificationTransport['trigger']>(async () => ({}));
  const lookup = vi.fn(async (userIds: readonly string[]) => [...userIds]);

  await emitRoadmapAvailability(notice(101), fakeTransport(trigger), lookup, 'roadmap-available');

  expect(trigger).toHaveBeenCalledTimes(2);
  expect(trigger.mock.calls.map(([input]) => input.recipients.length)).toEqual([100, 1]);
  expect(trigger.mock.calls[0]?.[0].transactionId).not.toBe(
    trigger.mock.calls[1]?.[0].transactionId,
  );
});
