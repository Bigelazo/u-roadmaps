import { expect, request as apiRequest, test } from '@playwright/test';
import { fixture, fixtureRoadmapPath, sessionCookie } from './helpers';

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

test('the reset fixture exposes the three complete roadmap scenarios', async ({}, testInfo) => {
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });

  try {
    for (const [offering, course] of [
      [fixture.cc1002, { code: 'CC1002', name: 'Introducción a la Programación' }],
      [fixture.ma1001, { code: 'MA1001', name: 'Introducción al Cálculo' }],
      [
        fixture.fi1001Historical,
        { code: 'FI1001', name: 'Introducción a la Física Newtoniana' },
      ],
    ] as const) {
      const response = await api.get(fixtureRoadmapPath(offering));
      expect(response.status()).toBe(200);
      const roadmap = await response.json();
      expect(roadmap.course).toEqual(expect.objectContaining(course));
      expect(roadmap.nodes).toHaveLength(15);
      expect(roadmap.nodes.filter((node: { isVisible: boolean }) => !node.isVisible)).toHaveLength(
        1,
      );
      expect(roadmap.nodeTypes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Contenido', isPredefined: true }),
          expect.objectContaining({ name: 'Evaluación', isPredefined: true }),
          expect.objectContaining({ name: 'Material extra', isPredefined: true }),
          expect.objectContaining({ isPredefined: false }),
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

    const withoutRoadmap = await api.get(fixtureRoadmapPath(fixture.fi1001Current));
    expect(withoutRoadmap.status()).toBe(404);
  } finally {
    await api.dispose();
  }
});

test('fixture files are downloadable only through their authorized roadmap representation', async ({}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });
  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.cc1002StudentComplete) },
  });

  try {
    const teacherRoadmap = await teacher.get(fixtureRoadmapPath(fixture.cc1002));
    expect(teacherRoadmap.status()).toBe(200);
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

    const studentDownload = await student.get(visibleFile.url);
    expect(studentDownload.status()).toBe(200);
    expect(studentDownload.headers()['content-type']).toContain('application/pdf');
    expect(studentDownload.headers()['content-disposition']).toContain(
      'Gu%C3%ADa%20de%20variables.pdf',
    );
    expect((await studentDownload.body()).byteLength).toBeGreaterThan(0);

    const teacherDownload = await teacher.get(hiddenFile.url);
    expect(teacherDownload.status()).toBe(200);
    expect((await teacherDownload.body()).byteLength).toBeGreaterThan(0);
    expect((await student.get(hiddenFile.url)).status()).toBe(404);

    expect(
      resources
        .filter((resource: { type: string }) => resource.type === 'FILE')
        .map((resource: { title: string }) => resource.title.split('.').at(-1)),
    ).toEqual(expect.arrayContaining(['pdf', 'md', 'docx', 'xlsx', 'pptx']));
  } finally {
    await Promise.all([teacher.dispose(), student.dispose()]);
  }
});

test('fixture progress only completes nodes after every visible prerequisite', async ({}, testInfo) => {
  for (const [offering, userId] of [
    [fixture.cc1002, fixture.cc1002StudentComplete],
    [fixture.ma1001, fixture.cc1002StudentComplete],
    [fixture.fi1001Historical, fixture.nicolas],
  ] as const) {
    const student = await apiRequest.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      extraHTTPHeaders: { cookie: await sessionCookie(userId) },
    });
    try {
      const response = await student.get(fixtureRoadmapPath(offering));
      expect(response.status()).toBe(200);
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
    } finally {
      await student.dispose();
    }
  }
});
