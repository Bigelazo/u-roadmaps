// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { prisma } from '@/shared/server/db';
import { subscribeToPostgresSignals } from '@/features/notifications/infrastructure/postgres-signals';

const listeners = vi.hoisted(() => new Map<string, (message: { payload?: string }) => void>());

vi.mock('pg', () => ({
  Client: class {
    on(event: string, listener: (message: { payload?: string }) => void) {
      listeners.set(event, listener);
    }
    async connect() {}
    async query() {}
    async end() {}
  },
}));
vi.mock('@/shared/server/db', () => ({
  prisma: { participation: { findMany: vi.fn() } },
}));

const findMany = vi.mocked(prisma.participation.findMany);
afterEach(() => vi.resetAllMocks());

function notify(change: object) {
  listeners.get('notification')!({ payload: JSON.stringify(change) });
}

test('a failed membership lookup disconnects only the streams waiting for it', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const member = { userId: 'member', receive: vi.fn(), disconnected: vi.fn() };
  const visitor = { userId: 'visitor', receive: vi.fn(), disconnected: vi.fn() };
  const unsubscribe = [
    await subscribeToPostgresSignals(member),
    await subscribeToPostgresSignals(visitor),
  ];
  findMany.mockResolvedValueOnce([{ userId: 'member', isActive: true }] as never);
  notify({ kind: 'roadmap', courseOfferingId: 'offering', userId: null });
  await vi.waitFor(() => expect(member.receive).toHaveBeenCalledTimes(1));

  findMany.mockRejectedValueOnce(new Error('lookup failed'));
  notify({ kind: 'roadmap', courseOfferingId: 'offering', userId: null });
  await vi.waitFor(() => expect(visitor.disconnected).toHaveBeenCalledTimes(1));

  expect(member.receive).toHaveBeenCalledTimes(2);
  expect(member.receive).toHaveBeenLastCalledWith({
    kind: 'roadmap',
    courseOfferingId: 'offering',
    userId: 'member',
  });
  expect(member.disconnected).not.toHaveBeenCalled();
  expect(visitor.receive).not.toHaveBeenCalled();
  for (const release of unsubscribe) release();
});
