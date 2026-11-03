import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import type { RoadmapDto } from '@/features/roadmap/types';
import type { ResourceInput } from '@/features/roadmap/editor/types';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import { executeWithChangeImpact } from '../support/execute-with-change-impact';

const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
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

test('models upstream Node unlock through the same Teacher block policy as production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  const unlock = {
    kind: 'change-teacher-block',
    nodeId: 'selected',
    operation: 'UNBLOCK',
  } as const;
  await expect(persistence.readChangeImpact(unlock)).resolves.toMatchObject({
    mode: 'UPSTREAM',
    nodes: [
      { id: 'prerequisite', relation: 'PREREQUISITE' },
      { id: 'selected', relation: 'SELECTED_NODE' },
    ],
  });
  await executeWithChangeImpact(persistence, unlock);

  expect((await persistence.load()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'selected', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'dependent', isTeacherBlocked: true }),
    ]),
  );
});

test('models Branch unlock through the same Teacher block policy as production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: roadmap.nodes.map((node) =>
      node.id === 'prerequisite' ? { ...node, isTeacherBlocked: false } : node,
    ),
  });

  const branchUnlock = {
    kind: 'change-teacher-block',
    nodeId: 'selected',
    operation: 'BRANCH_UNLOCK',
  } as const;
  await expect(persistence.readChangeImpact(branchUnlock)).resolves.toMatchObject({
    mode: 'BRANCH',
    nodes: [
      { id: 'selected', relation: 'SELECTED_NODE' },
      { id: 'dependent', relation: 'DEPENDENT' },
    ],
  });

  await executeWithChangeImpact(persistence, branchUnlock);
  expect((await persistence.load()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'selected', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'dependent', isTeacherBlocked: false }),
    ]),
  );
});

test('rejects a Scheduled unlock that is not after today, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(
    persistence.execute({
      kind: 'schedule-teacher-unlock',
      nodeId: 'selected',
      unlockOn: '2000-01-01',
    }),
  ).rejects.toThrow('La fecha de desbloqueo debe ser posterior a hoy.');
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

const staleMessage = (impact: string) =>
  `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`;

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

test('versions each Change impact by its content, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: [...roadmap.nodes, independent],
  });
  const hide = (nodeId: string) => persistence.readChangeImpact({ kind: 'hide-node', nodeId });
  const first = await hide('selected');

  expect(await hide('selected')).toEqual(first);
  expect((await hide('prerequisite')).version).not.toBe(first.version);
  await executeWithChangeImpact(persistence, {
    kind: 'create-dependency',
    sourceNodeId: 'independent',
    targetNodeId: 'selected',
    sourceHandle: 'right',
    targetHandle: 'left',
  });
  expect((await hide('selected')).version).not.toBe(first.version);
});

test('rejects confirming a hide, a Dependency, a deletion or a Teacher block whose Change impact changed', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: [...roadmap.nodes, independent, { ...independent, id: 'later', title: 'Posterior' }],
  });
  const link = (sourceNodeId: string, targetNodeId: string) =>
    ({
      kind: 'create-dependency',
      sourceNodeId,
      targetNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
    }) as const;
  const hide = { kind: 'hide-node', nodeId: 'dependent' } as const;
  const connect = link('selected', 'independent');
  const remove = { kind: 'delete-node', nodeId: 'prerequisite' } as const;
  const unlock = {
    kind: 'change-teacher-block',
    nodeId: 'dependent',
    operation: 'UNBLOCK',
  } as const;
  const hiding = await persistence.readChangeImpact(hide);
  const dependency = await persistence.readChangeImpact(connect);
  const deletion = await persistence.readChangeImpact(remove);
  const unlocking = await persistence.readChangeImpact(unlock);

  await executeWithChangeImpact(persistence, link('independent', 'later'));
  await persistence.execute({ kind: 'delete-dependency', dependencyId: 'prerequisite-selected' });
  await persistence.execute({ kind: 'delete-dependency', dependencyId: 'selected-dependent' });

  await expect(persistence.execute(hide, hiding.version)).rejects.toThrow(
    staleMessage('de ocultar el nodo'),
  );
  await expect(persistence.execute(connect, dependency.version)).rejects.toThrow(
    staleMessage('de la dependencia'),
  );
  await expect(persistence.execute(remove, deletion.version)).rejects.toThrow(
    staleMessage('de la eliminación'),
  );
  await expect(persistence.execute(unlock, unlocking.version)).rejects.toThrow(
    staleMessage('del desbloqueo'),
  );
  await expect(persistence.execute(unlock)).rejects.toThrow(staleMessage('del desbloqueo'));
  expect(await persistence.load()).toMatchObject({
    nodes: expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite' }),
      expect.objectContaining({ id: 'dependent', isVisible: true, isTeacherBlocked: true }),
    ]),
    dependencies: [expect.objectContaining({ sourceNodeId: 'independent', targetNodeId: 'later' })],
  });

  await executeWithChangeImpact(persistence, remove);
  expect((await persistence.load()).nodes.map(({ id }) => id)).not.toContain('prerequisite');
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
    await persistence.execute({ kind: 'delete-dependency', dependencyId: ids.dependency! });
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
    persistence.execute({ kind: 'delete-dependency', dependencyId: 'missing' }),
  ).rejects.toThrow('La dependencia no existe en este roadmap.');

  expect((await persistence.load()).dependencies.map(({ id }) => id)).toEqual([
    'prerequisite-selected',
    'selected-dependent',
  ]);
});
