import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { forgetUcampusUser, failUcampusEndpoint } from './ucampus';
import { authenticateAs, ok } from './helpers';

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
    await ok(response, 403);
    await expect(response.json()).resolves.toEqual(forbidden);
    const types = await (await api.get(course.apiPath('/node-types'))).json();
    await ok(
      await api.post(course.apiPath('/nodes'), {
        data: {
          title: 'Trabajo docente',
          nodeTypeId: types.nodeTypes[0].id,
          positionX: 0,
          positionY: 0,
        },
      }),
      201,
    );
    await ok(await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`)), 403);
    await ok(await api.get(course.apiPath('/simulation')));
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
  await ok(refused, 403);
  await expect(refused.json()).resolves.toEqual(forbidden);
  await forgetUcampusUser(user);
  const outage = await api.post(offering.apiPath(), { data: {} });
  await ok(outage, 403);
  await expect(outage.json()).resolves.toEqual(forbidden);
  await reportPosition(user, offering, 'COURSE_PROFESSOR');
  await ok(await api.post(offering.apiPath(), { data: {} }), 201);
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
  {
    // A deep link to the page works without first entering the course page.
    name: 'Student progress tracking entry',
    enter: async (page, _api, course, userId) => {
      await authenticateAs(page.context(), userId);
      await page.goto(`${course.pagePath()}/participants`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Integrantes del curso' }),
      ).toBeVisible();
    },
  },
];

test('Roadmap reads check the stored Participation; entering the course page synchronises it', async ({
  course,
  apiAs,
  reportPosition,
  page,
}) => {
  const user = course.users.withdrawnStudent;
  const api = await apiAs(user);
  await reportPosition(user, course, 'STUDENT');
  for (const path of [course.apiPath(), course.apiPath('/node-types')])
    await ok(await api.get(path), 403);
  await authenticateAs(page.context(), user.id);
  await page.goto(course.pagePath());
  for (const path of [course.apiPath(), course.apiPath('/node-types')])
    await ok(await api.get(path));
});

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
    await ok(await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`)), 403);
    await ok(await api.get(course.apiPath('/simulation')));
  });
}

test('promotion withdraws student access leftovers and retains colleague content notices', async ({
  course,
  teacherApi: teacher,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.studentWithProgress;
  const assistant = await apiAs(user);
  const nodePath = course.apiPath(`/nodes/${course.nodes.first}`);
  await ok(await teacher.patch(nodePath, { data: { title: 'Cambio de colega' } }));
  await ok(await teacher.post(`${nodePath}/teacher-block`));
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
  await ok(await assistant.get('/api/academic-overview'));
  const pending = await notices();
  expect(
    pending.map((notice: { data: { noticeTarget: string } }) => notice.data.noticeTarget),
  ).toEqual(['node-title']);
  const knownTitle = pending[0].data.knownTitle;
  expect(knownTitle).not.toBe('Cambio de colega');
  // Staff keep colleague changes; their own edit is absorbed by the pending notice
  // (ADR-0024 actor rule) instead of producing a notice of its own.
  await ok(await assistant.patch(nodePath, { data: { title: 'Cambio propio' } }));
  expect(await notices()).toEqual([
    expect.objectContaining({
      id: pending[0].id,
      data: expect.objectContaining({
        noticeTarget: 'node-title',
        knownTitle,
        currentTitle: 'Cambio propio',
      }),
    }),
  ]);
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
  await ok(
    await api.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Edición no permitida' },
    }),
    403,
  );
  await ok(await api.get(course.apiPath('/simulation')), 403);
  await ok(await api.post(course.apiPath(`/nodes/${course.nodes.first}/completion`)));
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
  await ok(await api.get(course.apiPath('/simulation')));
});

