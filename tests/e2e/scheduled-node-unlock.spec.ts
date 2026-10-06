import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';
import { literal, queryJson, sql } from './database';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

function chileDayOffset(days: number) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Simulates the scheduled day arriving without waiting for the calendar. */
async function moveScheduleToYesterday(nodeId: string) {
  await sql(
    `UPDATE "RoadmapNode" SET "teacherUnlockOn" = ${literal(chileDayOffset(-1))}::date WHERE id = ${literal(nodeId)};`,
  );
}

test('a scheduled unlock waits for blocked prerequisites and releases on its day', async ({
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const { createNode } = await prepareNodeCreator(teacher, course);
  const prerequisite = await createNode(uniqueName('Prerrequisito'), 0);
  const scheduled = await createNode(uniqueName('Programado'), 200);
  const standalone = await createNode(uniqueName('Independiente'), 400);
  const schedulePath = (nodeId: string) =>
    course.apiPath(`/nodes/${nodeId}/teacher-block/schedule`);
  const studentAccess = async (nodeId: string) =>
    (await (await student.get(course.apiPath())).json()).nodes.find(
      (node: { id: string }) => node.id === nodeId,
    ).access;

  expect(
    (
      await teacher.post(course.apiPath('/dependencies'), {
        data: { sourceNodeId: prerequisite.id, targetNodeId: scheduled.id },
      })
    ).status(),
  ).toBe(201);

  // A schedule needs a Teacher block and a future day.
  const unblocked = await teacher.put(schedulePath(standalone.id), {
    data: { unlockOn: chileDayOffset(1) },
  });
  expect(unblocked.status()).toBe(409);
  expect((await unblocked.json()).error.code).toBe('TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK');

  for (const node of [prerequisite, standalone]) {
    expect((await teacher.post(course.apiPath(`/nodes/${node.id}/teacher-block`))).status()).toBe(
      200,
    );
  }
  const today = await teacher.put(schedulePath(scheduled.id), {
    data: { unlockOn: chileDayOffset(0) },
  });
  expect(today.status()).toBe(400);

  const tomorrow = chileDayOffset(1);
  const saved = await teacher.put(schedulePath(scheduled.id), { data: { unlockOn: tomorrow } });
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toEqual({ teacherUnlockOn: tomorrow });
  const teacherView = await (await teacher.get(course.apiPath())).json();
  expect(teacherView.nodes.find((node: { id: string }) => node.id === scheduled.id)).toMatchObject({
    isTeacherBlocked: true,
    teacherUnlockOn: tomorrow,
  });

  expect(
    (await teacher.put(schedulePath(standalone.id), { data: { unlockOn: tomorrow } })).status(),
  ).toBe(200);

  // Both days arrive. The E2E server checks every second (SCHEDULED_UNLOCK_INTERVAL_MS):
  // the free node is released and notified, while the one behind a blocked prerequisite waits.
  await moveScheduleToYesterday(scheduled.id);
  await moveScheduleToYesterday(standalone.id);
  await expect
    .poll(() => studentAccess(standalone.id), { timeout: 15_000 })
    .toEqual({ status: 'ACCESSIBLE' });
  expect(await studentAccess(scheduled.id)).toEqual({
    status: 'BLOCKED',
    reason: 'TEACHER_BLOCK',
  });
  // The release is stored immediately (no grouping window, see ADR-0014);
  // its latest change is attributed to teaching staff.
  await expect
    .poll(
      () =>
        queryJson<{ changeKind: string; actorName: string } | null>(
          `SELECT json_build_object('changeKind', data->>'changeKind', 'actorName', data->>'actorName')
           FROM "RoadmapNotice"
           WHERE "recipientId" = ${literal(course.users.studentWithoutProgress.id)}
             AND data->>'nodeId' = ${literal(standalone.id)}
           ORDER BY "occurredAt" DESC, id DESC
           LIMIT 1;`,
        ),
      { timeout: 15_000, intervals: [1_000] },
    )
    .toEqual({ changeKind: 'node-available', actorName: 'Equipo docente' });

  // Unlocking the prerequisite releases the overdue schedule in the same operation.
  const preview = await (
    await teacher.get(course.apiPath(`/nodes/${prerequisite.id}/teacher-block?operation=UNBLOCK`))
  ).json();
  expect(
    (
      await teacher.delete(course.apiPath(`/nodes/${prerequisite.id}/teacher-block`), {
        headers: { 'x-teacher-block-preview': preview.version },
      })
    ).status(),
  ).toBe(200);
  // Only the student's own pending prerequisite remains.
  expect(await studentAccess(scheduled.id)).toEqual({
    status: 'BLOCKED',
    reason: 'PREREQUISITE_BLOCK',
  });
  const released = (await (await teacher.get(course.apiPath())).json()).nodes.find(
    (node: { id: string }) => node.id === scheduled.id,
  );
  expect(released.isTeacherBlocked).toBe(false);
  expect(released).not.toHaveProperty('teacherUnlockOn');
});
