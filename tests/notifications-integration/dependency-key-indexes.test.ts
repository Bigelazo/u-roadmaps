import { expect, test } from 'vitest';
import { prisma } from '@/shared/server/db';
import {
  DEPENDENCY_ENDS,
  dependencyIndexPredicate,
  dependencyKeyNode,
} from '@/features/notifications/infrastructure/notice-lifecycle/known-values';
import { dependencyTarget } from '@/shared/route-notice-target';

const roadmapId = '00000000-0000-4000-8000-000000000001';
const [source, target] = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

test.for(DEPENDENCY_ENDS)(
  'the %s end of a Dependency pair key matches its partial expression index',
  async (end) => {
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SET LOCAL enable_seqscan = off`;
      const rows = await transaction.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN SELECT 1 FROM "NoticeKnownValue"
        WHERE "roadmapId" = ${roadmapId}::uuid AND ${dependencyIndexPredicate}
          AND ${dependencyKeyNode(end)} = ${end === 'source' ? source : target}`;
      return rows.map((row) => row['QUERY PLAN']).join('\n');
    });
    // The key part is an index condition only on an index built on that exact expression
    // and predicate. The index name is not asserted: on a near-empty table the planner
    // may cost the other end's index (same roadmapId prefix) equally.
    const part = end === 'source' ? 2 : 3;
    expect(plan).toMatch(
      new RegExp(`Index Cond: .*split_part\\("targetKey", ':'::text, ${part}\\)`),
    );
  },
);

test.for(DEPENDENCY_ENDS)('the %s end reads its Node from the key', async (end) => {
  const [{ node }] = await prisma.$queryRaw<{ node: string }[]>`
    SELECT ${dependencyKeyNode(end)} AS node
    FROM (SELECT ${dependencyTarget(source, target)}::text AS "targetKey") AS key`;
  expect(node).toBe(end === 'source' ? source : target);
});
