import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath, sessionCookie } from './helpers';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

async function deleteIfPresent(api: APIRequestContext, path: string | undefined) {
  if (path) await api.delete(path);
}

test('student endpoints conceal prerequisite-blocked nodes without erasing past completion', async ({}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });
  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) },
  });
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];
  const resourceIds: string[] = [];

  try {
    const teacherRoadmap = await teacher.get(roadmapPath());
    expect(teacherRoadmap.status()).toBe(200);
    const nodeTypeId = (await teacherRoadmap.json()).nodeTypes.find(
      (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
    ).id;

    const createNode = async (title: string, positionX: number) => {
      const response = await teacher.post(roadmapPath('/nodes'), {
        data: {
          title,
          description: 'Detalle que no debe filtrarse al estudiante bloqueado.',
          nodeTypeId,
          positionX,
          positionY: 0,
        },
      });
      expect(response.status()).toBe(201);
      const node = (await response.json()).node as { id: string; title: string };
      nodeIds.push(node.id);
      return node;
    };

    const prerequisite = await createNode(uniqueName('Prerequisito'), 0);
    const completedBeforeDependency = await createNode(uniqueName('Completado antes'), 100);
    const descendant = await createNode(uniqueName('Descendiente'), 200);

    const completed = await student.post(
      roadmapPath(`/nodes/${completedBeforeDependency.id}/completion`),
    );
    expect(completed.status()).toBe(200);

    const externalResource = await teacher.post(
      roadmapPath(`/nodes/${completedBeforeDependency.id}/resources`),
      {
        data: { title: 'Enlace privado', url: 'https://example.test/private', type: 'LINK' },
      },
    );
    expect(externalResource.status()).toBe(201);
    resourceIds.push((await externalResource.json()).resource.id);

    const uploadedResource = await teacher.post(
      roadmapPath(`/nodes/${completedBeforeDependency.id}/resources`),
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
    resourceIds.push(fileResource.id);

    for (const [sourceNodeId, targetNodeId] of [
      [prerequisite.id, completedBeforeDependency.id],
      [completedBeforeDependency.id, descendant.id],
    ]) {
      const response = await teacher.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId, targetNodeId },
      });
      expect(response.status()).toBe(201);
      dependencyIds.push((await response.json()).dependency.id);
    }

    const teacherNode = (await (await teacher.get(roadmapPath())).json()).nodes.find(
      (node: { id: string }) => node.id === completedBeforeDependency.id,
    );
    expect(teacherNode).toMatchObject({
      description: 'Detalle que no debe filtrarse al estudiante bloqueado.',
      resources: expect.arrayContaining([expect.objectContaining({ title: 'Enlace privado' })]),
    });

    const blockedRoadmap = await student.get(roadmapPath());
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

    const blockedDescendant = (await (await student.get(roadmapPath())).json()).nodes.find(
      (node: { id: string }) => node.id === descendant.id,
    );
    expect(blockedDescendant.access).toEqual({ status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' });

    const resources = await student.get(
      roadmapPath(`/nodes/${completedBeforeDependency.id}/resources`),
    );
    expect(resources.status()).toBe(403);
    expect((await resources.json()).error.code).toBe('PREREQUISITE_BLOCK');
    const download = await student.get(fileResource.url);
    expect(download.status()).toBe(403);
    expect((await download.json()).error.code).toBe('PREREQUISITE_BLOCK');
    const repeatCompletion = await student.post(
      roadmapPath(`/nodes/${completedBeforeDependency.id}/completion`),
    );
    expect(repeatCompletion.status()).toBe(403);
    expect((await repeatCompletion.json()).error.code).toBe('PREREQUISITE_BLOCK');
    const descendantCompletion = await student.post(
      roadmapPath(`/nodes/${descendant.id}/completion`),
    );
    expect(descendantCompletion.status()).toBe(403);
    expect((await descendantCompletion.json()).error.code).toBe('PREREQUISITE_BLOCK');

    const prerequisiteDependencyId = dependencyIds.shift();
    await deleteIfPresent(
      teacher,
      prerequisiteDependencyId && roadmapPath(`/dependencies/${prerequisiteDependencyId}`),
    );
    const releasedRoadmap = await student.get(roadmapPath());
    const releasedNode = (await releasedRoadmap.json()).nodes.find(
      (node: { id: string }) => node.id === completedBeforeDependency.id,
    );
    expect(releasedNode).toMatchObject({
      isCompleted: true,
      resources: expect.arrayContaining([expect.objectContaining({ title: 'Enlace privado' })]),
    });
  } finally {
    for (const dependencyId of dependencyIds)
      await deleteIfPresent(teacher, roadmapPath(`/dependencies/${dependencyId}`));
    for (const resourceId of resourceIds)
      await deleteIfPresent(teacher, roadmapPath(`/resources/${resourceId}`));
    for (const nodeId of nodeIds) await deleteIfPresent(teacher, roadmapPath(`/nodes/${nodeId}`));
    await Promise.all([teacher.dispose(), student.dispose()]);
  }
});

