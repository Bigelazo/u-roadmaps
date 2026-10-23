import { developmentFixtureIds, fixtureRoadmaps } from '@/development';
import { fixtureParticipations, developmentFixtureOfferings } from '@/development/fixtures/catalog';
import { expect, test } from './fixtures';
import { authenticateAs, fixtureRoadmapPath, ok } from './helpers';

const [cc1002Roadmap] = fixtureRoadmaps;

const fixture = {
  daniela: developmentFixtureIds.daniela,
  nicolas: developmentFixtureIds.nicolas,
  cc1002StudentWithoutProgress: '20000000-0000-4000-8000-000000000001',
  cc1002StudentComplete: '20000000-0000-4000-8000-000000000048',
  cc1002: {
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
    hiddenNode: cc1002Roadmap.nodes[12].id,
  },
  ma1001: {
    courseCode: 'MA1001',
    year: 2026,
    semester: 2,
  },
  fi1001Historical: {
    courseCode: 'FI1001',
    year: 2026,
    semester: 1,
  },
  fi1001Current: { courseCode: 'FI1001', year: 2026, semester: 2 },
} as const;

test('the FI1001 catalog exposes a closed four-edition lineage and an empty current offering', async ({
  apiAs,
}) => {
  const api = await apiAs({ id: fixture.daniela });
  const history = await (await ok(await api.get('/api/FI1001/versions'))).json();
  expect(history.horizon).toEqual({ year: 2026, semester: 2 });
  expect(history.versions).toMatchObject([
    {
      year: 2026,
      semester: 1,
      closedAt: expect.any(String),
      origin: { kind: 'COPY', year: 2025, semester: 2 },
      creator: { name: 'Daniela Rojas Mella' },
      teachingStaff: [
        { name: 'Daniela Rojas Mella', institutionalPosition: 'COURSE_PROFESSOR' },
        { name: 'Martín Vega Ríos', institutionalPosition: 'TEACHING_ASSISTANT' },
      ],
    },
    {
      year: 2025,
      semester: 2,
      closedAt: expect.any(String),
      origin: { kind: 'COPY', year: 2025, semester: 1 },
      creator: { name: 'Andrés Silva Pérez' },
      teachingStaff: [
        { name: 'Daniela Rojas Mella', institutionalPosition: 'COURSE_PROFESSOR' },
        { name: 'Sofía Herrera Díaz', institutionalPosition: 'AUXILIARY_PROFESSOR' },
      ],
    },
    { year: 2025, semester: 1, origin: { kind: 'COPY', year: 2024, semester: 2 } },
    { year: 2024, semester: 2, origin: { kind: 'EMPTY' } },
  ]);
  const departed = await apiAs({ id: developmentFixtureIds.departedCreator });
  const overview = await (await ok(await departed.get('/api/academic-overview'))).json();
  expect(overview.offerings).not.toContainEqual(
    expect.objectContaining({ courseCode: 'FI1001', year: 2025, semester: 2 }),
  );
  for (const [year, semester] of [
    [2024, 2],
    [2025, 1],
    [2025, 2],
    [2026, 1],
  ]) {
    const version = await (
      await ok(await api.get(`/api/FI1001/versions/${year}/${semester}`))
    ).json();
    expect(version.nodes).toHaveLength(15);
    expect(
      version.nodes.every(
        (node: { isTeacherBlocked: boolean; teacherUnlockOn?: string }) =>
          node.isTeacherBlocked === false && !node.teacherUnlockOn,
      ),
    ).toBe(true);
    expect(version.nodes.filter((node: { isVisible: boolean }) => !node.isVisible)).toHaveLength(1);
    expect(version.dependencies.length).toBeGreaterThan(0);
    expect(version.nodeTypes).toContainEqual(expect.objectContaining({ isPredefined: false }));
    const file = version.nodes
      .flatMap((node: { resources: { type: string; url: string }[] }) => node.resources)
      .find((resource: { type: string }) => resource.type === 'FILE');
    expect(file).toBeTruthy();
    expect((await (await ok(await api.get(file.url))).body()).byteLength).toBeGreaterThan(0);
  }
  await ok(await api.get(fixtureRoadmapPath(fixture.fi1001Current)), 404);
});

function hasCycle(
  nodeIds: readonly string[],
  dependencies: readonly { sourceNodeId: string; targetNodeId: string }[],
) {
  const incoming = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const { sourceNodeId, targetNodeId } of dependencies) {
    incoming.set(targetNodeId, (incoming.get(targetNodeId) ?? 0) + 1);
    outgoing.get(sourceNodeId)?.push(targetNodeId);
  }
  const queue = nodeIds.filter((id) => incoming.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    visited += 1;
    for (const targetId of outgoing.get(nodeId) ?? []) {
      const remaining = (incoming.get(targetId) ?? 0) - 1;
      incoming.set(targetId, remaining);
      if (remaining === 0) queue.push(targetId);
    }
  }
  return visited !== nodeIds.length;
}

