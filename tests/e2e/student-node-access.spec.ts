import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { prepareNodeCreator } from './create-node';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

for (const restriction of ['blocked', 'hidden', 'deleted'] as const) {
  test(`a stale student canvas cannot complete a Node ${restriction} after entry`, async ({
    page,
    course,
    apiAs,
  }) => {
    const teacher = await apiAs(course.users.teacher);
    const student = await apiAs(course.users.studentWithoutProgress);
    const creator = await prepareNodeCreator(teacher, course, {
      description: 'Detalle conservado en la vista del estudiante.',
      positionY: 150,
    });
    const node = await creator.createNode(uniqueName('Nodo pendiente'), 350);
    await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
    await page.goto(`${course.pagePath()}?targetNode=${node.id}`);
    await expect(page.getByRole('button', { name: 'Completar', exact: true })).toBeEnabled();

    const endpoint = course.apiPath(`/nodes/${node.id}`);
    const restrict = {
      blocked: () => teacher.post(`${endpoint}/teacher-block`),
      hidden: () => teacher.patch(endpoint, { data: { isVisible: false } }),
      deleted: () => teacher.delete(endpoint),
    };
    expect((await restrict[restriction]()).status()).toBe(restriction === 'deleted' ? 204 : 200);
    // A real notice arriving confirms the change reached this tab without a canvas reload.
    await expect(page.getByRole('button', { name: /^Avisos, [1-9]/ })).toBeVisible();
    await expect(page.getByText('Detalle conservado en la vista del estudiante.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const completion = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `${endpoint}/completion`,
    );
    await page.getByRole('button', { name: 'Completar', exact: true }).click();
    expect((await completion).status()).toBe(restriction === 'blocked' ? 403 : 404);
    await expect(
      page.getByRole('alert', {
        name:
          restriction === 'blocked'
            ? 'El equipo docente bloqueó este nodo.'
            : 'El nodo no existe en este roadmap.',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completar', exact: true })).toBeEnabled();
    await expect(page.getByText('Detalle conservado en la vista del estudiante.')).toBeVisible();
    // Re-enter through authorized HTTP: the rejected action created no Completion.
    const current = await student.get(course.apiPath());
    expect(current.status()).toBe(200);
    const currentNode = (await current.json()).nodes.find(
      (candidate: { id: string }) => candidate.id === node.id,
    );
    expect(currentNode?.isCompleted ?? false).toBe(false);
  });
}

test('student endpoints conceal prerequisite-blocked nodes without erasing past completion', async ({
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const dependencyIds: string[] = [];

  const { nodeTypeId, createNode } = await prepareNodeCreator(teacher, course, {
    description: 'Detalle que no debe filtrarse al estudiante bloqueado.',
  });

  const prerequisite = await createNode(uniqueName('Prerequisito'), 0);
  const completedBeforeDependency = await createNode(uniqueName('Completado antes'), 100);
  const descendant = await createNode(uniqueName('Descendiente'), 200);

  const completed = await student.post(
    course.apiPath(`/nodes/${completedBeforeDependency.id}/completion`),
  );
  expect(completed.status()).toBe(200);

  const externalResource = await teacher.post(
    course.apiPath(`/nodes/${completedBeforeDependency.id}/resources`),
    {
      data: { title: 'Enlace privado', url: 'https://example.test/private', type: 'LINK' },
    },
  );
  expect(externalResource.status()).toBe(201);

  const uploadedResource = await teacher.post(
    course.apiPath(`/nodes/${completedBeforeDependency.id}/resources`),
    {
      multipart: {
        file: {
          name: 'privado.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 private'),
        },
      },
    },
  );
  expect(uploadedResource.status()).toBe(201);
  const fileResource = (await uploadedResource.json()).resource as { id: string; url: string };

  for (const [sourceNodeId, targetNodeId] of [
    [prerequisite.id, completedBeforeDependency.id],
    [completedBeforeDependency.id, descendant.id],
  ]) {
    const response = await teacher.post(course.apiPath('/dependencies'), {
      data: { sourceNodeId, targetNodeId },
    });
    expect(response.status()).toBe(201);
    dependencyIds.push((await response.json()).dependency.id);
  }

  const teacherNode = (await (await teacher.get(course.apiPath())).json()).nodes.find(
    (node: { id: string }) => node.id === completedBeforeDependency.id,
  );
  expect(teacherNode).toMatchObject({
    description: 'Detalle que no debe filtrarse al estudiante bloqueado.',
    resources: expect.arrayContaining([expect.objectContaining({ title: 'Enlace privado' })]),
  });

  const blockedRoadmap = await student.get(course.apiPath());
  expect(blockedRoadmap.status()).toBe(200);
  const blockedNode = (await blockedRoadmap.json()).nodes.find(
    (node: { id: string }) => node.id === completedBeforeDependency.id,
  );
  expect(blockedNode).toEqual({
    id: completedBeforeDependency.id,
    title: completedBeforeDependency.title,
    nodeTypeId,
    positionX: 100,
    positionY: 0,
    access: { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' },
  });

  const blockedDescendant = (await (await student.get(course.apiPath())).json()).nodes.find(
    (node: { id: string }) => node.id === descendant.id,
  );
  expect(blockedDescendant.access).toEqual({ status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' });

  const resources = await student.get(
    course.apiPath(`/nodes/${completedBeforeDependency.id}/resources`),
  );
  expect(resources.status()).toBe(403);
  expect((await resources.json()).error.code).toBe('PREREQUISITE_BLOCK');
  const download = await student.get(fileResource.url);
  expect(download.status()).toBe(403);
  expect((await download.json()).error.code).toBe('PREREQUISITE_BLOCK');
  const repeatCompletion = await student.post(
    course.apiPath(`/nodes/${completedBeforeDependency.id}/completion`),
  );
  expect(repeatCompletion.status()).toBe(403);
  expect((await repeatCompletion.json()).error.code).toBe('PREREQUISITE_BLOCK');
  const descendantCompletion = await student.post(
    course.apiPath(`/nodes/${descendant.id}/completion`),
  );
  expect(descendantCompletion.status()).toBe(403);
  expect((await descendantCompletion.json()).error.code).toBe('PREREQUISITE_BLOCK');

  const prerequisiteDependencyId = dependencyIds.shift();
  expect(
    (await teacher.delete(course.apiPath(`/dependencies/${prerequisiteDependencyId}`))).status(),
  ).toBe(204);
  const releasedRoadmap = await student.get(course.apiPath());
  const releasedNode = (await releasedRoadmap.json()).nodes.find(
    (node: { id: string }) => node.id === completedBeforeDependency.id,
  );
  expect(releasedNode).toMatchObject({
    isCompleted: true,
    resources: expect.arrayContaining([expect.objectContaining({ title: 'Enlace privado' })]),
  });
});

test('student roadmap shows effective block reasons and restores a completed node after release', async ({
  page,
  course,
  apiAs,
}) => {
  const teacher = await apiAs(course.users.teacher);
  const student = await apiAs(course.users.studentWithoutProgress);
  const dependencyIds: string[] = [];

  const { nodeTypeId, createNode } = await prepareNodeCreator(teacher, course, {
    description: 'Descripción protegida del nodo.',
    positionY: 600,
  });

  const prerequisite = await createNode(uniqueName('Prerrequisito visual'), 0);
  const completedTarget = await createNode(uniqueName('Nodo completado bloqueado'), 500);
  const prerequisiteTarget = await createNode(uniqueName('Nodo con prerrequisitos'), 1000);

  const completion = await student.post(course.apiPath(`/nodes/${completedTarget.id}/completion`));
  expect(completion.status()).toBe(200);

  const resource = await teacher.post(course.apiPath(`/nodes/${completedTarget.id}/resources`), {
    data: {
      title: 'Recurso protegido',
      url: 'https://example.test/protected',
      type: 'LINK',
    },
  });
  expect(resource.status()).toBe(201);

  for (const targetNodeId of [completedTarget.id, prerequisiteTarget.id]) {
    const dependency = await teacher.post(course.apiPath('/dependencies'), {
      data: { sourceNodeId: prerequisite.id, targetNodeId },
    });
    expect(dependency.status()).toBe(201);
    dependencyIds.push((await dependency.json()).dependency.id);
  }

  const block = await teacher.post(course.apiPath(`/nodes/${completedTarget.id}/teacher-block`));
  expect(block.status()).toBe(200);

  const studentRoadmap = await student.get(course.apiPath());
  expect(studentRoadmap.status()).toBe(200);
  const studentNodes = (await studentRoadmap.json()).nodes as Array<{
    id: string;
    access: { status: string; reason?: string };
    description?: string;
    resources?: unknown[];
    isCompleted?: boolean;
  }>;
  expect(studentNodes.find(({ id }) => id === completedTarget.id)).toEqual({
    id: completedTarget.id,
    title: completedTarget.title,
    nodeTypeId,
    positionX: 500,
    positionY: 600,
    access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
  });
  expect(studentNodes.find(({ id }) => id === prerequisiteTarget.id)?.access).toEqual({
    status: 'BLOCKED',
    reason: 'PREREQUISITE_BLOCK',
  });
  const blockedCompletion = await student.post(
    course.apiPath(`/nodes/${completedTarget.id}/completion`),
  );
  expect(blockedCompletion.status()).toBe(403);
  expect((await blockedCompletion.json()).error.code).toBe('TEACHER_BLOCK');

  await page.context().clearCookies();
  await authenticateAs(page.context(), course.users.studentWithoutProgress.id);
  await page.goto(course.pagePath());
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

  const teacherBlockedCard = page.locator(`[data-testid="rf__node-${completedTarget.id}"]`);
  const prerequisiteBlockedCard = page.locator(`[data-testid="rf__node-${prerequisiteTarget.id}"]`);
  await expect(teacherBlockedCard).toBeVisible();
  await expect(prerequisiteBlockedCard).toBeVisible();
  await expect(teacherBlockedCard).not.toContainText('Bloqueado por el equipo docente');
  await expect(prerequisiteBlockedCard).not.toContainText('Completa los prerrequisitos');
  await expect(teacherBlockedCard).toHaveAttribute('aria-disabled', 'true');
  await expect(prerequisiteBlockedCard).toHaveAttribute('aria-disabled', 'true');
  await expect(teacherBlockedCard.locator('[data-slot="roadmap-card"]')).toHaveClass(
    /cursor-not-allowed/,
  );
  await expect(teacherBlockedCard.getByRole('img', { name: 'Bloqueado' })).toBeVisible();
  await expect(prerequisiteBlockedCard.getByRole('img', { name: 'Bloqueado' })).toBeVisible();
  await expect(teacherBlockedCard.getByRole('img', { name: 'Completado' })).toHaveCount(0);
  await expect(teacherBlockedCard.locator('a')).toHaveCount(0);
  await expect(page.getByText('Descripción protegida del nodo.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Recurso protegido' })).toHaveCount(0);

  await teacherBlockedCard.dispatchEvent('click');
  await teacherBlockedCard.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: completedTarget.title })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const targetDependencyId = dependencyIds.shift();
  expect(
    (await teacher.delete(course.apiPath(`/dependencies/${targetDependencyId}`))).status(),
  ).toBe(204);
  const unlockPreview = await teacher.get(
    course.apiPath(`/nodes/${completedTarget.id}/teacher-block?operation=UNBLOCK`),
  );
  expect(unlockPreview.status()).toBe(200);
  const { version } = await unlockPreview.json();
  const unblock = await teacher.delete(
    course.apiPath(`/nodes/${completedTarget.id}/teacher-block`),
    {
      headers: { 'x-teacher-block-preview': version },
    },
  );
  expect(unblock.status()).toBe(200);

  await expect
    .poll(async () => {
      const response = await student.get(`/api/notifications?nodeId=${completedTarget.id}`);
      return (await response.json()).notifications.some(
        (notice: { data: { changeKind: string } }) => notice.data.changeKind === 'node-available',
      );
    })
    .toBe(true);
  await page.reload();
  const summary = page.getByRole('dialog', {
    name: `Cambios en el Roadmap de ${course.courseCode}`,
  });
  await expect(summary).toBeVisible();
  await summary.getByRole('button', { name: 'Entendido' }).click();
  await expect(teacherBlockedCard).toBeVisible();
  await expect(teacherBlockedCard.getByRole('img', { name: 'Completado' })).toBeVisible();
  await teacherBlockedCard.click();
  await expect(page.getByRole('heading', { name: completedTarget.title })).toBeVisible();
  await expect(page.getByText('Descripción protegida del nodo.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recurso protegido' })).toHaveAttribute(
    'href',
    'https://example.test/protected',
  );
});
