import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect } from 'vitest';
import { test } from './fixtures';
import { integrationClient, integrationDatabaseUrl } from './database';
import { pendingNotices, teacherEdits } from './roadmap';
import { prisma } from '@/shared/server/db';

const MIGRATION = 'prisma/migrations/20261017120000_delete_target_less_notices/migration.sql';

test('the migration deletes target-less notices and keeps lifecycle notices', async ({
  course,
}) => {
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  const [lifecycle] = await pendingNotices(course.studentId, course.roadmapId);
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
    select: { id: true },
  });
  const targetLess = randomUUID();
  await prisma.roadmapNotice.create({
    data: {
      id: targetLess,
      eventId: randomUUID(),
      recipientId: course.studentId,
      roadmapId: course.roadmapId,
      courseOfferingId: offering.id,
      subject: 'Aviso histórico',
      body: 'Aviso histórico',
      data: { ...course.identifier, nodeId: course.change.nodeId, changeKind: 'node-updated' },
      occurredAt: new Date(),
    },
  });
  await prisma.$executeRaw`UPDATE "RoadmapNotice" SET data = data || jsonb_build_object(
    'changeKind', 'node-updated', 'changedFields', '["title"]'::jsonb, 'targetKind', 'node')
    WHERE id = ${lifecycle.id}::uuid`;

  const client = integrationClient(integrationDatabaseUrl());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(MIGRATION, 'utf8'));
    const { rows } = await client.query(
      'SELECT id, data FROM "RoadmapNotice" WHERE id = ANY($1::uuid[])',
      [[lifecycle.id, targetLess]],
    );
    expect(rows).toEqual([
      {
        id: lifecycle.id,
        data: expect.objectContaining({ noticeTarget: 'node-title', currentValue: 'Recursión' }),
      },
    ]);
    for (const key of ['changeKind', 'changedFields', 'targetKind'])
      expect(rows[0].data).not.toHaveProperty(key);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});
