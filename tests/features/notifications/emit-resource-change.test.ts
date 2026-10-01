import { expect, test, vi } from 'vitest';
import type {
  NotificationTransport,
  ResourceChangeNotice,
} from '@/features/notifications/contracts';
import { emitNodeScopedChange } from '@/features/notifications/application/emit-node-scoped-change';

const notice: ResourceChangeNotice = {
  eventId: 'resource-event-1',
  roadmapId: 'roadmap-1',
  courseOfferingId: 'offering-1',
  courseCode: 'CC3002',
  year: 2026,
  semester: 2,
  courseName: 'Diseño de software',
  nodeId: 'node-1',
  nodeTitle: 'Unidad 1',
  resourceTitle: 'Guía de ejercicios.pdf',
  changeKind: 'resource-removed',
  actorId: 'teacher-1',
  actorName: 'Docente A',
  occurredAt: new Date('2026-09-30T15:00:00.000Z'),
  recipients: [{ userId: 'student-1', name: 'Estudiante A' }],
};

test('emits a deleted Resource with its retained title and owning Node destination', async () => {
  const trigger = vi.fn<NotificationTransport['trigger']>(async () => ({}));
  const transport: NotificationTransport = {
    ensureSubscribers: vi.fn(async () => undefined),
    trigger,
  };

  await emitNodeScopedChange(
    notice,
    transport,
    async (ids) => [...ids],
    'roadmap-resource-changed',
  );

  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      workflowId: 'roadmap-resource-changed',
      payload: expect.objectContaining({
        targetKind: 'node',
        nodeId: 'node-1',
        changeKind: 'resource-removed',
        resourceTitle: 'Guía de ejercicios.pdf',
      }),
    }),
  );
  const payload = trigger.mock.calls[0]?.[0].payload;
  expect(Object.keys(payload ?? {}).sort()).toEqual(
    [
      'roadmapId',
      'courseCode',
      'year',
      'semester',
      'targetKind',
      'nodeId',
      'nodeTitle',
      'noticeTitle',
      'noticeBody',
      'changeKind',
      'occurredAt',
      'eventCount',
      'actorName',
      'resourceTitle',
    ].sort(),
  );
  expect(JSON.stringify(payload)).not.toMatch(/https?:|description|bytes/i);
});
