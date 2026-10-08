import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { literal, queryJson, sql } from './database';
import { authenticateAs } from './helpers';
import { uploadsDirectory } from './test-data';

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

type ResourceBody = RoadmapBody['nodes'][number]['resources'][number];

/** Copied Resource content; file URLs are omitted because every edition downloads its own. */
function resourceContent({ title, url, type }: ResourceBody) {
  return { title, type, url: type === 'FILE' ? undefined : url };
}

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
    fileContent: string;
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
    // Unique bytes let a test find every stored copy of this file.
    const fileContent = `contenido ${closed.courseCode}`;
    const upload = await api.post(closed.apiPath(`/nodes/${scheduledNodeId}/resources`), {
      multipart: {
        file: { name: 'guia.txt', mimeType: 'text/plain', buffer: Buffer.from(fileContent) },
      },
    });
    expect(upload.status()).toBe(201);
    const source: RoadmapBody = await (await api.get(closed.apiPath())).json();
    await closedTerm.setFreezeDate(yesterday());
    await waitForClosure(closed);
    await provide({ closed, closedTerm, next, nextTerm, source, scheduledNodeId, fileContent });
  },
});

/** The creation body copying a version of the same Course, named by its Academic term. */
function sourceOf(offering: E2ECourseOffering) {
  return { source: { year: offering.year, semester: offering.semester } };
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
      expect(copied.resources.map(resourceContent)).toEqual(
        original.resources.map(resourceContent),
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

    // Removing the source Roadmap keeps the recorded origin and lineage.
    const sourceFileKey = await fileKeyOf(fileResources(source)[0]!.id);
    await sql(`DELETE FROM "Roadmap" WHERE "id" = ${literal(closed.roadmapId!)};`);
    await rm(join(uploadsDirectory(), sourceFileKey), { force: true });
    const afterRemoval = await (
      await api.get(`/api/${next.courseCode}/versions/${next.year}/${next.semester}`)
    ).json();
    expect(afterRemoval.version.origin).toEqual({
      kind: 'COPY',
      year: closed.year,
      semester: closed.semester,
      edition: `Edición ${closed.year}-${closed.semester}`,
    });
    expect(afterRemoval.version.lineage.map(({ year }: { year: number }) => year)).toEqual([
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
    for (const [source, status, code] of [
      [sourceOf(open).source, 409, 'VERSION_NOT_CLOSED'],
      [
        {
          courseCode: otherCourse.courseCode,
          year: otherCourse.year,
          semester: otherCourse.semester,
        },
        404,
        'VERSION_NOT_FOUND',
      ],
      [{ year: closed.year, semester: closed.semester + 1 }, 404, 'VERSION_NOT_FOUND'],
      [{ year: 'anterior', semester: closed.semester }, 400, 'INVALID_REQUEST'],
    ] as const) {
      const refused = await professor.post(next.apiPath(), { data: { source } });
      expect(refused.status()).toBe(status);
      expect((await refused.json()).error.code).toBe(code);
    }
    expect(Number(await roadmapCount(next))).toBe(0);
  },
);

copyScenario(
  'concurrent copy requests create exactly one Roadmap',
  async ({ course, scenario, apiAs }) => {
    const api = await apiAs(course.users.teacher);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        api.post(scenario.next.apiPath(), { data: sourceOf(scenario.closed) }),
      ),
    );
    expect(responses.map((response) => response.status()).sort()).toEqual([201, 409, 409, 409]);
    for (const refused of responses.filter((response) => response.status() === 409))
      expect((await refused.json()).error.code).toBe('ROADMAP_CONFLICT');
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

function fileResources(body: RoadmapBody) {
  return body.nodes.flatMap(({ resources }) => resources).filter(({ type }) => type === 'FILE');
}

function fileKeyOf(resourceId: string) {
  return queryJson<string>(
    `SELECT to_json("fileKey") FROM "Resource" WHERE "id" = ${literal(resourceId)};`,
  );
}

async function download(api: APIRequestContext, url: string) {
  const response = await api.get(url);
  expect(response.status()).toBe(200);
  return (await response.body()).toString();
}

/** Stored files holding exactly these bytes, so leftovers of a failed copy are visible. */
async function storedCopies(content: string) {
  const directory = uploadsDirectory();
  const names = await readdir(directory);
  const contents = await Promise.all(
    names.map((name) => readFile(join(directory, name), 'utf8').catch(() => null)),
  );
  return contents.filter((stored) => stored === content).length;
}

copyScenario(
  'copied file Resources own their bytes independently of the version',
  async ({ course, scenario, apiAs }) => {
    // A closed version refuses every edit, so independence is checked from the new edition.
    const { closed, next, source, fileContent } = scenario;
    const api = await apiAs(course.users.teacher);
    expect((await api.post(next.apiPath(), { data: sourceOf(closed) })).status()).toBe(201);
    const copy: RoadmapBody = await (await api.get(next.apiPath())).json();
    const [original] = fileResources(source);
    const [copied] = fileResources(copy);
    expect(copied).toMatchObject({ title: original!.title });
    expect(await fileKeyOf(copied!.id)).not.toBe(await fileKeyOf(original!.id));
    expect(await download(api, copied!.url)).toBe(fileContent);
    expect(await download(api, original!.url)).toBe(fileContent);

    // Replacing the file means removing it and uploading new bytes on the same Node.
    const removed = await api.delete(next.apiPath(`/resources/${copied!.id}`));
    expect(removed.ok()).toBe(true);
    expect(await download(api, original!.url)).toBe(fileContent);
    expect(await storedCopies(fileContent)).toBe(1);
    const node = copy.nodes.find(({ resources }) => resources.some(({ id }) => id === copied!.id));
    const replacement = await api.post(next.apiPath(`/nodes/${node!.id}/resources`), {
      multipart: {
        file: { name: 'guia.txt', mimeType: 'text/plain', buffer: Buffer.from('reemplazo') },
      },
    });
    expect(replacement.status()).toBe(201);
    expect(await download(api, (await replacement.json()).resource.url)).toBe('reemplazo');
    expect(await download(api, original!.url)).toBe(fileContent);
  },
);

copyScenario(
  'a file missing from storage is omitted while the rest of the copy succeeds',
  async ({ course, scenario, apiAs }) => {
    const { closed, next, source } = scenario;
    const [original] = fileResources(source);
    await rm(join(uploadsDirectory(), await fileKeyOf(original!.id)));
    const api = await apiAs(course.users.teacher);
    expect((await api.post(next.apiPath(), { data: sourceOf(closed) })).status()).toBe(201);
    const copy: RoadmapBody = await (await api.get(next.apiPath())).json();
    expect(fileResources(copy)).toEqual([]);
    const others = (body: RoadmapBody) =>
      body.nodes
        .flatMap(({ resources }) => resources)
        .filter(({ type }) => type !== 'FILE')
        .map(resourceContent);
    expect(others(copy)).toEqual(others(source));
    expect(copy.nodes).toHaveLength(source.nodes.length);
  },
);

copyScenario(
  'a creation that fails after copying bytes leaves no orphaned files',
  async ({ course, scenario, apiAs, rejectResourceInserts }) => {
    const { closed, next, fileContent } = scenario;
    await rejectResourceInserts(next);
    const api = await apiAs(course.users.teacher);
    const refused = await api.post(next.apiPath(), { data: sourceOf(closed) });
    expect(refused.ok()).toBe(false);
    expect(Number(await roadmapCount(next))).toBe(0);
    expect(await storedCopies(fileContent)).toBe(1);
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