for (const [position, expected] of [
  ['COURSE_PROFESSOR', 201],
  ['COORDINATING_PROFESSOR', 403],
  [null, 403],
] as const) {
  test(`stored ${position} creation rights survive an institutional outage`, async ({
    course,
    createCourse,
    apiAs,
  }) => {
    const user = course.users.teacher;
    const offering = await createCourse({
      roadmap: false,
      participants: [{ user, role: 'TEACHER', institutionalPosition: position }],
    });
    await forgetUcampusUser(user);
    const api = await apiAs(user);
    expect((await api.post(offering.apiPath(), { data: {} })).status()).toBe(expected);
  });
}

test('successful synchronization updates the position; partial and failed responses preserve it', async ({
  course,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.teachingAssistant;
  const api = await apiAs(user);
  const position = async () =>
    (await (await api.get('/api/academic-overview')).json()).offerings.find(
      (offering: { courseCode: string }) => offering.courseCode === course.courseCode,
    ).institutionalPosition;
  await reportPosition(user, course, 'AUXILIARY_PROFESSOR');
  expect(await position()).toBe('AUXILIARY_PROFESSOR');
  await reportPosition(user, course, 'OBSERVER');
  await failUcampusEndpoint(user, 'cursos_inscritos');
  expect(await position()).toBe('AUXILIARY_PROFESSOR');
  await forgetUcampusUser(user);
  expect(await position()).toBe('AUXILIARY_PROFESSOR');
  await ok(await api.get(course.apiPath('/simulation')));
});

test('a legacy Participation acquires its position on successful synchronization', async ({
  course,
  createCourse,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.teacher;
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user, role: 'TEACHER', institutionalPosition: null }],
  });
  const api = await apiAs(user);
  await reportPosition(user, offering, 'COURSE_PROFESSOR');
  const overview = await (await api.get('/api/academic-overview')).json();
  expect(overview.offerings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        courseCode: offering.courseCode,
        institutionalPosition: 'COURSE_PROFESSOR',
      }),
    ]),
  );
  await forgetUcampusUser(user);
  await ok(await api.post(offering.apiPath(), { data: {} }), 201);
});

test('a denied creation records demotion and stays denied during an outage', async ({
  course,
  createCourse,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.teacher;
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' }],
  });
  const api = await apiAs(user);
  await reportPosition(user, offering, 'COORDINATING_PROFESSOR');
  await ok(await api.post(offering.apiPath(), { data: {} }), 403);
  await forgetUcampusUser(user);
  await ok(await api.post(offering.apiPath(), { data: {} }), 403);
});

test('a partial response keeps absent teaching offerings and their stored labels in both views', async ({
  course,
  apiAs,
  reportPosition,
  page,
}) => {
  const user = course.users.teachingAssistant;
  const api = await apiAs(user);
  await reportPosition(user, course, 'AUXILIARY_PROFESSOR');
  await ok(await api.get('/api/academic-overview'));
  await failUcampusEndpoint(user, 'cursos_dictados');
  const { offerings } = await (await api.get('/api/academic-overview')).json();
  expect(offerings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        courseCode: course.courseCode,
        institutionalPosition: 'AUXILIARY_PROFESSOR',
      }),
    ]),
  );
  await authenticateAs(page.context(), user.id);
  await page.goto('/academic-overview');
  await expect(page.getByText(course.courseName, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: course.courseCode }).getByText('Auxiliar', {
      exact: true,
    }),
  ).toBeVisible();
});

test('a stored teaching assistant can edit while U-Campus is unavailable', async ({
  course,
  apiAs,
  reportPosition,
}) => {
  const user = course.users.teachingAssistant;
  const api = await apiAs(user);
  await reportPosition(user, course, 'TEACHING_ASSISTANT');
  await ok(await api.get('/api/academic-overview'));
  await forgetUcampusUser(user);
  await ok(
    await api.patch(course.apiPath(`/nodes/${course.nodes.first}`), {
      data: { title: 'Edición del ayudante sin U-Campus' },
    }),
  );
});
