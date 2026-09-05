import { expect, request as apiRequest, test } from '@playwright/test';
import { fixture, roadmapPath, sessionCookie } from './helpers';

test('teachers persist isolated student-progress simulations without changing student completions', async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const [daniela, nicolas, student] = await Promise.all(
    [fixture.daniela, fixture.nicolas, fixture.cc1002StudentWithoutProgress].map(async (userId) =>
      apiRequest.newContext({
        baseURL,
        extraHTTPHeaders: { cookie: await sessionCookie(userId) },
      }),
    ),
  );
  const simulationPath = roadmapPath('/simulation');

  try {
    expect((await daniela.delete(simulationPath)).status()).toBe(200);
    const [emptySimulation, studentRoadmap] = await Promise.all([
      daniela.get(simulationPath),
      student.get(roadmapPath()),
    ]);
    expect(emptySimulation.status()).toBe(200);
    expect(studentRoadmap.status()).toBe(200);
    expect(await emptySimulation.json()).toEqual(await studentRoadmap.json());

    const simulation = await (await daniela.get(simulationPath)).json();
    const accessibleNode = simulation.nodes.find(
      (node: { access: { status: string }; canComplete?: boolean }) =>
        node.access.status === 'ACCESSIBLE' && node.canComplete,
    ) as { id: string };
    expect(accessibleNode).toBeDefined();

    const completionPath = `${simulationPath}/nodes/${accessibleNode.id}/completion`;
    const completions = await Promise.all(
      Array.from({ length: 4 }, () => daniela.post(completionPath)),
    );
    expect(completions.map((response) => response.status())).toEqual([200, 200, 200, 200]);
    const completionIds = await Promise.all(
      completions.map(async (response) => (await response.json()).completion.id),
    );
    expect(new Set(completionIds).size).toBe(1);

    const [afterCompletion, studentAfterCompletion, nicolasSimulation] = await Promise.all([
      daniela.get(simulationPath),
      student.get(roadmapPath()),
      nicolas.get(simulationPath),
    ]);
    const simulatedNode = (await afterCompletion.json()).nodes.find(
      (node: { id: string }) => node.id === accessibleNode.id,
    );
    expect(simulatedNode).toMatchObject({ isCompleted: true, canComplete: false });
    const studentNode = (await studentAfterCompletion.json()).nodes.find(
      (node: { id: string }) => node.id === accessibleNode.id,
    );
    expect(studentNode).toMatchObject({ isCompleted: false, canComplete: true });
    const nicolasNode = (await nicolasSimulation.json()).nodes.find(
      (node: { id: string }) => node.id === accessibleNode.id,
    );
    expect(nicolasNode).toMatchObject({ isCompleted: false, canComplete: true });

    const hiddenCompletion = await daniela.post(
      `${simulationPath}/nodes/${fixture.cc1002.hiddenNode}/completion`,
    );
    expect(hiddenCompletion.status()).toBe(404);
    expect((await hiddenCompletion.json()).error.code).toBe('NODE_NOT_FOUND');
    expect((await student.post(completionPath)).status()).toBe(403);

    const racedReset = await Promise.all([
      daniela.delete(simulationPath),
      daniela.post(completionPath),
    ]);
    expect(racedReset.map((response) => response.status())).toEqual([200, 200]);
    expect([0, 1]).toContain((await (await daniela.delete(simulationPath)).json()).deletedCount);
    expect(await (await daniela.delete(simulationPath)).json()).toEqual({ deletedCount: 0 });
    const afterReset = await (await daniela.get(simulationPath)).json();
    expect(
      afterReset.nodes.find((node: { id: string }) => node.id === accessibleNode.id),
    ).toMatchObject({
      isCompleted: false,
      canComplete: true,
    });
  } finally {
    await Promise.all([daniela.dispose(), nicolas.dispose(), student.dispose()]);
  }
});
