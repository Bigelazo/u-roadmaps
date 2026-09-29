import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import type { RoadmapDto } from '@/features/roadmap/types';

const input = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Programación I',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

const roadmap: RoadmapDto = {
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
};

test('models upstream Node unlock through the same Teacher block policy as production', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await expect(persistence.previewTeacherBlock!(input, 'selected', 'UNBLOCK')).resolves.toMatchObject({
    mode: 'UPSTREAM',
    nodes: [
      { id: 'prerequisite', relation: 'PREREQUISITE' },
      { id: 'selected', relation: 'SELECTED_NODE' },
    ],
  });
  await persistence.changeTeacherBlock!(input, 'selected', 'UNBLOCK');

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
    persistence.previewTeacherBlock!(input, 'selected', 'BRANCH_UNLOCK'),
  ).resolves.toMatchObject({
    mode: 'BRANCH',
    nodes: [
      { id: 'selected', relation: 'SELECTED_NODE' },
      { id: 'dependent', relation: 'DEPENDENT' },
    ],
  });

  await persistence.changeTeacherBlock!(input, 'selected', 'BRANCH_UNLOCK');
  expect((await persistence.load(input)).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'prerequisite', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'selected', isTeacherBlocked: false }),
      expect.objectContaining({ id: 'dependent', isTeacherBlocked: false }),
    ]),
  );
});
