import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import type { RoadmapDto } from '@/features/roadmap/types';
import type { ResourceInput } from '@/features/roadmap/editor/types';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import { executeWithChangeImpact } from '../support/execute-with-change-impact';

const roadmap = {
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'prerequisite',
      title: 'Prerequisito',
      description: null,
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: true,
      resources: [],
    },
    {
      id: 'selected',
      title: 'Seleccionado',
      description: null,
      nodeTypeId: 'content',
      positionX: 160,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: true,
      resources: [],
    },
    {
      id: 'dependent',
      title: 'Dependiente',
      description: null,
      nodeTypeId: 'content',
      positionX: 320,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: true,
      resources: [],
    },
  ],
  dependencies: [
    {
      id: 'prerequisite-selected',
      sourceNodeId: 'prerequisite',
      targetNodeId: 'selected',
      sourceHandle: 'right',
      targetHandle: 'left',
    },
    {
      id: 'selected-dependent',
      sourceNodeId: 'selected',
      targetNodeId: 'dependent',
      sourceHandle: 'right',
      targetHandle: 'left',
    },
  ],
} satisfies RoadmapDto;

test('sets a Node to the target visibility, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await executeWithChangeImpact(persistence, { kind: 'hide-node', nodeId: 'selected' });
  await executeWithChangeImpact(persistence, { kind: 'hide-node', nodeId: 'selected' });
  const hidden = await persistence.load();
  expect(hidden.nodes).toContainEqual(
    expect.objectContaining({ id: 'selected', isVisible: false, isTeacherBlocked: false }),
  );
  expect(hidden.dependencies).toEqual([]);

  await persistence.execute({ kind: 'show-node', nodeId: 'selected' });
  expect((await persistence.load()).nodes).toContainEqual(
    expect.objectContaining({ id: 'selected', isVisible: true }),
  );
});

test('a confirmed Node unlock unlocks its Change impact and releases a due Scheduled unlock waiting on it', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: roadmap.nodes.map((node) =>
      node.id === 'dependent'
        ? { ...node, teacherUnlockAt: new Date(Date.now() - 60_000).toISOString() }
        : node,
    ),
  });
  const unlock = {
    kind: 'change-teacher-block',
    nodeId: 'selected',
    operation: 'UNBLOCK',
  } as const;

  await expect(persistence.readChangeImpact(unlock)).resolves.toMatchObject({
    mode: 'UPSTREAM',
    nodes: [{ id: 'prerequisite' }, { id: 'selected' }],
  });
  await executeWithChangeImpact(persistence, unlock);

  expect((await persistence.load()).nodes).toEqual(
    roadmap.nodes.map((node) => ({ ...node, isTeacherBlocked: false })),
  );
});

test('rejects a Scheduled unlock that is not in the future, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(
    persistence.execute({
      kind: 'schedule-teacher-unlock',
      nodeId: 'selected',
      unlockAt: '2000-01-01T12:00:00.000Z',
    }),
  ).rejects.toThrow('El desbloqueo programado debe quedar en el futuro.');
});

test('rejects a student Completion of a blocked Node, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap, {
    studentProgress: { completedNodeIds: [] },
  });

  await expect(persistence.execute({ kind: 'complete-node', nodeId: 'selected' })).rejects.toThrow(
    'El equipo docente bloqueó este nodo.',
  );
  expect((await persistence.load()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'selected',
        access: expect.objectContaining({ status: 'BLOCKED' }),
      }),
    ]),
  );
});

const independent = {
  id: 'independent',
  title: 'Independiente',
  description: null,
  nodeTypeId: 'content',
  positionX: 480,
  positionY: 0,
  isVisible: true,
  isTeacherBlocked: false,
  resources: [],
} satisfies RoadmapDto['nodes'][number];

test('refuses to confirm a Change impact that changed since its preview, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const remove = { kind: 'delete-node', nodeId: 'prerequisite' } as const;
  const { version } = await persistence.readChangeImpact(remove);
  await persistence.execute({
    kind: 'delete-dependencies',
    dependencyIds: ['prerequisite-selected'],
  });

  await expect(persistence.execute(remove, version)).rejects.toThrow(
    'El impacto de la eliminación cambió. Revisa y confirma la previsualización actualizada.',
  );
  expect((await persistence.load()).nodes.map(({ id }) => id)).toContain('prerequisite');

  await executeWithChangeImpact(persistence, remove);
  expect((await persistence.load()).nodes.map(({ id }) => id)).not.toContain('prerequisite');
});