test('student roadmap shows effective block reasons and restores a completed node after release', async ({
  page,
}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });
  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.cc1002StudentWithoutProgress) },
  });
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];
  const resourceIds: string[] = [];

  try {
    const teacherRoadmap = await teacher.get(roadmapPath());
    expect(teacherRoadmap.status()).toBe(200);
    const nodeTypeId = (await teacherRoadmap.json()).nodeTypes.find(
      (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
    ).id;
    const createNode = async (title: string, positionX: number) => {
      const response = await teacher.post(roadmapPath('/nodes'), {
        data: {
          title,
          description: 'Descripción protegida del nodo.',
          nodeTypeId,
          positionX,
          positionY: 600,
        },
      });
      expect(response.status()).toBe(201);
      const node = (await response.json()).node as { id: string; title: string };
      nodeIds.push(node.id);
      return node;
    };

    const prerequisite = await createNode(uniqueName('Prerrequisito visual'), 0);
    const completedTarget = await createNode(uniqueName('Nodo completado bloqueado'), 500);
    const prerequisiteTarget = await createNode(uniqueName('Nodo con prerrequisitos'), 1000);

    const completion = await student.post(roadmapPath(`/nodes/${completedTarget.id}/completion`));
    expect(completion.status()).toBe(200);

    const resource = await teacher.post(roadmapPath(`/nodes/${completedTarget.id}/resources`), {
      data: {
        title: 'Recurso protegido',
        url: 'https://example.test/protected',
        type: 'LINK',
      },
    });
    expect(resource.status()).toBe(201);
    resourceIds.push((await resource.json()).resource.id);

    for (const targetNodeId of [completedTarget.id, prerequisiteTarget.id]) {
      const dependency = await teacher.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId: prerequisite.id, targetNodeId },
      });
      expect(dependency.status()).toBe(201);
      dependencyIds.push((await dependency.json()).dependency.id);
    }

    const block = await teacher.post(roadmapPath(`/nodes/${completedTarget.id}/teacher-block`));
    expect(block.status()).toBe(200);

    const studentRoadmap = await student.get(roadmapPath());
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
      roadmapPath(`/nodes/${completedTarget.id}/completion`),
    );
    expect(blockedCompletion.status()).toBe(403);
    expect((await blockedCompletion.json()).error.code).toBe('TEACHER_BLOCK');

    await page.context().clearCookies();
    await authenticateAs(page.context(), fixture.cc1002StudentWithoutProgress);
    await page.goto('/courses/CC1002/2026/2');
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

    const teacherBlockedCard = page.locator(`[data-testid="rf__node-${completedTarget.id}"]`);
    const prerequisiteBlockedCard = page.locator(
      `[data-testid="rf__node-${prerequisiteTarget.id}"]`,
    );
    await expect(teacherBlockedCard).toBeVisible();
    await expect(prerequisiteBlockedCard).toBeVisible();
    await expect(teacherBlockedCard).toContainText('Bloqueado por el equipo docente');
    await expect(prerequisiteBlockedCard).toContainText('Completa los prerrequisitos');
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
    await deleteIfPresent(
      teacher,
      targetDependencyId && roadmapPath(`/dependencies/${targetDependencyId}`),
    );
    const unblock = await teacher.delete(roadmapPath(`/nodes/${completedTarget.id}/teacher-block`));
    expect(unblock.status()).toBe(200);

    await page.reload();
    await expect(teacherBlockedCard).toBeVisible();
    await expect(teacherBlockedCard.getByRole('img', { name: 'Completado' })).toBeVisible();
    await teacherBlockedCard.click();
    await expect(page.getByRole('heading', { name: completedTarget.title })).toBeVisible();
    await expect(page.getByText('Descripción protegida del nodo.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recurso protegido' })).toHaveAttribute(
      'href',
      'https://example.test/protected',
    );
  } finally {
    for (const dependencyId of dependencyIds)
      await deleteIfPresent(teacher, roadmapPath(`/dependencies/${dependencyId}`));
    for (const resourceId of resourceIds)
      await deleteIfPresent(teacher, roadmapPath(`/resources/${resourceId}`));
    for (const nodeId of nodeIds) await deleteIfPresent(teacher, roadmapPath(`/nodes/${nodeId}`));
    await Promise.all([teacher.dispose(), student.dispose()]);
  }
});