test('the reset fixture exposes the three complete roadmap scenarios', async ({ apiAs }) => {
  const api = await apiAs({ id: fixture.daniela });

  for (const [offering, course] of [
    [fixture.cc1002, { code: 'CC1002', name: 'Introducción a la Programación' }],
    [fixture.ma1001, { code: 'MA1001', name: 'Introducción al Cálculo' }],
    [fixture.fi1001Historical, { code: 'FI1001', name: 'Introducción a la Física Newtoniana' }],
  ] as const) {
    const response = await ok(await api.get(fixtureRoadmapPath(offering)));
    const roadmap = await response.json();
    expect(roadmap.course).toEqual(expect.objectContaining(course));
    expect(roadmap.nodes).toHaveLength(15);
    expect(roadmap.nodes.filter((node: { isVisible: boolean }) => !node.isVisible)).toHaveLength(1);
    expect(roadmap.nodeTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Contenido',
          icon: 'BookOpen',
          color: '#024AD8',
          isPredefined: true,
        }),
        expect.objectContaining({
          name: 'Evaluación',
          icon: 'ClipboardCheck',
          color: '#FF5050',
          isPredefined: true,
        }),
        expect.objectContaining({
          name: 'Material extra',
          icon: 'LibraryBig',
          color: '#356373',
          isPredefined: true,
        }),
        expect.objectContaining({ icon: 'Shapes', isPredefined: false }),
      ]),
    );
    const typeCounts = new Map<string, number>();
    for (const node of roadmap.nodes) {
      typeCounts.set(node.nodeTypeId, (typeCounts.get(node.nodeTypeId) ?? 0) + 1);
    }
    expect(
      roadmap.nodeTypes.map((type: { id: string; name: string }) => ({
        name: type.name,
        count: typeCounts.get(type.id) ?? 0,
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: 'Contenido', count: 7 },
        { name: 'Evaluación', count: 3 },
        { name: 'Material extra', count: 3 },
        expect.objectContaining({ count: 2 }),
      ]),
    );
    expect(
      roadmap.nodes.filter((node: { resources: unknown[] }) => node.resources.length > 0),
    ).toHaveLength(9);
    expect(
      hasCycle(
        roadmap.nodes.map((node: { id: string }) => node.id),
        roadmap.dependencies,
      ),
    ).toBe(false);
  }

  await ok(await api.get(fixtureRoadmapPath(fixture.fi1001Current)), 404);
});

