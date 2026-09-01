import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';
import { fixture, roadmapPath, sessionCookie } from './helpers';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

async function deleteIfPresent(api: APIRequestContext, path: string | undefined) {
  if (path) await api.delete(path);
}

test('hiding a node previews and removes every incident dependency atomically', async ({}, testInfo) => {
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
  let resourceId: string | undefined;

  try {
    const roadmap = await teacher.get(roadmapPath());
    expect(roadmap.status()).toBe(200);
    const nodeTypeId = (await roadmap.json()).nodeTypes.find(
      (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
    ).id;
    const createNode = async (title: string, positionX: number) => {
      const response = await teacher.post(roadmapPath('/nodes'), {
        data: {
          title,
          description: 'Contenido que se conserva al ocultar.',
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
    const incomingA = await createNode(uniqueName('Entrada A'), 0);
    const incomingB = await createNode(uniqueName('Entrada B'), 100);
    const selected = await createNode(uniqueName('Nodo ocultable'), 200);
    const outgoingA = await createNode(uniqueName('Salida A'), 300);
    const outgoingB = await createNode(uniqueName('Salida B'), 400);

    const completion = await student.post(roadmapPath(`/nodes/${selected.id}/completion`));
    expect(completion.status()).toBe(200);
    const resource = await teacher.post(roadmapPath(`/nodes/${selected.id}/resources`), {
      data: {
        title: 'Recurso conservado',
        url: 'https://example.test/conservado',
        type: 'LINK',
      },
    });
    expect(resource.status()).toBe(201);
    resourceId = (await resource.json()).resource.id;

    for (const [sourceNodeId, targetNodeId] of [
      [incomingA.id, selected.id],
      [incomingB.id, selected.id],
      [selected.id, outgoingA.id],
      [selected.id, outgoingB.id],
    ]) {
      const response = await teacher.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId, targetNodeId },
      });
      expect(response.status()).toBe(201);
      dependencyIds.push((await response.json()).dependency.id);
    }

    const block = await teacher.post(roadmapPath(`/nodes/${selected.id}/teacher-block`));
    expect(block.status()).toBe(200);

    const preview = await teacher.get(roadmapPath(`/nodes/${selected.id}?operation=HIDE`));
    expect(preview.status()).toBe(200);
    expect((await preview.json()).dependencies).toEqual(
      expect.arrayContaining(
        dependencyIds.map((id, index) => ({
          id,
          sourceNodeId: [incomingA.id, incomingB.id, selected.id, selected.id][index],
          targetNodeId: [selected.id, selected.id, outgoingA.id, outgoingB.id][index],
        })),
      ),
    );

    const hidden = await teacher.patch(roadmapPath(`/nodes/${selected.id}`), {
      data: { isVisible: false },
    });
    expect(hidden.status()).toBe(200);
    const hiddenBody = await hidden.json();
    expect(hiddenBody.node).toMatchObject({
      id: selected.id,
      isVisible: false,
      isTeacherBlocked: false,
    });
    expect(hiddenBody.dependencies).toEqual(
      expect.arrayContaining(
        dependencyIds.map((id, index) => ({
          id,
          sourceNodeId: [incomingA.id, incomingB.id, selected.id, selected.id][index],
          targetNodeId: [selected.id, selected.id, outgoingA.id, outgoingB.id][index],
        })),
      ),
    );

    const teacherAfterHide = await teacher.get(roadmapPath());
    const teacherDtoAfterHide = await teacherAfterHide.json();
    expect(teacherDtoAfterHide.dependencies).not.toEqual(
      expect.arrayContaining(dependencyIds.map((id) => expect.objectContaining({ id }))),
    );
    expect(
      teacherDtoAfterHide.nodes.find((node: { id: string }) => node.id === selected.id),
    ).toMatchObject({
      isVisible: false,
      isTeacherBlocked: false,
      description: 'Contenido que se conserva al ocultar.',
      resources: [expect.objectContaining({ title: 'Recurso conservado' })],
    });
    const studentAfterHide = await student.get(roadmapPath());
    expect((await studentAfterHide.json()).nodes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: selected.id })]),
    );

    const shown = await teacher.patch(roadmapPath(`/nodes/${selected.id}`), {
      data: { isVisible: true },
    });
    expect(shown.status()).toBe(200);
    expect((await shown.json()).node).toMatchObject({
      id: selected.id,
      isVisible: true,
      isTeacherBlocked: false,
    });

    const studentAfterShow = await student.get(roadmapPath());
    const studentNode = (await studentAfterShow.json()).nodes.find(
      (node: { id: string }) => node.id === selected.id,
    );
    expect(studentNode).toMatchObject({
      id: selected.id,
      isCompleted: true,
      description: 'Contenido que se conserva al ocultar.',
      resources: [expect.objectContaining({ title: 'Recurso conservado' })],
      access: { status: 'ACCESSIBLE' },
    });
    expect((await studentAfterShow.json()).dependencies).not.toEqual(
      expect.arrayContaining(dependencyIds.map((id) => expect.objectContaining({ id }))),
    );
  } finally {
    for (const dependencyId of dependencyIds)
      await deleteIfPresent(teacher, roadmapPath(`/dependencies/${dependencyId}`));
    await deleteIfPresent(teacher, resourceId && roadmapPath(`/resources/${resourceId}`));
    for (const nodeId of nodeIds) await deleteIfPresent(teacher, roadmapPath(`/nodes/${nodeId}`));
    await Promise.all([teacher.dispose(), student.dispose()]);
  }
});

