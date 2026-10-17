import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import type { RoadmapDto } from '@/features/roadmap/types';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import { confirmedWrites } from '../support/confirmed-writes';

const input = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Programación I',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

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

  await confirmedWrites(persistence, input).hide('selected');
  await confirmedWrites(persistence, input).hide('selected');
  const hidden = await persistence.load(input);
  expect(hidden.nodes).toContainEqual(
    expect.objectContaining({ id: 'selected', isVisible: false, isTeacherBlocked: false }),
  );
  expect(hidden.dependencies).toEqual([]);

  await persistence.setVisibility(input, 'selected', true);
  expect((await persistence.load(input)).nodes).toContainEqual(
    expect.objectContaining({ id: 'selected', isVisible: true }),
  );
});

test('models upstream Node unlock through the same Teacher block policy as production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(
    persistence.previewTeacherBlock(input, 'selected', 'UNBLOCK'),
  ).resolves.toMatchObject({
    mode: 'UPSTREAM',
    nodes: [
      { id: 'prerequisite', relation: 'PREREQUISITE' },
      { id: 'selected', relation: 'SELECTED_NODE' },
    ],
  });
  const { version } = await persistence.previewTeacherBlock(input, 'selected', 'UNBLOCK');
  await persistence.changeTeacherBlock(input, 'selected', 'UNBLOCK', version);

  expect((await persistence.load(input)).nodes).toEqual(
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

  await expect(
    persistence.previewTeacherBlock(input, 'selected', 'BRANCH_UNLOCK'),
  ).resolves.toMatchObject({
    mode: 'BRANCH',
    nodes: [
      { id: 'selected', relation: 'SELECTED_NODE' },
      { id: 'dependent', relation: 'DEPENDENT' },
    ],
  });

  const { version } = await persistence.previewTeacherBlock(input, 'selected', 'BRANCH_UNLOCK');
  await persistence.changeTeacherBlock(input, 'selected', 'BRANCH_UNLOCK', version);
  expect((await persistence.load(input)).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'selected', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'dependent', isTeacherBlocked: false }),
    ]),
  );
});

test('rejects a Scheduled unlock that is not after today, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(persistence.scheduleTeacherUnlock(input, 'selected', '2000-01-01')).rejects.toThrow(
    'La fecha de desbloqueo debe ser posterior a hoy.',
  );
});

test('rejects a student Completion of a blocked Node, as production does', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap, {
    studentProgress: { completedNodeIds: [] },
  });

  await expect(persistence.complete(input, 'selected')).rejects.toThrow(
    'El equipo docente bloqueó este nodo.',
  );
  expect((await persistence.load(input)).nodes).toEqual(
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
  const first = await persistence.previewNodeHiding(input, 'selected');

  expect(await persistence.previewNodeHiding(input, 'selected')).toEqual(first);
  expect((await persistence.previewNodeHiding(input, 'prerequisite')).version).not.toBe(
    first.version,
  );
  await confirmedWrites(persistence, input).connect({
    sourceNodeId: 'independent',
    targetNodeId: 'selected',
    sourceHandle: 'right',
    targetHandle: 'left',
  });
  expect((await persistence.previewNodeHiding(input, 'selected')).version).not.toBe(first.version);
});

test('rejects confirming a hide, a Dependency, a deletion or a Teacher block whose Change impact changed', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: [...roadmap.nodes, independent, { ...independent, id: 'later', title: 'Posterior' }],
  });
  const link = (sourceNodeId: string, targetNodeId: string) =>
    ({ sourceNodeId, targetNodeId, sourceHandle: 'right', targetHandle: 'left' }) as const;
  const hiding = await persistence.previewNodeHiding(input, 'dependent');
  const dependency = await persistence.previewRoadmapDependency(
    input,
    link('selected', 'independent'),
  );
  const deletion = await persistence.previewNodeDeletion(input, 'prerequisite');
  const unlock = await persistence.previewTeacherBlock(input, 'dependent', 'UNBLOCK');

  // Another change lands before each confirmation.
  await confirmedWrites(persistence, input).connect(link('independent', 'later'));
  await persistence.deleteDependency(input, 'prerequisite-selected');
  await persistence.deleteDependency(input, 'selected-dependent');

  await expect(
    persistence.setVisibility(input, 'dependent', false, hiding.version),
  ).rejects.toThrow(staleMessage('de ocultar el nodo'));
  await expect(
    persistence.connectNodes(input, link('selected', 'independent'), dependency.version),
  ).rejects.toThrow(staleMessage('de la dependencia'));
  await expect(persistence.deleteNode(input, 'prerequisite', deletion.version)).rejects.toThrow(
    staleMessage('de la eliminación'),
  );
  await expect(
    persistence.changeTeacherBlock(input, 'dependent', 'UNBLOCK', unlock.version),
  ).rejects.toThrow(staleMessage('del desbloqueo'));
  await expect(persistence.changeTeacherBlock(input, 'dependent', 'UNBLOCK')).rejects.toThrow(
    staleMessage('del desbloqueo'),
  );
  expect(await persistence.load(input)).toMatchObject({
    nodes: expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite' }),
      expect.objectContaining({ id: 'dependent', isVisible: true, isTeacherBlocked: true }),
    ]),
    dependencies: [expect.objectContaining({ sourceNodeId: 'independent', targetNodeId: 'later' })],
  });

  const current = await persistence.previewNodeDeletion(input, 'prerequisite');
  await persistence.deleteNode(input, 'prerequisite', current.version);
  expect((await persistence.load(input)).nodes.map(({ id }) => id)).not.toContain('prerequisite');
});

