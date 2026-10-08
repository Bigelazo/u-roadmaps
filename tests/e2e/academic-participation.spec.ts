import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { forgetUcampusUser, failUcampusEndpoint } from './ucampus';
import { authenticateAs } from './helpers';

const forbidden = {
  error: {
    code: 'FORBIDDEN',
    message: 'Solo el profesor de cátedra puede crear el roadmap de este curso.',
  },
};

for (const position of [
  'COORDINATING_PROFESSOR',
  'AUXILIARY_PROFESSOR',
  'TEACHING_ASSISTANT',
] as const) {
  test(`${position} edits but cannot create the shared Roadmap`, async ({
    course,
    apiAs,
    createCourse,
    reportPosition,
  }) => {
    const user = course.users.teachingAssistant;
    const offering = await createCourse({
      roadmap: false,
      participants: [{ user, role: 'TEACHER' }],
    });
    await reportPosition(user, offering, position);
    const api = await apiAs(user);
    const response = await api.post(offering.apiPath(), { data: {} });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toEqual(forbidden);
    const types = await (await api.get(course.apiPath('/node-types'))).json();
    expect(
      (
        await api.post(course.apiPath('/nodes'), {
          data: {
            title: 'Trabajo docente',
            nodeTypeId: types.nodeTypes[0].id,
            positionX: 0,
            positionY: 0,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`))).status(),
    ).toBe(403);
    expect((await api.get(course.apiPath('/simulation'))).status()).toBe(200);
  });
}

test('only a confirmed course professor can create, and an outage never widens access', async ({
  course,
  apiAs,
  createCourse,
  reportPosition,
}) => {
  const user = course.users.teacher;
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user, role: 'TEACHER' }],
  });
  const api = await apiAs(user);
  // An empty institutional result cannot confirm the professorship in this offering.
  await reportPosition(user, offering, null);
  const refused = await api.post(offering.apiPath(), { data: {} });
  expect(refused.status()).toBe(403);
  await expect(refused.json()).resolves.toEqual(forbidden);
  await forgetUcampusUser(user);
  const outage = await api.post(offering.apiPath(), { data: {} });
  expect(outage.status()).toBe(403);
  await expect(outage.json()).resolves.toEqual(forbidden);
  await reportPosition(user, offering, 'COURSE_PROFESSOR');
  expect((await api.post(offering.apiPath(), { data: {} })).status()).toBe(201);
});

const entries: {
  name: string;
  enter: (
    page: Page,
    api: APIRequestContext,
    course: E2ECourseOffering,
    userId: string,
  ) => Promise<void>;
}[] = [
  {
    name: 'personal synchronization',
    enter: async (_page, api, course) => {
      const overview = await api.get('/api/academic-overview');
      expect((await overview.json()).offerings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ courseCode: course.courseCode, role: 'TEACHER' }),
        ]),
      );
    },
  },
  {
    name: 'Course offering entry',
    enter: async (page, _api, course, userId) => {
      await authenticateAs(page.context(), userId);
      await page.goto(course.pagePath());
      await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toBeVisible();
    },
  },
];

for (const { name: entry, enter } of entries) {
  test(`a stored student becomes teaching staff on ${entry}`, async ({
    course,
    apiAs,
    reportPosition,
    page,
  }) => {
    const user = course.users.studentWithProgress;
    const api = await apiAs(user);
    const before = await (await api.get(course.apiPath())).json();
    expect(before.nodes.some((node: { isCompleted: boolean }) => node.isCompleted)).toBe(true);
    await reportPosition(user, course, 'TEACHING_ASSISTANT');
    await enter(page, api, course, user.id);
    const after = await (await api.get(course.apiPath())).json();
    expect(after.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: course.nodes.hidden })]),
    );
    expect(after.nodes.some((node: { isCompleted: boolean }) => node.isCompleted)).toBe(false);
    expect(
      (await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`))).status(),
    ).toBe(403);
    expect((await api.get(course.apiPath('/simulation'))).status()).toBe(200);
  });
}

test('promotion withdraws student access leftovers and retains colleague content notices', async ({
  course,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.studentWithProgress;
  const assistant = await apiAs(user);
  const teacher = await apiAs(course.users.teacher);
  const nodePath = course.apiPath(`/nodes/${course.nodes.first}`);
  expect((await teacher.patch(nodePath, { data: { title: 'Cambio de colega' } })).status()).toBe(
    200,
  );
  expect((await teacher.post(`${nodePath}/teacher-block`)).status()).toBe(200);
  const notices = async () =>
    (await (await assistant.get(`/api/notifications?nodeId=${course.nodes.first}`)).json())
      .notifications;
  await expect
    .poll(async () =>
      (await notices()).map(
        (notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget,
      ),
    )
    .toContain('node-access');
  await reportPosition(user, course, 'TEACHING_ASSISTANT');
  expect((await assistant.get('/api/academic-overview')).status()).toBe(200);
  const pending = await notices();
  expect(
    pending.map((notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget),
  ).toEqual(['node-title']);
  // Staff keep colleague changes and receive none for their own edits.
  expect((await assistant.patch(nodePath, { data: { title: 'Cambio propio' } })).status()).toBe(
    200,
  );
  expect(
    (await notices()).map((notice: { data: { currentTitle: string } }) => notice.data.currentTitle),
  ).not.toContain('Cambio propio');
});

test('an observer reported among taught courses keeps student capabilities', async ({
  course,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.studentWithoutProgress;
  await reportPosition(user, course, 'OBSERVER');
  const api = await apiAs(user);
  const overview = await api.get('/api/academic-overview');
  expect((await overview.json()).offerings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        courseCode: course.courseCode,
        role: 'STUDENT',
        institutionalPosition: 'OBSERVER',
      }),
    ]),
  );
  const roadmap = await (await api.get(course.apiPath())).json();
  expect(roadmap.nodes.some((node: { id: string }) => node.id === course.nodes.hidden)).toBe(false);
  expect(
    (
      await api.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
        data: { title: 'Edición no permitida' },
      })
    ).status(),
  ).toBe(403);
  expect((await api.get(course.apiPath('/simulation'))).status()).toBe(403);
  expect((await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`))).status()).toBe(
    200,
  );
});

test('a partial institutional response preserves a stored teaching Participation', async ({
  course,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.teachingAssistant;
  await reportPosition(user, course, null);
  await failUcampusEndpoint(user, 'cursos_dictados');
  const api = await apiAs(user);
  const overview = await api.get('/api/academic-overview');
  expect((await overview.json()).offerings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ courseCode: course.courseCode, role: 'TEACHER' }),
    ]),
  );
  expect((await api.get(course.apiPath('/simulation'))).status()).toBe(200);
});
