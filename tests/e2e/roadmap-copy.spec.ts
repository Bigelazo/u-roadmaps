import { expect, test, type E2ECourseOffering } from './fixtures';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { literal, queryJson, sql } from './database';
import { authenticateAs } from './helpers';

function yesterday() {
  const day = new Date(`${chileCalendarDay()}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

type RoadmapBody = {
  nodeTypes: { id: string; name: string; isPredefined: boolean }[];
  nodes: {
    id: string;
    title: string;
    description: string | null;
    positionX: number;
    positionY: number;
    nodeTypeId: string;
    isVisible: boolean;
    isTeacherBlocked: boolean;
    teacherUnlockOn?: string;
    resources: { id: string; title: string; url: string; type: string }[];
  }[];
  dependencies: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string;
    targetHandle: string;
  }[];
};

function roadmapCount(offering: E2ECourseOffering) {
  return queryJson<number>(`
    SELECT count(*)::int FROM "Roadmap" r JOIN "CourseOffering" o ON o."id" = r."courseOfferingId"
    WHERE o."courseCode" = ${literal(offering.courseCode)} AND o."year" = ${offering.year}
      AND o."semester" = ${offering.semester};
  `);
}

/** A closed version with a hidden Node, a Scheduled unlock and a file Resource, plus an empty next offering. */
const copyScenario = test.extend<{
  scenario: {
    closed: E2ECourseOffering;
    closedTerm: {
      year: number;
      semester: number;
      setFreezeDate(day: string | null): Promise<void>;
    };
    next: E2ECourseOffering;
    nextTerm: { year: number; semester: number; setFreezeDate(day: string | null): Promise<void> };
    source: RoadmapBody;
    scheduledNodeId: string;
  };
}>({
  scenario: async (
    { course, createCourse, createTerm, apiAs, waitForClosure, reportPosition },
    provide,
  ) => {
    const closedTerm = await createTerm();
    const nextTerm = await createTerm();
    const { teacher, teachingAssistant, studentWithProgress, studentWithoutProgress } =
      course.users;
    const closed = await createCourse({
      ...closedTerm,
      participants: [
        { user: teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' },
        { user: studentWithProgress, role: 'STUDENT' },
      ],
    });
    const next = await createCourse({
      ...nextTerm,
      roadmap: false,
      sameCourseAs: closed,
      participants: [
        { user: teacher, role: 'TEACHER' },
        { user: teachingAssistant, role: 'TEACHER', institutionalPosition: 'TEACHING_ASSISTANT' },
        { user: studentWithProgress, role: 'STUDENT' },
        { user: studentWithoutProgress, role: 'STUDENT' },
      ],
    });
    // The fixture reports every teacher as course professor; the assistant is not one.
    await reportPosition(teachingAssistant, next, 'TEACHING_ASSISTANT');
    const api = await apiAs(teacher);
    const before: RoadmapBody = await (await api.get(closed.apiPath())).json();
    const scheduledNodeId = before.nodes.find(({ isVisible }) => isVisible)!.id;
    await sql(
      `UPDATE "RoadmapNode" SET "isTeacherBlocked" = true, "teacherUnlockOn" = '2099-01-01' WHERE "id" = ${literal(scheduledNodeId)};`,
    );
    const upload = await api.post(closed.apiPath(`/nodes/${scheduledNodeId}/resources`), {
      multipart: {
        file: { name: 'guia.txt', mimeType: 'text/plain', buffer: Buffer.from('contenido') },
      },
    });
    expect(upload.status()).toBe(201);
    const source: RoadmapBody = await (await api.get(closed.apiPath())).json();
    await closedTerm.setFreezeDate(yesterday());
    await waitForClosure(closed);
    await provide({ closed, closedTerm, next, nextTerm, source, scheduledNodeId });
  },
});

function sourceOf(offering: E2ECourseOffering) {
  return {
    source: { courseCode: offering.courseCode, year: offering.year, semester: offering.semester },
  };
}

copyScenario(
  'copying a closed version reproduces its content under the copy rules',
  async ({ course, scenario, apiAs, waitForClosure }) => {
    const { closed, next, source } = scenario;
    const api = await apiAs(course.users.teacher);
    const created = await api.post(next.apiPath(), { data: sourceOf(closed) });
    expect(created.status()).toBe(201);
    const copy: RoadmapBody = await (await api.get(next.apiPath())).json();

    const sourceIds = new Set([
      ...source.nodes.map(({ id }) => id),
      ...source.dependencies.map(({ id }) => id),
      ...source.nodes.flatMap(({ resources }) => resources.map(({ id }) => id)),
      ...source.nodeTypes.filter(({ isPredefined }) => !isPredefined).map(({ id }) => id),
    ]);
    const copiedIds = [
      ...copy.nodes.map(({ id }) => id),
      ...copy.dependencies.map(({ id }) => id),
      ...copy.nodes.flatMap(({ resources }) => resources.map(({ id }) => id)),
      ...copy.nodeTypes.filter(({ isPredefined }) => !isPredefined).map(({ id }) => id),
    ];
    expect(copiedIds.filter((id) => sourceIds.has(id))).toEqual([]);

    const typeName = (body: RoadmapBody, id: string) =>
      body.nodeTypes.find((type) => type.id === id)!.name;
    const predefined = (body: RoadmapBody, id: string) =>
      body.nodeTypes.find((type) => type.id === id)!.isPredefined;
    const byTitle = new Map(copy.nodes.map((node) => [node.title, node]));
    expect(copy.nodes).toHaveLength(source.nodes.length);
    for (const original of source.nodes) {
      const copied = byTitle.get(original.title)!;
      expect(copied).toMatchObject({
        description: original.description,
        positionX: original.positionX,
        positionY: original.positionY,
        isVisible: original.isVisible,
        isTeacherBlocked: original.isVisible,
      });
      expect(copied.teacherUnlockOn).toBeUndefined();
      expect(typeName(copy, copied.nodeTypeId)).toBe(typeName(source, original.nodeTypeId));
      // Predefined node types stay shared; Custom node types get fresh identities.
      expect(copied.nodeTypeId === original.nodeTypeId).toBe(
        predefined(source, original.nodeTypeId),
      );
      expect(copied.resources.map(({ title, url, type }) => ({ title, url, type }))).toEqual(
        original.resources
          .filter(({ type }) => type !== 'FILE')
          .map(({ title, url, type }) => ({ title, url, type })),
      );
    }
    expect(
      source.nodes.flatMap(({ resources }) => resources).some(({ type }) => type === 'FILE'),
    ).toBe(true);

    const titleOf = (body: RoadmapBody, id: string) =>
      body.nodes.find((node) => node.id === id)!.title;
    const edges = (body: RoadmapBody) =>
      body.dependencies
        .map(
          (dependency) =>
            `${titleOf(body, dependency.sourceNodeId)}:${dependency.sourceHandle}->${titleOf(body, dependency.targetNodeId)}:${dependency.targetHandle}`,
        )
        .sort();
    expect(edges(copy)).toEqual(edges(source));

    // No Participations' progress travels with the copy.
    const progress = await queryJson<number>(`
      SELECT (SELECT count(*) FROM "Completion" c JOIN "RoadmapNode" n ON n."id" = c."roadmapNodeId" WHERE n."roadmapId" = ${literal((await created.json()).roadmap.id)})
           + (SELECT count(*) FROM "SimulatedCompletion" WHERE "roadmapId" = ${literal((await created.json()).roadmap.id)});
    `);
    expect(Number(progress)).toBe(0);

    // Once closed, the copy names its source and lineage.
    await scenario.nextTerm.setFreezeDate(yesterday());
    await waitForClosure({ ...next, roadmapId: (await created.json()).roadmap.id });
    const version = await (
      await api.get(`/api/${next.courseCode}/versions/${next.year}/${next.semester}`)
    ).json();
    expect(version.version.origin).toMatchObject({
      kind: 'COPY',
      year: closed.year,
      semester: closed.semester,
    });
    expect(version.version.lineage.map(({ year }: { year: number }) => year)).toEqual([
      closed.year,
      next.year,
    ]);
  },
);

copyScenario(
  'students see copied visible Nodes blocked, no hidden Nodes, and one availability notice',
  async ({ course, scenario, apiAs }) => {
    const { closed, next, source } = scenario;
    const created = await (
      await apiAs(course.users.teacher)
    ).post(next.apiPath(), {
      data: sourceOf(closed),
    });
    expect(created.status()).toBe(201);
    const roadmapId = (await created.json()).roadmap.id;
    for (const student of [course.users.studentWithProgress, course.users.studentWithoutProgress]) {
      const api = await apiAs(student);
      await expect
        .poll(
          async () =>
            (await (await api.get(`/api/notifications?roadmapId=${roadmapId}`)).json())
              .notifications.length,
        )
        .toBe(1);
      const notices = (await (await api.get(`/api/notifications?roadmapId=${roadmapId}`)).json())
        .notifications;
      expect(notices).toHaveLength(1);
      const view = await (await api.get(next.apiPath())).json();
      const titles = view.nodes.map(({ title }: { title: string }) => title).sort();
      expect(titles).toEqual(
        source.nodes
          .filter(({ isVisible }) => isVisible)
          .map(({ title }) => title)
          .sort(),
      );
      for (const node of view.nodes) expect(node.access.status).toBe('BLOCKED');
    }
  },
);

copyScenario(
  'only the course professor copies, and invalid sources leave no Roadmap',
  async ({ course, scenario, apiAs, createCourse, createTerm }) => {
    const { closed, next } = scenario;
    const assistant = await apiAs(course.users.teachingAssistant);
    expect((await assistant.post(next.apiPath(), { data: sourceOf(closed) })).status()).toBe(403);

    const openTerm = await createTerm();
    const open = await createCourse({
      ...openTerm,
      sameCourseAs: closed,
      participants: [{ user: course.users.teacher, role: 'TEACHER' }],
    });
    const otherCourse = await createCourse({
      ...scenario.closedTerm,
      participants: [{ user: course.users.teacher, role: 'TEACHER' }],
    });
    const professor = await apiAs(course.users.teacher);
    for (const [offering, status] of [
      [open, 409],
      [otherCourse, 404],
      [{ ...closed, semester: closed.semester + 1 }, 404],
    ] as const) {
      const refused = await professor.post(next.apiPath(), {
        data: sourceOf(offering as E2ECourseOffering),
      });
      expect(refused.status()).toBe(status);
    }
    expect(Number(await roadmapCount(next))).toBe(0);
  },
);

copyScenario(
  'concurrent copy requests create exactly one Roadmap',
  async ({ course, scenario, apiAs }) => {
    const api = await apiAs(course.users.teacher);
    const statuses = await Promise.all(
      Array.from({ length: 4 }, () =>
        api.post(scenario.next.apiPath(), { data: sourceOf(scenario.closed) }),
      ),
    ).then((responses) => responses.map((response) => response.status()).sort());
    expect(statuses).toEqual([201, 409, 409, 409]);
    expect(Number(await roadmapCount(scenario.next))).toBe(1);
  },
);

copyScenario(
  'the creation dialog offers closed versions with a viewer link and creates the copy',
  async ({ course, scenario, page }) => {
    const { closed, next, source } = scenario;
    const edition = `Edición ${closed.year}-${closed.semester}`;
    await authenticateAs(page.context(), course.users.teacher.id);
    await page.goto('/academic-overview');
    await page
      .getByRole('button', { name: `Crear roadmap de ${next.courseName}` })
      .filter({ visible: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: `Crear roadmap de ${next.courseName}` });
    await expect(dialog.getByRole('radio', { name: 'Roadmap vacío' })).toBeChecked();
    const view = dialog.getByRole('link', { name: `Ver ${edition}` });
    await expect(view).toHaveAttribute(
      'href',
      `/courses/${closed.courseCode}/versions/${closed.year}/${closed.semester}`,
    );
    const viewer = page.waitForEvent('popup');
    await view.click();
    await expect((await viewer).getByRole('heading', { name: edition })).toBeVisible();

    await dialog.getByRole('radio', { name: new RegExp(edition) }).check();
    await dialog.getByRole('button', { name: 'Crear roadmap' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/courses/${next.courseCode}/${next.year}/${next.semester}$`),
    );
    await expect(page.locator('.react-flow__node')).toHaveCount(source.nodes.length);
  },
);

test('without closed versions the dialog only offers an empty Roadmap', async ({
  course,
  createCourse,
  page,
}) => {
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: `Crear roadmap de ${offering.courseName}` }).click();
  const dialog = page.getByRole('dialog', { name: `Crear roadmap de ${offering.courseName}` });
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await expect(dialog.getByRole('radio', { name: 'Roadmap vacío' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Crear roadmap' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/courses/${offering.courseCode}/${offering.year}/${offering.semester}$`),
  );
});
