import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { novu } = vi.hoisted(() => ({
  novu: { trigger: vi.fn(), subscribers: { createBulk: vi.fn() } },
}));

vi.mock('server-only', () => ({}));
vi.mock('@novu/api', () => ({
  Novu: vi.fn(function MockNovu() {
    return novu;
  }),
}));

import { novuTransport } from '@/features/notifications/infrastructure/novu-transport';

beforeEach(() => {
  process.env.NOVU_SECRET_KEY = 'test-secret';
  novu.trigger.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NOVU_SECRET_KEY;
});

test('uses one composite Node key across authors and keeps workflow classes in separate buckets', async () => {
  const payload = {
    roadmapId: 'roadmap-a',
    courseCode: 'CC1001',
    year: 2026,
    semester: 2,
    nodeId: 'node-a',
    changeKind: 'node-updated',
    actorName: 'Ana Pérez',
  };

  await novuTransport.trigger({
    workflowId: 'roadmap-node-changed',
    roadmapId: 'roadmap-a',
    eventId: 'event-a',
    transactionId: 'transaction-a',
    recipients: ['subscriber-a'],
    payload,
  });
  await novuTransport.trigger({
    workflowId: 'roadmap-resource-changed',
    roadmapId: 'roadmap-a',
    eventId: 'event-b',
    transactionId: 'transaction-b',
    recipients: ['subscriber-a'],
    payload: { ...payload, changeKind: 'resource-added', actorName: 'Luis Soto' },
  });

  expect(novu.trigger).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      workflowId: 'roadmap-node-changed',
      payload: expect.objectContaining({ digestKey: 'roadmap:roadmap-a:node:node-a' }),
    }),
    'transaction-a',
    { timeoutMs: 3_000 },
  );
  expect(novu.trigger).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      workflowId: 'roadmap-resource-changed',
      payload: expect.objectContaining({ digestKey: 'roadmap:roadmap-a:node:node-a' }),
    }),
    'transaction-b',
    { timeoutMs: 3_000 },
  );
});

test('uses a Roadmap-only key for general changes and separates Courses through Roadmap identity', async () => {
  for (const [roadmapId, workflowId] of [
    ['roadmap-a', 'roadmap-path-changed'],
    ['roadmap-b', 'roadmap-classification-changed'],
  ]) {
    await novuTransport.trigger({
      workflowId,
      roadmapId,
      eventId: `event-${roadmapId}`,
      transactionId: `transaction-${roadmapId}`,
      recipients: ['subscriber-a'],
      payload: {
        roadmapId,
        courseCode: roadmapId === 'roadmap-a' ? 'CC1001' : 'CC2002',
        year: 2026,
        semester: 2,
        targetKind: 'roadmap',
        changeKind: 'dependency-added',
        actorName: 'Docente A',
      },
    });
  }

  expect(novu.trigger).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      payload: expect.objectContaining({ digestKey: 'roadmap:roadmap-a:general' }),
    }),
    'transaction-roadmap-a',
    { timeoutMs: 3_000 },
  );
  expect(novu.trigger).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      payload: expect.objectContaining({ digestKey: 'roadmap:roadmap-b:general' }),
    }),
    'transaction-roadmap-b',
    { timeoutMs: 3_000 },
  );
});