test('connecting from a teacher-blocked branch previews and persists descendant blocks', async ({}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];

  try {
    const roadmap = await teacher.get(roadmapPath());
    expect(roadmap.status()).toBe(200);
    const nodeTypeId = (await roadmap.json()).nodeTypes.find(
      (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
    ).id;
    const createNode = async (title: string, positionX: number) => {
      const response = await teacher.post(roadmapPath('/nodes'), {
        data: { title, nodeTypeId, positionX, positionY: 0 },
      });
      expect(response.status()).toBe(201);
      const node = (await response.json()).node as { id: string; title: string };
      nodeIds.push(node.id);
      return node;
    };
    const blockedSource = await createNode(uniqueName('Rama bloqueada'), 0);
    const target = await createNode(uniqueName('Destino nuevo'), 120);
    const descendant = await createNode(uniqueName('Descendiente nuevo'), 240);
    const finalDescendant = await createNode(uniqueName('Último descendiente'), 360);

    for (const [sourceNodeId, targetNodeId] of [
      [target.id, descendant.id],
      [descendant.id, finalDescendant.id],
    ]) {
      const response = await teacher.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId, targetNodeId },
      });
      expect(response.status()).toBe(201);
      dependencyIds.push((await response.json()).dependency.id);
    }

    const block = await teacher.post(roadmapPath(`/nodes/${blockedSource.id}/teacher-block`));
    expect(block.status()).toBe(200);

    const preview = await teacher.get(
      roadmapPath(`/dependencies?sourceNodeId=${blockedSource.id}&targetNodeId=${target.id}`),
    );
    expect(preview.status()).toBe(200);
    expect((await preview.json()).nodes).toEqual(
      expect.arrayContaining([
        { id: target.id, title: target.title },
        { id: descendant.id, title: descendant.title },
        { id: finalDescendant.id, title: finalDescendant.title },
      ]),
    );

    const dependency = await teacher.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: blockedSource.id, targetNodeId: target.id },
    });
    expect(dependency.status()).toBe(201);
    const dependencyBody = await dependency.json();
    dependencyIds.push(dependencyBody.dependency.id);
    expect(dependencyBody.nodes).toEqual(
      expect.arrayContaining([
        { id: target.id, title: target.title },
        { id: descendant.id, title: descendant.title },
        { id: finalDescendant.id, title: finalDescendant.title },
      ]),
    );

    const blockedRoadmap = await teacher.get(roadmapPath());
    const blockedByNodeId = new Map(
      (await blockedRoadmap.json()).nodes.map((node: { id: string; isTeacherBlocked: boolean }) => [
        node.id,
        node.isTeacherBlocked,
      ]),
    );
    expect(blockedByNodeId.get(blockedSource.id)).toBe(true);
    expect(blockedByNodeId.get(target.id)).toBe(true);
    expect(blockedByNodeId.get(descendant.id)).toBe(true);
    expect(blockedByNodeId.get(finalDescendant.id)).toBe(true);

    const deleted = await teacher.delete(
      roadmapPath(`/dependencies/${dependencyBody.dependency.id}`),
    );
    expect(deleted.status()).toBe(204);
    const afterDelete = await teacher.get(roadmapPath());
    const afterDeleteByNodeId = new Map(
      (await afterDelete.json()).nodes.map((node: { id: string; isTeacherBlocked: boolean }) => [
        node.id,
        node.isTeacherBlocked,
      ]),
    );
    expect(afterDeleteByNodeId.get(target.id)).toBe(true);
    expect(afterDeleteByNodeId.get(descendant.id)).toBe(true);
    expect(afterDeleteByNodeId.get(finalDescendant.id)).toBe(true);
  } finally {
    for (const dependencyId of dependencyIds)
      await deleteIfPresent(teacher, roadmapPath(`/dependencies/${dependencyId}`));
    for (const nodeId of nodeIds) await deleteIfPresent(teacher, roadmapPath(`/nodes/${nodeId}`));
    await teacher.dispose();
  }
});