test('academic overview and development session retain their public JSON and cookie contracts', async ({
  request,
  apiAs,
  page,
}, testInfo) => {
  const anonymousOverview = await ok(await request.get('/api/academic-overview'), 401);
  await expect(anonymousOverview.json()).resolves.toEqual({
    error: {
      code: 'UNAUTHENTICATED',
      message: 'Debes iniciar sesión para continuar.',
    },
  });

  const api = await apiAs({ id: fixture.cc1002StudentWithoutProgress });
  const overview = await ok(await api.get('/api/academic-overview'));
  await expect(overview.json()).resolves.toEqual(
    expect.objectContaining({
      source: 'LOCAL',
      offerings: expect.arrayContaining([
        expect.objectContaining({
          courseCode: 'CC1002',
          year: 2026,
          semester: 2,
          role: 'STUDENT',
          institutionalPosition: 'STUDENT',
          hasRoadmap: true,
        }),
      ]),
    }),
  );

  const developmentSession = await page.request.post('/api/development/session', {
    data: { userId: fixture.daniela },
  });
  await ok(developmentSession);
  await expect(developmentSession.json()).resolves.toEqual({
    user: { id: fixture.daniela, name: 'Daniela Rojas Mella' },
  });
  expect(developmentSession.headers()['set-cookie']).toContain('next-auth.session-token=');
  expect(developmentSession.headers()['set-cookie']).toContain('HttpOnly');
  expect(developmentSession.headers()['set-cookie']).toMatch(/SameSite=Lax/i);
  expect(developmentSession.headers()['set-cookie']).toContain('Path=/');
  await page.goto('/academic-overview');
  await expect(page.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Introducción a la Programación' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('fixture-academic-overview.png') });
});

test('fixture files are downloadable only through their authorized roadmap representation', async ({
  apiAs,
}) => {
  const teacher = await apiAs({ id: fixture.daniela });
  const student = await apiAs({ id: fixture.cc1002StudentComplete });

  const teacherRoadmap = await ok(await teacher.get(fixtureRoadmapPath(fixture.cc1002)));
  const teacherDto = await teacherRoadmap.json();
  const resources = teacherDto.nodes.flatMap(
    (node: { resources: { title: string; url: string; type: string }[] }) => node.resources,
  );
  const visibleFile = resources.find(
    (resource: { title: string }) => resource.title === 'Guía de variables.pdf',
  );
  const hiddenFile = teacherDto.nodes
    .find((node: { id: string }) => node.id === fixture.cc1002.hiddenNode)
    .resources.find((resource: { type: string }) => resource.type === 'FILE');
  expect(visibleFile).toBeTruthy();
  expect(hiddenFile).toBeTruthy();

  const studentDownload = await ok(await student.get(visibleFile.url));
  expect(studentDownload.headers()['content-type']).toContain('application/pdf');
  expect(studentDownload.headers()['content-disposition']).toContain(
    'Gu%C3%ADa%20de%20variables.pdf',
  );
  expect((await studentDownload.body()).byteLength).toBeGreaterThan(0);

  const teacherDownload = await ok(await teacher.get(hiddenFile.url));
  expect((await teacherDownload.body()).byteLength).toBeGreaterThan(0);
  await ok(await student.get(hiddenFile.url), 404);

  expect(
    resources
      .filter((resource: { type: string }) => resource.type === 'FILE')
      .map((resource: { title: string }) => resource.title.split('.').at(-1)),
  ).toEqual(expect.arrayContaining(['pdf', 'md', 'docx', 'xlsx', 'pptx']));
});

test('fixture progress only completes nodes after every visible prerequisite', async ({
  apiAs,
}) => {
  for (const [offering, userId] of [
    [fixture.cc1002, fixture.cc1002StudentComplete],
    [fixture.ma1001, fixture.cc1002StudentComplete],
    [fixture.fi1001Historical, fixture.nicolas],
  ] as const) {
    const student = await apiAs({ id: userId });
    const response = await ok(await student.get(fixtureRoadmapPath(offering)));
    const roadmap = await response.json();
    const completed = new Set(
      roadmap.nodes
        .filter((node: { isCompleted: boolean }) => node.isCompleted)
        .map((node: { id: string }) => node.id),
    );
    expect(completed.size).toBeGreaterThan(0);
    for (const dependency of roadmap.dependencies.filter((dependency: { targetNodeId: string }) =>
      completed.has(dependency.targetNodeId),
    )) {
      expect(completed).toContain(dependency.sourceNodeId);
    }
  }
});

test('the MA1001 catalog teaching assistant has teaching-staff capabilities', async ({ apiAs }) => {
  const assistant = await apiAs({ id: fixture.nicolas });
  const overview = await assistant.get('/api/academic-overview');
  expect((await overview.json()).offerings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        courseCode: 'MA1001',
        year: 2026,
        semester: 2,
        role: 'TEACHER',
        institutionalPosition: 'TEACHING_ASSISTANT',
      }),
    ]),
  );
  const roadmap = await (await assistant.get(fixtureRoadmapPath(fixture.ma1001))).json();
  expect(roadmap.nodes.some((node: { isVisible: boolean }) => !node.isVisible)).toBe(true);
  expect(roadmap.nodes.some((node: { canComplete?: boolean }) => node.canComplete)).toBe(false);
});

test('every catalog Participation exposes its declared institutional position', async ({
  apiAs,
}) => {
  for (const userId of new Set(
    fixtureParticipations.map((participation) => participation.userId),
  )) {
    const api = await apiAs({ id: userId });
    const { offerings } = await (await api.get('/api/academic-overview')).json();
    for (const participation of fixtureParticipations.filter(
      (participation) => participation.userId === userId && participation.isActive,
    )) {
      const offering = developmentFixtureOfferings.find(
        (offering) => offering.id === participation.courseOfferingId,
      )!;
      expect(offerings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            courseCode: offering.courseCode,
            year: offering.year,
            semester: offering.semester,
            institutionalPosition: participation.institutionalPosition,
          }),
        ]),
      );
    }
  }
});

