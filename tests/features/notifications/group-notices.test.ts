import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  createNoticeGrouper,
  type NoticeEffect,
  type NoticeClass,
} from '@/features/notifications/application/group-notices';
import { projectDigestNotification } from '@/features/notifications/digest-projection';
import examples from './fixtures/digest-examples.json';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T09:00:00Z'));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function inbox() {
  const receipts = new Set<string>();
  const notices: Array<NoticeEffect & ReturnType<typeof projectDigestNotification>> = [];
  const failed = vi.fn();
  const grouper = createNoticeGrouper({
    accept: async (effect, immediate) => {
      const key = `${effect.recipientId}:${effect.eventId}`;
      if (receipts.has(key)) return false;
      receipts.add(key);
      if (immediate) notices.push({ ...effect, ...projectDigestNotification(effect.payload, []) });
      return true;
    },
    publish: async (effect, projection) => {
      notices.push({ ...effect, ...projection });
    },
    failed,
  });
  return { ...grouper, notices, failed };
}

function effect(eventId: string, overrides: Partial<NoticeEffect> = {}): NoticeEffect {
  return {
    eventId,
    recipientId: 'student-a',
    roadmapId: 'roadmap-a',
    courseOfferingId: 'offering-a',
    noticeClass: 'roadmap-node-changed',
    payload: {
      roadmapId: 'roadmap-a',
      courseCode: 'CC1001',
      year: 2026,
      semester: 2,
      nodeId: 'node-a',
      nodeTitle: 'Unidad 1',
      targetKind: 'node',
      changeKind: 'node-updated',
      actorId: 'ana',
      actorName: 'Ana Pérez',
      occurredAt: new Date().toISOString(),
      eventCount: 1,
      digestKey: 'node-a',
      noticeBody: 'Ana Pérez actualizó Unidad 1.',
    },
    ...overrides,
  };
}

test('delivers the first notice immediately and a separate immutable summary at 60 seconds without another request', async () => {
  const delivery = inbox();
  await delivery.deliver(effect('first'));
  const first = structuredClone(delivery.notices[0]);
  await vi.advanceTimersByTimeAsync(10_000);
  await delivery.deliver(effect('repeat-a'));
  await vi.advanceTimersByTimeAsync(20_000);
  await delivery.deliver(effect('repeat-b'));
  await vi.advanceTimersByTimeAsync(29_999);
  expect(delivery.notices).toEqual([first]);
  await vi.advanceTimersByTimeAsync(1);
  expect(delivery.notices).toHaveLength(2);
  expect(delivery.notices[0]).toEqual(first);
  expect(delivery.notices[1]).toMatchObject({
    subject: 'Resumen de cambios · Nodo «Unidad 1»',
    data: { eventCount: 2, occurredAt: '2026-09-30T09:00:30.000Z' },
  });
});

test('duplicates and concurrent delivery do not inflate counts, including after the window closes', async () => {
  const delivery = inbox();
  await Promise.all([delivery.deliver(effect('first')), delivery.deliver(effect('first'))]);
  await Promise.all([delivery.deliver(effect('repeat')), delivery.deliver(effect('repeat'))]);
  await vi.advanceTimersByTimeAsync(60_000);
  await delivery.deliver(effect('first'));
  await delivery.deliver(effect('repeat'));
  expect(delivery.notices).toHaveLength(2);
  expect(delivery.notices[1].data.eventCount).toBe(1);
  await delivery.deliver(effect('new-window'));
  expect(delivery.notices).toHaveLength(3);
});