test('a confirmed Dependency from a Teacher-blocked Node blocks the Nodes its Change impact lists', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: [...roadmap.nodes, independent],
  });
  const connect = {
    kind: 'create-dependency',
    sourceNodeId: 'dependent',
    targetNodeId: 'independent',
    sourceHandle: 'right',
    targetHandle: 'left',
  } as const;

  expect(await persistence.readChangeImpact(connect)).toMatchObject({
    nodes: [{ id: 'independent', title: 'Independiente' }],
  });
  await executeWithChangeImpact(persistence, connect);

  expect(await persistence.load()).toMatchObject({
    nodes: expect.arrayContaining([
      expect.objectContaining({ id: 'independent', isTeacherBlocked: true }),
    ]),
    dependencies: expect.arrayContaining([
      expect.objectContaining({ sourceNodeId: 'dependent', targetNodeId: 'independent' }),
    ]),
  });
});

test('follows the Node type rules with the messages of production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const workshop = { name: 'Taller', icon: 'Shapes', color: '#024AD8' } as const;
  const retype = (nodeTypeId: string) =>
    persistence.execute({
      kind: 'update-node',
      nodeId: 'selected',
      value: { title: 'Seleccionado', description: '', nodeTypeId },
    });
  await persistence.execute({ kind: 'add-node-type', nodeType: workshop });
  const before = await persistence.load();
  const workshopId = before.nodeTypes.find(({ name }) => name === 'Taller')?.id ?? '';

  await expect(
    persistence.execute({ kind: 'add-node-type', nodeType: { ...workshop, name: ' contenido ' } }),
  ).rejects.toThrow('Ya existe un tipo disponible con ese nombre.');
  await expect(
    persistence.execute({
      kind: 'update-node-type',
      nodeTypeId: workshopId,
      nodeType: { ...workshop, name: 'CONTENIDO' },
    }),
  ).rejects.toThrow('Ya existe un tipo disponible con ese nombre.');
  await expect(
    persistence.execute({
      kind: 'update-node-type',
      nodeTypeId: 'content',
      nodeType: { ...workshop, name: 'Lectura' },
    }),
  ).rejects.toThrow('Los tipos predefinidos son inmutables.');
  await expect(
    persistence.execute({ kind: 'delete-node-type', nodeTypeId: 'content' }),
  ).rejects.toThrow('Los tipos predefinidos son inmutables.');
  await retype(workshopId);
  await expect(
    persistence.execute({ kind: 'delete-node-type', nodeTypeId: workshopId }),
  ).rejects.toThrow('No se puede eliminar un tipo utilizado por nodos.');
  expect((await persistence.load()).nodeTypes).toEqual(before.nodeTypes);

  await retype('content');
  await persistence.execute({ kind: 'delete-node-type', nodeTypeId: workshopId });
  expect((await persistence.load()).nodeTypes.map(({ id }) => id)).toEqual(['content']);
});

test('refuses a Node type that is not available in the Roadmap, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const before = await persistence.load();
  const unavailable = 'El tipo no existe o no está disponible en este roadmap.';

  await expect(
    persistence.execute({
      kind: 'add-node',
      node: { title: 'Nuevo', description: '', nodeTypeId: 'missing', isVisible: true },
      position: { x: 0, y: 0 },
    }),
  ).rejects.toThrow(unavailable);
  await expect(
    persistence.execute({
      kind: 'update-node',
      nodeId: 'selected',
      value: { title: 'Seleccionado', description: '', nodeTypeId: 'missing' },
    }),
  ).rejects.toThrow(unavailable);

  expect(await persistence.load()).toEqual(before);
});

test('never reuses an identifier after a deletion', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({ ...roadmap, dependencies: [] });
  const node = { title: 'Nuevo', description: '', nodeTypeId: 'content', isVisible: true };
  const nodeType = { name: 'Taller', icon: 'Shapes', color: '#024AD8' } as const;
  const link = { title: 'Guía', url: 'https://example.test/guide', type: 'LINK' } as const;
  const created = async () => {
    const roadmapNow = await persistence.load();
    const nodeIds = roadmapNow.nodes.map(({ id }) => id);
    return {
      node: nodeIds.at(-1),
      dependency: roadmapNow.dependencies.at(-1)?.id,
      nodeType: roadmapNow.nodeTypes.at(-1)?.id,
      resource: roadmapNow.nodes
        .flatMap((candidate) => ('resources' in candidate ? candidate.resources : []))
        .at(-1)?.id,
    };
  };
  const createAll = async () => {
    await persistence.execute({ kind: 'add-node', node, position: { x: 0, y: 0 } });
    await executeWithChangeImpact(persistence, {
      kind: 'create-dependency',
      sourceNodeId: 'prerequisite',
      targetNodeId: 'dependent',
      sourceHandle: 'right',
      targetHandle: 'left',
    });
    await persistence.execute({ kind: 'add-node-type', nodeType });
    await persistence.execute({ kind: 'add-resource', nodeId: 'selected', resource: link });
    return created();
  };
  const deleteAll = async (ids: Awaited<ReturnType<typeof created>>) => {
    await executeWithChangeImpact(persistence, { kind: 'delete-node', nodeId: ids.node! });
    await persistence.execute({ kind: 'delete-dependencies', dependencyIds: [ids.dependency!] });
    await persistence.execute({ kind: 'delete-node-type', nodeTypeId: ids.nodeType! });
    await persistence.execute({ kind: 'delete-resource', resourceId: ids.resource! });
  };

  const first = await createAll();
  await deleteAll(first);
  const second = await createAll();

  for (const kind of ['node', 'dependency', 'nodeType', 'resource'] as const) {
    expect(second[kind]).toEqual(expect.any(String));
    expect(second[kind]).not.toBe(first[kind]);
  }
});

