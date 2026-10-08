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
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(offering.pagePath());
  await page.locator(`.react-flow__node[data-id="${first.id}"]`).click();
  await expect(page.getByText('Closure prerequisite', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completar', exact: true })).toHaveCount(0);
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

test('closed Roadmaps refuse teaching edits with a clear closure error', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
}) => {
  const term = await createTerm();
  const offering = await createCourse({
    ...term,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  const teacher = await apiAs(course.users.teacher);
  const { createNode, nodeTypeId } = await prepareNodeCreator(teacher, offering);
  const node = await createNode('Final title', 0);
  const second = await createNode('Final dependent', 200);
  const dependencyResponse = await teacher.post(offering.apiPath('/dependencies'), {
    data: { sourceNodeId: node.id, targetNodeId: second.id },
  });
  expect(dependencyResponse.status()).toBe(201);
  const dependency = (await dependencyResponse.json()).dependency;
  const resourceResponse = await teacher.post(offering.apiPath(`/nodes/${node.id}/resources`), {
    data: { title: 'Final resource', url: 'https://example.com/final', type: 'LINK' },
  });
  expect(resourceResponse.status()).toBe(201);
  const resource = (await resourceResponse.json()).resource;
  const typeResponse = await teacher.post(offering.apiPath('/node-types'), {
    data: { name: 'Final type', icon: 'Shapes', color: '#024AD8' },
  });
  expect(typeResponse.status()).toBe(201);
  const customType = (await typeResponse.json()).nodeType;
  const before = await (await teacher.get(offering.apiPath())).json();
  await term.setFreezeDate(dayOffset(-1));
  await waitForClosure(offering);
  const response = await teacher.patch(offering.apiPath(`/nodes/${node.id}`), {
    data: { title: 'Forbidden edit' },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toEqual({
    code: 'ROADMAP_CLOSED',
    message: 'Este roadmap está cerrado y es de sólo lectura.',
  });
  const mutations = [
    {
      method: 'POST',
      suffix: '/nodes',
      data: { title: 'Late node', nodeTypeId, positionX: 0, positionY: 0 },
    },
    { method: 'PATCH', suffix: `/nodes/${node.id}`, data: { positionX: 300, positionY: 300 } },
    { method: 'PATCH', suffix: `/nodes/${node.id}`, data: { isVisible: false } },
    { method: 'DELETE', suffix: `/nodes/${node.id}` },
    {
      method: 'POST',
      suffix: '/dependencies',
      data: { sourceNodeId: second.id, targetNodeId: node.id },
    },
    { method: 'DELETE', suffix: `/dependencies/${dependency.id}` },
    { method: 'POST', suffix: `/nodes/${node.id}/teacher-block` },
    { method: 'DELETE', suffix: `/nodes/${node.id}/teacher-block` },
    { method: 'PATCH', suffix: `/nodes/${node.id}/teacher-block` },
    {
      method: 'PUT',
      suffix: `/nodes/${node.id}/teacher-block/schedule`,
      data: { unlockOn: dayOffset(1) },
    },
    { method: 'DELETE', suffix: `/nodes/${node.id}/teacher-block/schedule` },
    {
      method: 'POST',
      suffix: '/node-types',
      data: { name: 'Late type', icon: 'Shapes', color: '#024AD8' },
    },
    { method: 'PATCH', suffix: `/node-types/${customType.id}`, data: { name: 'Late rename' } },
    { method: 'DELETE', suffix: `/node-types/${customType.id}` },
    {
      method: 'POST',
      suffix: `/nodes/${node.id}/resources`,
      data: { title: 'Late resource', url: 'https://example.com/late', type: 'LINK' },
    },
    { method: 'PATCH', suffix: `/resources/${resource.id}`, data: { title: 'Late resource' } },
    { method: 'DELETE', suffix: `/resources/${resource.id}` },
  ];
  for (const { suffix, ...options } of mutations) {
    const refused = await teacher.fetch(offering.apiPath(suffix), options);
    expect(refused.status(), suffix).toBe(409);
    expect((await refused.json()).error.code, suffix).toBe('ROADMAP_CLOSED');
  }
  const upload = await teacher.post(offering.apiPath(`/nodes/${node.id}/resources`), {
    multipart: {
      file: { name: 'late.txt', mimeType: 'text/plain', buffer: Buffer.from('late content') },
    },
  });
  expect(upload.status()).toBe(409);
  expect((await upload.json()).error.code).toBe('ROADMAP_CLOSED');
  const after = await (await teacher.get(offering.apiPath())).json();
  expect(after.nodes).toEqual(before.nodes);
  expect(after.nodeTypes).toEqual(before.nodeTypes);
  expect(after.dependencies).toEqual(before.dependencies);
  const nodes = after.nodes;
  expect(nodes.find((item: { id: string }) => item.id === node.id).title).toBe('Final title');
});

test('Roadmap creation remains allowed through the freeze day and refuses past terms', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
}) => {
  const term = await createTerm();
  const teacher = await apiAs(course.users.teacher);
  const offering = await createCourse({
    ...term,
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await term.setFreezeDate(dayOffset(-1));
  const refused = await teacher.post(offering.apiPath(), { data: {} });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error.code).toBe('ROADMAP_CLOSED');
  expect((await teacher.get(offering.apiPath())).status()).toBe(404);
  await term.setFreezeDate(dayOffset(0));
  expect((await teacher.post(offering.apiPath(), { data: {} })).status()).toBe(201);
});

test('the Academic overview offers Roadmap creation only before the offering closes', async ({
  createCourse,
  createTerm,
  createUser,
  page,
}) => {
  const closedTerm = await createTerm();
  const openTerm = await createTerm();
  const professor = await createUser();
  const asProfessor = [
    {
      user: professor,
      role: 'TEACHER' as const,
      institutionalPosition: 'COURSE_PROFESSOR' as const,
    },
  ];
  const closed = await createCourse({ ...closedTerm, roadmap: false, participants: asProfessor });
  await closedTerm.setFreezeDate(dayOffset(-1));
  const onlyProfessor = 'Solo el profesor de cátedra puede crear el roadmap.';
  const createButton = (courseName: string) =>
    page.getByRole('button', { name: `Crear roadmap de ${courseName}` });
  const historyLink = (courseName: string) =>
    page.getByRole('link', { name: `Historial de versiones de ${courseName}` });

  // A closed offering listed as the latest term offers its history, not creation.
  await authenticateAs(page.context(), professor.id);
  await page.goto('/academic-overview');
  await expect(historyLink(closed.courseName)).toBeVisible();
  await expect(createButton(closed.courseName)).toHaveCount(0);
  await expect(page.getByText(onlyProfessor)).toHaveCount(0);

  // Among previous terms, the closed offering still offers no creation.
  const open = await createCourse({ ...openTerm, roadmap: false, participants: asProfessor });
  await page.goto('/academic-overview');
  await expect(createButton(open.courseName)).toBeVisible();
  await page.getByRole('button', { name: /Semestres anteriores/ }).click();
  await page.getByRole('button', { name: `Otoño ${closedTerm.year}` }).click();
  await expect(historyLink(closed.courseName)).toBeVisible();
  await expect(createButton(closed.courseName)).toHaveCount(0);
});

for (const semester of [1, 2] as const)
  test(`creation refuses a missing calendar through the semester-${semester} fallback`, async ({
    course,
    createCourse,
    createTerm,
    apiAs,
  }) => {
    const term = await createTerm(semester);
    await term.setFreezeDate(null);
    const offering = await createCourse({
      ...term,
      roadmap: false,
      participants: [{ user: course.users.teacher, role: 'TEACHER' }],
    });
    const teacher = await apiAs(course.users.teacher);
    const refused = await teacher.post(offering.apiPath(), { data: {} });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error.code).toBe('ROADMAP_CLOSED');
  });

test('an open teaching canvas refuses its next save and becomes read-only after closure', async ({
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
  const { createNode } = await prepareNodeCreator(teacher, offering);
  const node = await createNode('Final canvas content', 0);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await page.locator(`.react-flow__node[data-id="${node.id}"]`).click();
  await page.getByLabel('Título', { exact: true }).fill('Late draft');
  // Hold background recovery at the pre-closure projection so this exercises
  // the save refusal, rather than a focus refresh discovering closure first.
  const openProjection = await (await teacher.get(offering.apiPath())).json();
  let saveAttempted = false;
  page.on('request', (request) => {
    if (request.method() === 'PATCH') saveAttempted = true;
  });
  await page.route(`**${offering.apiPath()}`, async (route) => {
    if (route.request().method() === 'GET' && !saveAttempted)
      await route.fulfill({ json: openProjection });
    else await route.continue();
  });
  await term.setFreezeDate(dayOffset(-1));
  await waitForClosure(offering);
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(
    page.getByText('Este roadmap está cerrado y es de sólo lectura.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vista estudiante' })).toBeVisible();
  const nodes = (await (await teacher.get(offering.apiPath())).json()).nodes;
  expect(nodes.find((item: { id: string }) => item.id === node.id).title).toBe(
    'Final canvas content',
  );
  const student = await apiAs(course.users.studentWithoutProgress);
  expect((await student.get(offering.apiPath())).status()).toBe(200);
});

test('an edit racing closure either commits first or receives the closure refusal', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
}) => {
  const term = await createTerm();
  const offering = await createCourse({
    ...term,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  const teacher = await apiAs(course.users.teacher);
  const { createNode } = await prepareNodeCreator(teacher, offering);
  const node = await createNode('Before race', 0);
  await term.setFreezeDate(dayOffset(-1));
  const [response] = await Promise.all([
    teacher.patch(offering.apiPath(`/nodes/${node.id}`), { data: { title: 'Racing edit' } }),
    waitForClosure(offering),
  ]);
  expect([200, 409]).toContain(response.status());
  expect(await response.json()).toMatchObject(
    { 200: { node: { title: 'Racing edit' } }, 409: { error: { code: 'ROADMAP_CLOSED' } } }[
      response.status()
    ]!,
  );
  const finalTitle = { 200: 'Racing edit', 409: 'Before race' }[response.status()];
  const readTitle = async () =>
    (await (await teacher.get(offering.apiPath())).json()).nodes.find(
      (item: { id: string }) => item.id === node.id,
    ).title;
  expect(await readTitle()).toBe(finalTitle);
  expect(
    (
      await teacher.patch(offering.apiPath(`/nodes/${node.id}`), { data: { title: 'After race' } })
    ).status(),
  ).toBe(409);
  expect(await readTitle()).toBe(finalTitle);
});

test('foreground refresh reads recorded closure and removes teaching controls without a save', async ({
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
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  const teacher = await apiAs(course.users.teacher);
  const { createNode } = await prepareNodeCreator(teacher, offering);
  await createNode('Inspect after closure', 0);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toBeVisible();
  await term.setFreezeDate(dayOffset(-1));
  await waitForClosure(offering);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expect(page.getByRole('button', { name: 'Reiniciar progreso' })).toHaveCount(0);
});