test('follows the Node type rules with the messages of production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const workshop = { name: 'Taller', icon: 'Shapes', color: '#024AD8' } as const;
  await persistence.addNodeType(input, workshop);
  const before = await persistence.load(input);
  const workshopId = before.nodeTypes.find(({ name }) => name === 'Taller')?.id ?? '';

  await expect(
    persistence.addNodeType(input, { ...workshop, name: ' contenido ' }),
  ).rejects.toThrow('Ya existe un tipo disponible con ese nombre.');
  await expect(
    persistence.updateNodeType(input, workshopId, { ...workshop, name: 'CONTENIDO' }),
  ).rejects.toThrow('Ya existe un tipo disponible con ese nombre.');
  await expect(
    persistence.updateNodeType(input, 'content', { ...workshop, name: 'Lectura' }),
  ).rejects.toThrow('Los tipos predefinidos son inmutables.');
  await expect(persistence.deleteNodeType(input, 'content')).rejects.toThrow(
    'Los tipos predefinidos son inmutables.',
  );
  await persistence.updateNode(input, 'selected', {
    title: 'Seleccionado',
    description: '',
    nodeTypeId: workshopId,
  });
  await expect(persistence.deleteNodeType(input, workshopId)).rejects.toThrow(
    'No se puede eliminar un tipo utilizado por nodos.',
  );
  expect((await persistence.load(input)).nodeTypes).toEqual(before.nodeTypes);

  await persistence.updateNode(input, 'selected', {
    title: 'Seleccionado',
    description: '',
    nodeTypeId: 'content',
  });
  await persistence.deleteNodeType(input, workshopId);
  expect((await persistence.load(input)).nodeTypes.map(({ id }) => id)).toEqual(['content']);
});

test('never reuses an identifier after a deletion', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({ ...roadmap, dependencies: [] });
  const node = { title: 'Nuevo', description: '', nodeTypeId: 'content', isVisible: true };
  const nodeType = { name: 'Taller', icon: 'Shapes', color: '#024AD8' } as const;
  const link = { title: 'Guía', url: 'https://example.test/guide', type: 'LINK' } as const;
  const dependency = {
    sourceNodeId: 'prerequisite',
    targetNodeId: 'dependent',
    sourceHandle: 'right',
    targetHandle: 'left',
  } as const;
  const created = async () => {
    const roadmapNow = await persistence.load(input);
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
    await persistence.addNode(input, node, { x: 0, y: 0 });
    await confirmedWrites(persistence, input).connect(dependency);
    await persistence.addNodeType(input, nodeType);
    await persistence.addResource(input, 'selected', link);
    return created();
  };
  const deleteAll = async (ids: Awaited<ReturnType<typeof created>>) => {
    await confirmedWrites(persistence, input).delete(ids.node!);
    await persistence.deleteDependency(input, ids.dependency!);
    await persistence.deleteNodeType(input, ids.nodeType!);
    await persistence.deleteResource(input, ids.resource!);
  };

  const first = await createAll();
  await deleteAll(first);
  const second = await createAll();

  for (const kind of ['node', 'dependency', 'nodeType', 'resource'] as const) {
    expect(second[kind]).toEqual(expect.any(String));
    expect(second[kind]).not.toBe(first[kind]);
  }
});

test('places created Nodes at its created-node position when it has one', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap, {
    createdNodePosition: { x: 960, y: 360 },
  });
  const node = { title: 'Nuevo', description: '', nodeTypeId: 'content', isVisible: true };

  const nodeId = await persistence.addNode(input, node, { x: 0, y: 0 });

  expect((await persistence.load(input)).nodes).toContainEqual(
    expect.objectContaining({ id: nodeId, positionX: 960, positionY: 360 }),
  );
});

test('presents a Node whose Node type is missing with the shared unknown Node type', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence({ ...roadmap, nodeTypes: [] });

  expect((await persistence.previewNodeDeletion(input, 'selected')).node.nodeType).toEqual(
    unknownNodeType,
  );
});
