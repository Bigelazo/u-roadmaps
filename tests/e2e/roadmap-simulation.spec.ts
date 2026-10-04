import { expect, test } from './fixtures';

test('teachers persist isolated student-progress simulations without changing student completions', async ({
  course,
  apiAs,
}) => {
  const [teacher, teachingAssistant, student] = await Promise.all([
    apiAs(course.users.teacher),
    apiAs(course.users.teachingAssistant),
    apiAs(course.users.studentWithoutProgress),
  ]);
  const simulationPath = course.apiPath('/simulation');

  expect((await teacher.delete(simulationPath)).status()).toBe(200);
  const [emptySimulation, studentRoadmap] = await Promise.all([
    teacher.get(simulationPath),
    student.get(course.apiPath()),
  ]);
  expect(emptySimulation.status()).toBe(200);
  expect(studentRoadmap.status()).toBe(200);
  expect(await emptySimulation.json()).toEqual(await studentRoadmap.json());

  const simulation = await (await teacher.get(simulationPath)).json();
  const accessibleNode = simulation.nodes.find(
    (node: { access: { status: string }; canComplete?: boolean }) =>
      node.access.status === 'ACCESSIBLE' && node.canComplete,
  ) as { id: string };
  expect(accessibleNode).toBeDefined();

  const completionPath = `${simulationPath}/nodes/${accessibleNode.id}/completion`;
  const completions = await Promise.all(
    Array.from({ length: 4 }, () => teacher.post(completionPath)),
  );
  expect(completions.map((response) => response.status())).toEqual([200, 200, 200, 200]);
  const completionIds = await Promise.all(
    completions.map(async (response) => (await response.json()).completion.id),
  );
  expect(new Set(completionIds).size).toBe(1);

  const [afterCompletion, studentAfterCompletion, teachingAssistantSimulation] = await Promise.all([
    teacher.get(simulationPath),
    student.get(course.apiPath()),
    teachingAssistant.get(simulationPath),
  ]);
  const simulatedNode = (await afterCompletion.json()).nodes.find(
    (node: { id: string }) => node.id === accessibleNode.id,
  );
  expect(simulatedNode).toMatchObject({ isCompleted: true, canComplete: false });
  const studentNode = (await studentAfterCompletion.json()).nodes.find(
    (node: { id: string }) => node.id === accessibleNode.id,
  );
  expect(studentNode).toMatchObject({ isCompleted: false, canComplete: true });
  const teachingAssistantNode = (await teachingAssistantSimulation.json()).nodes.find(
    (node: { id: string }) => node.id === accessibleNode.id,
  );
  expect(teachingAssistantNode).toMatchObject({ isCompleted: false, canComplete: true });

  const hiddenCompletion = await teacher.post(
    `${simulationPath}/nodes/${course.nodes.hidden}/completion`,
  );
  expect(hiddenCompletion.status()).toBe(404);
  expect((await hiddenCompletion.json()).error.code).toBe('NODE_NOT_FOUND');
  expect((await student.post(completionPath)).status()).toBe(403);

  const racedReset = await Promise.all([
    teacher.delete(simulationPath),
    teacher.post(completionPath),
  ]);
  expect(racedReset.map((response) => response.status())).toEqual([200, 200]);
  expect([0, 1]).toContain((await (await teacher.delete(simulationPath)).json()).deletedCount);
  expect(await (await teacher.delete(simulationPath)).json()).toEqual({ deletedCount: 0 });
  const afterReset = await (await teacher.get(simulationPath)).json();
  expect(
    afterReset.nodes.find((node: { id: string }) => node.id === accessibleNode.id),
  ).toMatchObject({
    isCompleted: false,
    canComplete: true,
  });
});
