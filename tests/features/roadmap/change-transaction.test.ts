import { expect, test, vi } from 'vitest';
const { prisma } = vi.hoisted(() => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('@/shared/server/db', () => ({ prisma }));
import { roadmapChangeTransaction } from '@/features/roadmap/application/change-transaction';

test('reports inside the transaction and releases delivery only after commit', async () => {
  const order: string[] = [];
  const transaction = {};
  prisma.$transaction.mockImplementation(async (operation) => {
    const result = await operation(transaction);
    order.push('commit');
    return result;
  });
  const port = {
    report: async (tx: unknown) => {
      expect(tx).toBe(transaction);
      order.push('report');
      return () => {
        order.push('delivery');
      };
    },
  };
  await roadmapChangeTransaction(port, async (tx, report) => {
    await report({
      actorId: 'teacher',
      roadmapId: 'roadmap',
      identifier: { courseCode: 'CC1002', year: 2026, semester: 2 },
      facts: [],
    });
    order.push('mutation');
    return 'confirmed';
  });
  expect(order).toEqual(['report', 'mutation', 'commit', 'delivery']);
});

test('a failed commit discards delivery', async () => {
  const delivered = vi.fn();
  prisma.$transaction.mockImplementation(async (operation) => {
    await operation({});
    throw new Error('serialization conflict');
  });
  await expect(
    roadmapChangeTransaction({ report: async () => delivered }, async (_tx, report) => {
      await report({
        actorId: 'teacher',
        roadmapId: 'roadmap',
        identifier: { courseCode: 'CC1002', year: 2026, semester: 2 },
        facts: [],
      });
    }),
  ).rejects.toThrow('serialization conflict');
  expect(delivered).not.toHaveBeenCalled();
});
