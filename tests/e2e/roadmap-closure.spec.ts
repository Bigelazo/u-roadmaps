import { expect, test } from './fixtures';
import { prepareNodeCreator } from './create-node';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { authenticateAs } from './helpers';

function dayOffset(days: number) {
  const day = new Date(`${chileCalendarDay()}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

test('Roadmap closure clears Teacher blocks and schedules without completing prerequisites', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
  page,
}) => {
  const term = await createTerm();
  const offering = await createCourse({
    ...term,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const { createNode } = await prepareNodeCreator(teacher, offering);
  const first = await createNode('Closure prerequisite', 0);
  const second = await createNode('Closure dependent', 200);
  expect(
    (
      await teacher.post(offering.apiPath('/dependencies'), {
        data: {
          sourceNodeId: first.id,
          targetNodeId: second.id,
        },
      })
    ).status(),
  ).toBe(201);
  expect((await teacher.post(offering.apiPath(`/nodes/${first.id}/teacher-block`))).status()).toBe(
    200,
  );
  expect(
    (
      await teacher.put(offering.apiPath(`/nodes/${second.id}/teacher-block/schedule`), {
        data: { unlockOn: dayOffset(1) },
      })
    ).status(),
  ).toBe(200);
  await term.setFreezeDate(dayOffset(-1));
  await waitForClosure(offering);
  const nodes = (await (await teacher.get(offering.apiPath())).json()).nodes;
  expect(
    nodes.every(
      (node: { isTeacherBlocked: boolean; teacherUnlockOn?: string }) =>
        !node.isTeacherBlocked && !node.teacherUnlockOn,
    ),
  ).toBe(true);
  const studentNodes = (await (await student.get(offering.apiPath())).json()).nodes;
  expect(studentNodes.find((node: { id: string }) => node.id === first.id).access).toEqual({
    status: 'ACCESSIBLE',
  });
  expect(studentNodes.find((node: { id: string }) => node.id === second.id).access).toEqual({
    status: 'BLOCKED',
    reason: 'PREREQUISITE_BLOCK',
  });
  const completion = await student.post(offering.apiPath(`/nodes/${first.id}/completion`));
  expect(completion.status()).toBe(403);
  expect((await completion.json()).error.code).toBe('ROADMAP_FROZEN');
  expect(studentNodes.find((node: { id: string }) => node.id === first.id).canComplete).toBe(false);
  expect((await teacher.delete(offering.apiPath('/simulation'))).status()).toBe(403);
  expect(
    (await teacher.post(offering.apiPath(`/simulation/nodes/${first.id}/completion`))).status(),
  ).toBe(403);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(page.getByRole('button', { name: 'Vista estudiante' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expect(page.getByRole('button', { name: 'Reiniciar progreso' })).toHaveCount(0);
});

for (const semester of [1, 2] as const)
  test(`a missing Academic term closes through the semester-${semester} fallback`, async ({
    course,
    createCourse,
    createTerm,
    waitForClosure,
    apiAs,
  }) => {
    const term = await createTerm(semester);
    await term.setFreezeDate(null);
    const offering = await createCourse({
      ...term,
      participants: [{ user: course.users.studentWithoutProgress, role: 'STUDENT' }],
    });
    const closedAt = await waitForClosure(offering);
    expect(closedAt).toBeTruthy();
    const student = await apiAs(course.users.studentWithoutProgress);
    const nodes = (await (await student.get(offering.apiPath())).json()).nodes;
    expect(
      nodes.some((node: { access: { reason?: string } }) => node.access.reason === 'TEACHER_BLOCK'),
    ).toBe(false);
    expect(nodes.some((node: { canComplete?: boolean }) => node.canComplete)).toBe(false);
  });

test('closure leaves pending notices untouched and repeated late passes preserve the recorded fact', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
}) => {
  const term = await createTerm();
  const offering = await createCourse({
    ...term,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const { createNode } = await prepareNodeCreator(teacher, offering);
  const node = await createNode('Pending before closure', 0);
  expect((await teacher.post(offering.apiPath(`/nodes/${node.id}/teacher-block`))).status()).toBe(
    200,
  );
  const notices = async () =>
    (await (await student.get(`/api/notifications?roadmapId=${offering.roadmapId}`)).json())
      .notifications;
  await expect
    .poll(async () =>
      (await notices()).some(
        (notice: { data: { nodeId?: string; nodeAccess?: string } }) =>
          notice.data.nodeId === node.id && notice.data.nodeAccess === 'Bloqueado',
      ),
    )
    .toBe(true);
  const pending = await notices();
  expect(pending.length).toBeGreaterThan(0);
  await term.setFreezeDate(dayOffset(-1));
  const closedAt = await waitForClosure(offering);
  expect(await notices()).toEqual(pending);
  // Another due Roadmap proves a subsequent pass ran; no fixed sleep.
  await term.setFreezeDate(dayOffset(-10));
  const later = await createCourse({ ...term });
  await waitForClosure(later);
  expect(await waitForClosure(offering)).toBe(closedAt);
  expect(await notices()).toEqual(pending);
});

test('the freeze date stays editable today and a failed closure is not a frozen Roadmap', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
  rejectClosure,
  page,
}) => {
  const term = await createTerm();
  await term.setFreezeDate(dayOffset(0));
  const offering = await createCourse({
    ...term,
    participants: [
      { user: course.users.teacher, role: 'TEACHER' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const rejection = await rejectClosure(offering);
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const { createNode } = await prepareNodeCreator(teacher, offering);
  const today = await createNode('Editable through today', 0);
  expect((await student.post(offering.apiPath(`/nodes/${today.id}/completion`))).status()).toBe(
    200,
  );
  const blocked = await createNode('Atomic closure keeps its blocks on failure', 400);
  expect(
    (await teacher.post(offering.apiPath(`/nodes/${blocked.id}/teacher-block`))).status(),
  ).toBe(200);
  expect(
    (
      await teacher.put(offering.apiPath(`/nodes/${blocked.id}/teacher-block/schedule`), {
        data: { unlockOn: dayOffset(1) },
      })
    ).status(),
  ).toBe(200);
  await term.setFreezeDate(dayOffset(-1));
  await expect.poll(rejection.wasAttempted).toBe(true);
  const blockedNode = (await (await teacher.get(offering.apiPath())).json()).nodes.find(
    (node: { id: string }) => node.id === blocked.id,
  );
  expect(blockedNode).toMatchObject({ isTeacherBlocked: true, teacherUnlockOn: dayOffset(1) });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toBeVisible();
  const past = await createNode('Editable until closure is recorded', 200);
  expect((await student.post(offering.apiPath(`/nodes/${past.id}/completion`))).status()).toBe(200);
  expect((await teacher.delete(offering.apiPath('/simulation'))).status()).toBe(200);
  await rejection.resume();
  await waitForClosure(offering);
});
