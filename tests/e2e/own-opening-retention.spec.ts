import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';
import { insert, literal, literalList, queryJson, sql } from './database';

const openings = [
  {
    context: 'Roadmap',
    // Preparing a Roadmap entry captures notices without recognizing them.
    open: (student: APIRequestContext, course: E2EPrimaryCourseOffering) =>
      student.post('/api/notifications/openings', {
        data: { roadmapId: course.roadmapId, operationId: randomUUID() },
      }),
  },
];

for (const { context, open } of openings) {
  test(`${context} opening prunes expired recipient snapshots and expired retries recognize no notices`, async ({
    course,
    apiAs,
  }) => {
    const recipient = course.users.studentWithProgress;
    const other = course.users.studentWithoutProgress;
    const student = await apiAs(recipient);
    const teacher = await apiAs(course.users.teacher);
    expect(
      (
        await teacher.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
          data: { description: 'Aviso que nunca caduca por poda de aperturas' },
        })
      ).status(),
    ).toBe(200);
    const notices = () =>
      queryJson<unknown[]>(
        `SELECT coalesce(jsonb_agg(n ORDER BY n.id), '[]') FROM "RoadmapNotice" n WHERE "roadmapId" = ${literal(course.roadmapId)};`,
      );
    const before = await notices();
    expect(before.length).toBeGreaterThan(0);
    const expired = randomUUID();
    const expiredOtherRoadmap = randomUUID();
    const recent = randomUUID();
    const otherExpired = randomUUID();
    const ids = [expired, expiredOtherRoadmap, recent, otherExpired];
    await sql(
      insert('NoticeAcknowledgement', [
        {
          recipientId: recipient.id,
          operationId: expired,
          roadmapId: course.roadmapId,
          openedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
        {
          recipientId: recipient.id,
          operationId: expiredOtherRoadmap,
          roadmapId: randomUUID(),
          openedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
        {
          recipientId: recipient.id,
          operationId: recent,
          roadmapId: course.roadmapId,
          openedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        },
        {
          recipientId: other.id,
          operationId: otherExpired,
          roadmapId: course.roadmapId,
          openedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]),
    );
    expect((await open(student, course)).status()).toBe(200);
    const remaining = await queryJson<string[]>(
      `SELECT coalesce(jsonb_agg("operationId" ORDER BY "operationId"), '[]') FROM "NoticeAcknowledgement" WHERE "operationId" IN (${literalList(ids)});`,
    );
    expect(remaining.sort()).toEqual([recent, otherExpired].sort());
    expect(await notices()).toEqual(before);
    expect(
      (
        await student.post('/api/notifications/acknowledge', {
          data: { roadmapId: course.roadmapId, operationId: expired },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await student.post('/api/notifications/openings', {
          data: {
            roadmapId: course.roadmapId,
            operationId: expired,
            retry: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(await notices()).toEqual(before);
  });
}