test('a partially hidden diamond loses only incident edges and never infers a replacement', async ({}, testInfo) => {
  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });
  const nodeIds: string[] = [];
  const dependencyIds: string[] = [];

  try {
    const roadmap = await teacher.get(roadmapPath());
    expect(roadmap.status()).toBe(200);
    const nodeTypeId = (await roadmap.json()).nodeTypes.find(
      (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
    ).id;
    const createNode = async (title: string, positionX: number) => {
      const response = await teacher.post(roadmapPath('/nodes'), {
        data: { title, nodeTypeId, positionX, positionY: 0 },
      });
      expect(response.status()).toBe(201);
      const node = (await response.json()).node as { id: string; title: string };
      nodeIds.push(node.id);
      return node;
    };
    const root = await createNode(uniqueName('Diamante raíz'), 0);
    const left = await createNode(uniqueName('Diamante izquierda'), 120);
    const right = await createNode(uniqueName('Diamante derecha'), 240);
    const join = await createNode(uniqueName('Diamante unión'), 360);

    for (const [sourceNodeId, targetNodeId] of [
      [root.id, left.id],
      [root.id, right.id],
      [left.id, join.id],
      [right.id, join.id],
    ]) {
      const response = await teacher.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId, targetNodeId },
      });
      expect(response.status()).toBe(201);
      dependencyIds.push((await response.json()).dependency.id);
    }

    expect((await teacher.post(roadmapPath(`/nodes/${left.id}/teacher-block`))).status()).toBe(200);
    const hidden = await teacher.patch(roadmapPath(`/nodes/${left.id}`), {
      data: { isVisible: false },
    });
    expect(hidden.status()).toBe(200);
    expect((await hidden.json()).node).toMatchObject({
      id: left.id,
      isVisible: false,
      isTeacherBlocked: false,
    });

    const hiddenSourceDependency = await teacher.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: left.id, targetNodeId: root.id },
    });
    expect(hiddenSourceDependency.status()).toBe(403);
    expect((await hiddenSourceDependency.json()).error.code).toBe(
      'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
    );
    const hiddenTargetDependency = await teacher.post(roadmapPath('/dependencies'), {
      data: { sourceNodeId: root.id, targetNodeId: left.id },
    });
    expect(hiddenTargetDependency.status()).toBe(403);
    expect((await hiddenTargetDependency.json()).error.code).toBe(
      'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
    );

    const afterHide = await teacher.get(roadmapPath());
    const dependenciesAfterHide = (await afterHide.json()).dependencies as Array<{
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
    }>;
    expect(dependenciesAfterHide).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: right.id }),
        expect.objectContaining({ sourceNodeId: right.id, targetNodeId: join.id }),
      ]),
    );
    expect(dependenciesAfterHide).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: left.id }),
        expect.objectContaining({ sourceNodeId: left.id, targetNodeId: join.id }),
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: join.id }),
      ]),
    );

    const shown = await teacher.patch(roadmapPath(`/nodes/${left.id}`), {
      data: { isVisible: true },
    });
    expect(shown.status()).toBe(200);
    const afterShow = await teacher.get(roadmapPath());
    const shownDto = await afterShow.json();
    expect(shownDto.nodes.find((node: { id: string }) => node.id === left.id)).toMatchObject({
      isVisible: true,
      isTeacherBlocked: false,
    });
    expect(shownDto.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: right.id }),
        expect.objectContaining({ sourceNodeId: right.id, targetNodeId: join.id }),
      ]),
    );
    expect(shownDto.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: left.id }),
        expect.objectContaining({ sourceNodeId: left.id, targetNodeId: join.id }),
        expect.objectContaining({ sourceNodeId: root.id, targetNodeId: join.id }),
      ]),
    );
  } finally {
    for (const dependencyId of dependencyIds)
      await deleteIfPresent(teacher, roadmapPath(`/dependencies/${dependencyId}`));
    for (const nodeId of nodeIds) await deleteIfPresent(teacher, roadmapPath(`/nodes/${nodeId}`));
    await teacher.dispose();
  }
});