test('the FI1001 catalog gives teaching staff their creation options and historical horizon', async ({
  apiAs,
  page,
}) => {
  const courseName = 'Introducción a la Física Newtoniana';
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/academic-overview');
  await page.getByRole('button', { name: `Crear roadmap de ${courseName}` }).click();
  const dialog = page.getByRole('dialog', { name: `Crear roadmap de ${courseName}` });
  await expect(dialog.getByRole('radio', { name: 'Roadmap vacío' })).toBeChecked();
  for (const edition of ['Edición 2024-2', 'Edición 2025-1', 'Edición 2025-2', 'Edición 2026-1']) {
    await expect(dialog.getByRole('radio', { name: new RegExp(edition) })).toBeVisible();
    await expect(dialog.getByRole('link', { name: `Ver ${edition}` })).toBeVisible();
  }

  for (const userId of [
    developmentFixtureIds.teachingAssistant,
    developmentFixtureIds.coordinatingProfessor,
  ]) {
    const api = await apiAs({ id: userId });
    for (const data of [{}, { source: { year: 2026, semester: 1 } }]) {
      await ok(await api.post(fixtureRoadmapPath(fixture.fi1001Current), { data }), 403);
    }
    await ok(await api.get(fixtureRoadmapPath(fixture.fi1001Current)), 404);
    await authenticateAs(page.context(), userId);
    await page.goto('/academic-overview');
    await expect(page.getByRole('button', { name: `Crear roadmap de ${courseName}` })).toHaveCount(
      0,
    );
    await page.getByRole('link', { name: `Historial de versiones de ${courseName}` }).click();
    await expect(page.getByRole('listitem', { name: 'Edición 2026-1' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Edición 2025-2' })).toBeVisible();
  }

  const historical = await apiAs({ id: developmentFixtureIds.historicalTeacher });
  const history = await (await ok(await historical.get('/api/FI1001/versions'))).json();
  expect(history.horizon).toEqual({ year: 2025, semester: 2 });
  expect(history.versions.map(({ edition }: { edition: string }) => edition)).toEqual([
    'Edición 2025-2',
    'Edición 2025-1',
    'Edición 2024-2',
  ]);
  await ok(await historical.get('/api/FI1001/versions/2026/1'), 404);
});

test('the FI1001 historical student sees the closed course while versions exclude student data', async ({
  apiAs,
  page,
}) => {
  const student = await apiAs({ id: fixture.nicolas });
  const roadmap = await (
    await ok(await student.get(fixtureRoadmapPath(fixture.fi1001Historical)))
  ).json();
  expect(roadmap.nodes).toHaveLength(14);
  expect(
    roadmap.nodes.every(
      (node: { canComplete: boolean; access: { reason?: string } }) =>
        !node.canComplete && node.access.reason !== 'TEACHER_BLOCK',
    ),
  ).toBe(true);
  await ok(await student.get('/api/FI1001/versions'), 403);
  await ok(await student.get('/api/FI1001/versions/2026/1'), 404);

  const teacher = await apiAs({ id: fixture.daniela });
  const version = await (await ok(await teacher.get('/api/FI1001/versions/2026/1'))).json();
  const serialized = JSON.stringify(version);
  expect(serialized).not.toContain(fixture.nicolas);
  for (const key of ['isCompleted', 'canComplete', 'participants', 'completions', 'progress']) {
    expect(serialized).not.toContain(`"${key}"`);
  }

  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/FI1001/versions/2026/1');
  await expect(page.getByRole('heading', { name: 'Edición 2026-1' })).toBeVisible();
  await page.getByText('Información de la versión', { exact: true }).click();
  await expect(page.getByText('Copiada de la edición 2025-2')).toBeVisible();
  await expect(page.getByText('Martín Vega Ríos · Ayudante')).toBeVisible();
  await expect(page.getByText('Nicolás Fuentes Arancibia')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Completar', exact: true })).toHaveCount(0);
});

test('programming and calculus have distinct closed editions and a copied current roadmap', async ({
  apiAs,
}) => {
  const teacher = await apiAs({ id: fixture.daniela });
  for (const courseCode of ['CC1002', 'MA1001']) {
    const history = await (await ok(await teacher.get(`/api/${courseCode}/versions`))).json();
    expect(history.versions).toMatchObject([
      {
        year: 2026,
        semester: 1,
        origin: { kind: 'COPY', year: 2025, semester: 2 },
        teachingStaff: [
          { institutionalPosition: 'COURSE_PROFESSOR' },
          { institutionalPosition: 'COORDINATING_PROFESSOR' },
          { institutionalPosition: 'TEACHING_ASSISTANT' },
        ],
      },
      { year: 2025, semester: 2, origin: { kind: 'EMPTY' } },
    ]);
    const titles = [];
    for (const [year, semester] of [
      [2025, 2],
      [2026, 1],
    ]) {
      const version = await (
        await ok(await teacher.get(`/api/${courseCode}/versions/${year}/${semester}`))
      ).json();
      titles.push(version.nodes.map((node: { title: string }) => node.title).sort());
    }
    expect(titles[0]).not.toEqual(titles[1]);
  }
});
