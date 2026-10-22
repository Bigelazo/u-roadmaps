import { expect, test } from './fixtures';
import { ok } from './helpers';
import { createDependency, prepareNodeCreator } from './create-node';
import { literal, sql } from './database';
import { changeTeacherBlock } from './previewed-writes';

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

async function moveScheduleToYesterday(nodeId: string) {
  await sql(
    `UPDATE "RoadmapNode" SET "teacherUnlockOn" = ${literal(chileDayOffset(-1))}::date WHERE id = ${literal(nodeId)};`,
  );
}

test('a scheduled unlock waits for blocked prerequisites and releases on its day', async ({
  course,
  teacherApi: teacher,
  studentApi: student,
}) => {
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

  await createDependency(teacher, course, prerequisite.id, scheduled.id);

  const unblocked = await teacher.put(schedulePath(standalone.id), {
    data: { unlockOn: chileDayOffset(1) },
  });
  await ok(unblocked, 409);
  expect((await unblocked.json()).error.code).toBe('TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK');

  for (const node of [prerequisite, standalone]) {
    await ok(await changeTeacherBlock(teacher, course.apiPath(`/nodes/${node.id}`)));
  }
  await ok(
    await teacher.put(schedulePath(scheduled.id), {
      data: { unlockOn: chileDayOffset(0) },
    }),
    400,
  );

  const tomorrow = chileDayOffset(1);
  const saved = await teacher.put(schedulePath(scheduled.id), { data: { unlockOn: tomorrow } });
  await ok(saved);
  expect(await saved.json()).toEqual({ teacherUnlockOn: tomorrow });
  const teacherView = await (await teacher.get(course.apiPath())).json();
  expect(teacherView.nodes.find((node: { id: string }) => node.id === scheduled.id)).toMatchObject({
    isTeacherBlocked: true,
    teacherUnlockOn: tomorrow,
  });

  await ok(await teacher.put(schedulePath(standalone.id), { data: { unlockOn: tomorrow } }));

  const opening = { roadmapId: course.roadmapId, operationId: crypto.randomUUID() };
  await expect
    .poll(async () =>
      (
        await (await student.get(`/api/notifications?nodeId=${standalone.id}`)).json()
      ).notifications.some(
        (notice: { data: { noticeTarget?: string; nodeAccess?: string } }) =>
          notice.data.noticeTarget === 'node-creation' && notice.data.nodeAccess === 'Bloqueado',
      ),
    )
    .toBe(true);
  await ok(await student.post('/api/notifications/openings', { data: opening }));
  await ok(await student.post('/api/notifications/acknowledge', { data: opening }));

  await moveScheduleToYesterday(scheduled.id);
  await moveScheduleToYesterday(standalone.id);
  await expect
    .poll(() => studentAccess(standalone.id), { timeout: 15_000 })
    .toEqual({ status: 'ACCESSIBLE' });
  expect(await studentAccess(scheduled.id)).toEqual({
    status: 'BLOCKED',
    reason: 'TEACHER_BLOCK',
  });
  await expect
    .poll(
      async () =>
        (
          await (await student.get(`/api/notifications?nodeId=${standalone.id}`)).json()
        ).notifications.map(({ data }: { data: Record<string, unknown> }) => ({
          noticeTarget: data.noticeTarget,
          currentValue: data.currentValue,
          actorName: data.actorName,
        })),
      { timeout: 15_000, intervals: [1_000] },
    )
    .toEqual([
      { noticeTarget: 'node-access', currentValue: 'Disponible', actorName: 'Equipo docente' },
    ]);

  await ok(
    await changeTeacherBlock(teacher, course.apiPath(`/nodes/${prerequisite.id}`), 'UNBLOCK'),
  );
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