test('places a created Node at its created-node position and resolves with its identifier', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap, {
    createdNodePosition: { x: 960, y: 360 },
  });
  const node = { title: 'Nuevo', description: '', nodeTypeId: 'content', isVisible: true };

  const created = await persistence.execute({ kind: 'add-node', node, position: { x: 0, y: 0 } });

  expect(created).toEqual({ createdNodeId: expect.any(String) });
  expect((await persistence.load()).nodes).toContainEqual(
    expect.objectContaining({ id: created?.createdNodeId, positionX: 960, positionY: 360 }),
  );
});

test('presents a Node whose Node type is missing with the shared unknown Node type', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({ ...roadmap, nodeTypes: [] });

  expect(
    (await persistence.readChangeImpact({ kind: 'delete-node', nodeId: 'selected' })).node.nodeType,
  ).toEqual(unknownNodeType);
});

test('lists the Resources of a deletion Change impact by title, as production does', async () => {
  const link = (id: string, title: string) =>
    ({ id, title, url: 'https://example.com', type: 'LINK' }) as const;
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: roadmap.nodes.map((node) =>
      node.id === 'selected'
        ? { ...node, resources: [link('slides', 'Presentación'), link('guide', 'Guía')] }
        : node,
    ),
  });

  expect(
    (await persistence.readChangeImpact({ kind: 'delete-node', nodeId: 'selected' })).resources,
  ).toEqual([
    { id: 'guide', title: 'Guía' },
    { id: 'slides', title: 'Presentación' },
  ]);
});

test('refuses a non-Link external Resource with the message of production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(
    persistence.execute({
      kind: 'add-resource',
      nodeId: 'selected',
      resource: { title: 'External', url: 'https://example.test/file.pdf', type: 'FILE' },
    }),
  ).rejects.toThrow('Los recursos externos deben ser Enlaces. Para un Archivo, sube sus bytes.');
  expect(await persistence.load()).toEqual(roadmap);
});

test('Practice resources preserve File ownership and permit Link edits', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const update = (resourceId: string, resource: ResourceInput) =>
    persistence.execute({ kind: 'update-resource', resourceId, resource });
  const resources = async () =>
    (await persistence.load()).nodes.flatMap((node) => ('resources' in node ? node.resources : []));
  await persistence.execute({
    kind: 'upload-resource',
    nodeId: 'selected',
    file: new File(['bytes'], 'guide.pdf'),
  });
  const file = (await resources())[0];
  for (const changes of [
    { ...file, type: 'LINK' as const },
    { ...file, url: 'https://example.test/replaced' },
  ])
    await expect(update(file.id, changes)).rejects.toThrow();
  await update(file.id, { ...file, title: 'Renamed.pdf' });
  await persistence.execute({
    kind: 'add-resource',
    nodeId: 'selected',
    resource: { title: 'Video', url: 'https://example.test/video', type: 'LINK' },
  });
  const renamed = await resources();
  expect(renamed).toContainEqual({ ...file, title: 'Renamed.pdf' });
  const link = renamed.find((resource) => resource.type === 'LINK')!;
  await expect(update(link.id, { ...link, type: 'FILE' })).rejects.toThrow();
  await update(link.id, { ...link, title: 'Revised', url: 'https://example.test/revised' });
  expect(await resources()).toContainEqual({
    ...link,
    title: 'Revised',
    url: 'https://example.test/revised',
  });
});

test('refuses to delete a Dependency that is not in the Roadmap', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(
    persistence.execute({ kind: 'delete-dependencies', dependencyIds: ['missing'] }),
  ).rejects.toThrow('La dependencia no existe en este roadmap.');

  expect((await persistence.load()).dependencies.map(({ id }) => id)).toEqual([
    'prerequisite-selected',
    'selected-dependent',
  ]);
});