test('separates recipient, Roadmap, Node and class, and keeps general Roadmap scope separate', async () => {
  const delivery = inbox();
  const variants = [
    effect('first'),
    effect('first', { recipientId: 'student-b' }),
    effect('first', {
      roadmapId: 'roadmap-b',
      payload: { ...effect('x').payload, roadmapId: 'roadmap-b' },
    }),
    effect('first', { payload: { ...effect('x').payload, nodeId: 'node-b' } }),
    effect('first', { noticeClass: 'roadmap-resource-changed' }),
    effect('first', {
      payload: { ...effect('x').payload, nodeId: undefined, targetKind: 'roadmap' },
    }),
  ];
  // Effect identity is recipient + event, independently of its grouping key.
  for (const [index, variant] of variants.entries()) {
    await delivery.deliver({ ...variant, eventId: `first-${index}` });
    await delivery.deliver({ ...variant, eventId: `repeat-${index}` });
  }
  expect(delivery.notices).toHaveLength(6);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(delivery.notices).toHaveLength(12);
  expect(delivery.notices.slice(6).map(({ data }) => data.eventCount)).toEqual([1, 1, 1, 1, 1, 1]);
});

test.each(examples.cases)(
  'reuses the documented $workflowId summary with multiple authors and latest effective context',
  async (example) => {
    const delivery = inbox();
    const noticeClass = example.noticeClass as NoticeClass;
    await delivery.deliver(
      effect('first', { noticeClass, payload: example.digestEvents[0].payload }),
    );
    // Arrive out of order: the latest effective change still supplies the context.
    for (const repeat of [...example.digestEvents].reverse())
      await delivery.deliver(effect(repeat.id, { noticeClass, payload: repeat.payload }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(delivery.notices).toHaveLength(2);
    expect(delivery.notices[1]).toMatchObject(example.expectedProjection);
  },
);

test('retains the full latest context beyond Novu string limits', async () => {
  const delivery = inbox();
  await delivery.deliver(effect('first'));
  await delivery.deliver(
    effect('repeat', { payload: { ...effect('x').payload, noticeBody: 'Detalle '.repeat(80) } }),
  );
  await vi.advanceTimersByTimeAsync(60_000);
  expect(delivery.notices[1].body).toBe(
    `Se agruparon 1 cambio. Último cambio: ${'Detalle '.repeat(80)}`,
  );
});

test('a failed summary cannot prevent immediate delivery in the next window', async () => {
  const accepted: string[] = [];
  const failure = new Error('Database unavailable during summary publication');
  const failed = vi.fn();
  const delivery = createNoticeGrouper({
    accept: async (notice, immediate) => {
      if (immediate) accepted.push(notice.eventId);
      return true;
    },
    publish: async () => {
      throw failure;
    },
    failed,
  });
  await delivery.deliver(effect('first'));
  await delivery.deliver(effect('repeat'));
  // A busy event loop can receive a request before the overdue timer runs.
  vi.setSystemTime(new Date('2026-09-30T09:01:01Z'));
  await delivery.deliver(effect('next-window'));
  expect(accepted).toEqual(['first', 'next-window']);
  expect(failed).toHaveBeenCalledWith(failure);
});

test('a summary retains the latest repetition even when the first change has a later effective time', async () => {
  const delivery = inbox();
  await delivery.deliver(
    effect('first', {
      payload: { ...effect('x').payload, occurredAt: '2026-09-30T09:00:30Z' },
    }),
  );
  await delivery.deliver(
    effect('repeat', {
      payload: {
        ...effect('x').payload,
        occurredAt: '2026-09-30T09:00:10Z',
        actorName: 'Beatriz Soto',
        nodeTitle: 'Contexto de la repetición',
      },
    }),
  );
  await vi.advanceTimersByTimeAsync(60_000);
  expect(delivery.notices[1]).toMatchObject({
    subject: 'Resumen de cambios · Nodo «Contexto de la repetición»',
    data: { eventCount: 1, actorName: 'Beatriz Soto', occurredAt: '2026-09-30T09:00:10.000Z' },
  });
});

test('a window with no repetitions publishes no summary', async () => {
  const delivery = inbox();
  await delivery.deliver(effect('first'));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(delivery.notices).toHaveLength(1);
  await delivery.deliver(effect('next'));
  expect(delivery.notices).toHaveLength(2);
});
