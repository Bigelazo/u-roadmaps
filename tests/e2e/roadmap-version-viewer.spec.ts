import { expect, test, type E2ECourseOffering } from './fixtures';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { literal, queryJson, sql } from './database';
import { authenticateAs } from './helpers';

function yesterday() {
  const day = new Date(`${chileCalendarDay()}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function versionPath(offering: E2ECourseOffering, suffix = '') {
  return `/api/${offering.courseCode}/versions/${offering.year}/${offering.semester}${suffix}`;
}

function viewerPagePath(offering: E2ECourseOffering) {
  return `/courses/${offering.courseCode}/versions/${offering.year}/${offering.semester}`;
}

function sideEffectCounts(offering: E2ECourseOffering) {
  return queryJson<{ visits: number; acknowledgements: number; completions: number }>(`
    SELECT json_build_object(
      'visits', (SELECT count(*) FROM "RoadmapVisit" WHERE "roadmapId" = '${offering.roadmapId}'),
      'acknowledgements', (SELECT count(*) FROM "NoticeAcknowledgement" WHERE "roadmapId" = '${offering.roadmapId}'),
      'completions', (SELECT count(*) FROM "Completion" c JOIN "RoadmapNode" n ON n."id" = c."roadmapNodeId" WHERE n."roadmapId" = '${offering.roadmapId}')
    );
  `);
}

/** A closed version with an uploaded file, taught by `teacher`, plus a later offering. */
const closedVersion = test.extend<{
  version: {
    closed: E2ECourseOffering;
    later: E2ECourseOffering;
    closedYear: number;
    nodeId: string;
    nodeTitle: string;
    resourceId: string;
  };
}>({
  version: async ({ course, createCourse, createTerm, apiAs, waitForClosure }, provide) => {
    const closedTerm = await createTerm();
    const laterTerm = await createTerm();
    const { teacher, teachingAssistant, studentWithProgress } = course.users;
    const closed = await createCourse({
      ...closedTerm,
      participants: [
        { user: teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' },
        { user: studentWithProgress, role: 'STUDENT' },
      ],
    });
    const later = await createCourse({
      ...laterTerm,
      sameCourseAs: closed,
      participants: [
        { user: teachingAssistant, role: 'TEACHER', institutionalPosition: 'TEACHING_ASSISTANT' },
      ],
    });
    await sql(
      `UPDATE "Roadmap" SET "creatorId" = ${literal(teacher.id)} WHERE "id" = ${literal(closed.roadmapId!)};`,
    );
    const api = await apiAs(teacher);
    const roadmap = await (await api.get(closed.apiPath())).json();
    const node = roadmap.nodes[0] as { id: string; title: string };
    const upload = await api.post(closed.apiPath(`/nodes/${node.id}/resources`), {
      multipart: {
        file: { name: 'guia.txt', mimeType: 'text/plain', buffer: Buffer.from('contenido guía') },
      },
    });
    expect(upload.status()).toBe(201);
    const resourceId = (await upload.json()).resource.id as string;
    await closedTerm.setFreezeDate(yesterday());
    await waitForClosure(closed);
    await provide({
      closed,
      later,
      closedYear: closedTerm.year,
      nodeId: node.id,
      nodeTitle: node.title,
      resourceId,
    });
  },
});

closedVersion(
  'a teacher within the horizon reads a version and downloads its file without side effects',
  async ({ course, version, apiAs }) => {
    const { closed, closedYear, nodeId, resourceId } = version;
    const before = await sideEffectCounts(closed);
    const api = await apiAs(course.users.teachingAssistant);
    const response = await api.get(versionPath(closed));
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.version).toMatchObject({
      edition: `Edición ${closedYear}-${closed.semester}`,
      creator: { id: course.users.teacher.id, name: course.users.teacher.name },
      teachingStaff: [
        {
          id: course.users.teacher.id,
          name: course.users.teacher.name,
          institutionalPosition: 'COURSE_PROFESSOR',
        },
      ],
      origin: { kind: 'EMPTY' },
      lineage: [{ year: closedYear, semester: closed.semester }],
    });
    const node = body.nodes.find(({ id }: { id: string }) => id === nodeId);
    expect(node.resources).toContainEqual({
      id: resourceId,
      title: 'guia.txt',
      type: 'FILE',
      url: versionPath(closed, `/resources/${resourceId}/file`),
    });
    expect(body.nodeTypes.length).toBeGreaterThan(0);
    expect(body.dependencies.length).toBeGreaterThan(0);

    // No student data anywhere in the response.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(course.users.studentWithProgress.name);
    expect(serialized).not.toContain(course.users.studentWithProgress.id);
    for (const key of ['isCompleted', 'canComplete', 'participants', 'completions', 'progress'])
      expect(serialized).not.toContain(`"${key}"`);

    const download = await api.get(versionPath(closed, `/resources/${resourceId}/file`));
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe('contenido guía');
    expect(await sideEffectCounts(closed)).toEqual(before);
  },
);

closedVersion(
  'outsiders of the horizon, students and non-participants are refused',
  async ({ course, version, apiAs, createUser }) => {
    const { closed, resourceId } = version;
    const refusedUsers = [course.users.studentWithProgress, await createUser()];
    for (const user of refusedUsers) {
      const api = await apiAs(user);
      const refused = await api.get(versionPath(closed));
      expect(refused.status()).toBe(404);
      expect((await refused.json()).error.code).toBe('VERSION_NOT_FOUND');
      expect((await api.get(versionPath(closed, `/resources/${resourceId}/file`))).status()).toBe(
        404,
      );
    }
    const missing = await (
      await apiAs(course.users.teachingAssistant)
    ).get(`/api/${closed.courseCode}/versions/${closed.year}/${closed.semester + 1}`);
    expect(missing.status()).toBe(404);
  },
);

closedVersion(
  'a teacher whose horizon precedes the version cannot open it',
  async ({ version, apiAs, createUser, createCourse, page }) => {
    const { closed, resourceId } = version;
    const earlierTeacher = await createUser();
    // Synthetic terms grow, so a year below the version's precedes it.
    await createCourse({
      year: closed.year - 1,
      semester: closed.semester,
      roadmap: false,
      sameCourseAs: closed,
      participants: [{ user: earlierTeacher, role: 'TEACHER' }],
    });
    const api = await apiAs(earlierTeacher);
    expect((await api.get(versionPath(closed))).status()).toBe(404);
    expect((await api.get(versionPath(closed, `/resources/${resourceId}/file`))).status()).toBe(
      404,
    );
    await authenticateAs(page.context(), earlierTeacher.id);
    expect((await page.goto(viewerPagePath(closed)))?.status()).toBe(404);
  },
);

closedVersion(
  'teaching staff open the viewer from the history and inspect a Node',
  async ({ course, version, page }) => {
    const { closed, closedYear, nodeTitle } = version;
    const before = await sideEffectCounts(closed);
    await authenticateAs(page.context(), course.users.teachingAssistant.id);
    await page.goto(`/courses/${closed.courseCode}/versions`);
    await page.getByRole('link', { name: `Ver Edición ${closedYear}-${closed.semester}` }).click();
    await expect(page).toHaveURL(new RegExp(`${viewerPagePath(closed)}$`));
    await expect(
      page.getByRole('heading', { name: `Edición ${closedYear}-${closed.semester}` }),
    ).toBeVisible();
    await expect(page.getByText('Creada desde cero')).toBeVisible();
    await expect(
      page.getByText(`${course.users.teacher.name} · Profesor de cátedra`),
    ).toBeVisible();
    await expect(page.getByText(course.users.studentWithProgress.name)).toHaveCount(0);

    await page.locator(`.react-flow__node[data-id="${version.nodeId}"]`).click();
    const details = page.getByRole('complementary', { name: nodeTitle });
    await expect(details).toBeVisible();
    const download = page.waitForEvent('download');
    await details.getByRole('link', { name: /guia\.txt/ }).click();
    expect((await download).suggestedFilename()).toBe('guia.txt');
    // Read-only: no editing or Completion affordances.
    await expect(page.getByRole('button', { name: /Completar|Recurso|Guardar/ })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Linaje' })).toHaveText(
      `Edición ${closedYear}-${closed.semester}`,
    );
    // Loading the page and its canvas leaves no visits, recognitions or Completions.
    expect(await sideEffectCounts(closed)).toEqual(before);
  },
);

closedVersion(
  'students and non-participants get a missing page for the viewer',
  async ({ course, version, page, createUser }) => {
    for (const user of [course.users.studentWithProgress, await createUser()]) {
      await authenticateAs(page.context(), user.id);
      const visit = await page.goto(viewerPagePath(version.closed));
      expect(visit?.status()).toBe(404);
    }
  },
);
