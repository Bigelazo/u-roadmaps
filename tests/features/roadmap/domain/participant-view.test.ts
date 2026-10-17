import { expect, test } from 'vitest';
import {
  participantNodeAccess,
  studentRoadmapNodes,
} from '@/features/roadmap/domain/participant-view';

const ACCESSIBLE = { status: 'ACCESSIBLE' };
const TEACHER_BLOCK = { status: 'BLOCKED', reason: 'TEACHER_BLOCK' };
const PREREQUISITE_BLOCK = { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' };

function node(id: string, { hidden = false, teacherBlocked = false } = {}) {
  return { id, isVisible: !hidden, isTeacherBlocked: teacherBlocked };
}

function dependency(sourceNodeId: string, targetNodeId: string) {
  return { sourceNodeId, targetNodeId };
}

function student(...completedNodeIds: string[]) {
  return { role: 'STUDENT' as const, completedNodeIds: new Set(completedNodeIds) };
}

test('a student reaches a Node only after completing every prerequisite', () => {
  const view = participantNodeAccess({
    participant: student(),
    nodes: [node('intro'), node('theory'), node('assessment')],
    dependencies: [dependency('intro', 'theory'), dependency('theory', 'assessment')],
  });

  expect(Object.fromEntries(view.accessByNodeId)).toEqual({
    intro: ACCESSIBLE,
    theory: PREREQUISITE_BLOCK,
    assessment: PREREQUISITE_BLOCK,
  });
  expect([...view.accessibleNodeIds]).toEqual(['intro']);
});

test.each([
  {
    case: 'a completed prerequisite opens its dependent',
    nodes: [node('intro'), node('theory')],
    dependencies: [dependency('intro', 'theory')],
    completed: ['intro'],
    access: { intro: ACCESSIBLE, theory: ACCESSIBLE },
  },
  {
    case: 'a transitive Prerequisite block holds despite a completed direct prerequisite',
    nodes: [node('intro'), node('theory'), node('assessment')],
    dependencies: [dependency('intro', 'theory'), dependency('theory', 'assessment')],
    completed: ['theory'],
    access: { intro: ACCESSIBLE, theory: PREREQUISITE_BLOCK, assessment: PREREQUISITE_BLOCK },
  },
  {
    case: 'a completed but Teacher-blocked prerequisite blocks its dependent',
    nodes: [node('intro', { teacherBlocked: true }), node('theory')],
    dependencies: [dependency('intro', 'theory')],
    completed: ['intro'],
    access: { intro: TEACHER_BLOCK, theory: PREREQUISITE_BLOCK },
  },
  {
    case: 'a Teacher block prevails over a Prerequisite block',
    nodes: [node('intro'), node('theory', { teacherBlocked: true })],
    dependencies: [dependency('intro', 'theory')],
    completed: [],
    access: { intro: ACCESSIBLE, theory: TEACHER_BLOCK },
  },
  {
    case: 'a hidden intermediary is absent and neither blocks nor carries its Dependencies',
    nodes: [node('intro'), node('hidden', { hidden: true }), node('assessment')],
    dependencies: [dependency('intro', 'hidden'), dependency('hidden', 'assessment')],
    completed: [],
    access: { intro: ACCESSIBLE, assessment: ACCESSIBLE },
    visibleDependencies: [],
  },
])('student: $case', ({ nodes, dependencies, completed, access, visibleDependencies }) => {
  const view = participantNodeAccess({ participant: student(...completed), nodes, dependencies });

  expect(Object.fromEntries(view.accessByNodeId)).toEqual(access);
  expect(view.nodes.map(({ id }) => id)).toEqual(Object.keys(access));
  expect(view.dependencies).toEqual(visibleDependencies ?? dependencies);
});

test('teaching staff reach every visible Node without a Teacher block, whatever its prerequisites', () => {
  // The dependent is deliberately not Teacher-blocked: the rule must not lean on the write-side
  // invariant that a Teacher block propagates to its dependents.
  const view = participantNodeAccess({
    participant: { role: 'TEACHER' },
    nodes: [
      node('pending'),
      node('blocked', { teacherBlocked: true }),
      node('dependent'),
      node('hidden', { hidden: true }),
    ],
    dependencies: [dependency('pending', 'blocked'), dependency('blocked', 'dependent')],
  });

  expect(Object.fromEntries(view.accessByNodeId)).toEqual({
    pending: ACCESSIBLE,
    blocked: TEACHER_BLOCK,
    dependent: ACCESSIBLE,
  });
  expect([...view.accessibleNodeIds]).toEqual(['pending', 'dependent']);
});

function roadmapNode(id: string, options: { hidden?: boolean; teacherBlocked?: boolean } = {}) {
  return {
    ...node(id, options),
    title: `Título ${id}`,
    description: `Descripción ${id}`,
    nodeTypeId: 'reading',
    positionX: 10,
    positionY: 20,
    resources: [{ id: `resource-${id}`, title: 'Apunte', url: '/apunte', type: 'LINK' as const }],
  };
}

test('a Blocked node shows only its title, Node type, position and block reason, even when completed', () => {
  const roadmap = studentRoadmapNodes({
    nodes: [
      roadmapNode('intro', { teacherBlocked: true }),
      roadmapNode('hidden', { hidden: true }),
    ],
    dependencies: [],
    completedNodeIds: new Set(['intro']),
    isClosed: false,
  });

  expect(roadmap.nodes).toEqual([
    {
      id: 'intro',
      title: 'Título intro',
      nodeTypeId: 'reading',
      positionX: 10,
      positionY: 20,
      access: TEACHER_BLOCK,
    },
  ]);
});

test('an accessible Node adds its description, Resources and Completion, but no teaching-only field', () => {
  const roadmap = studentRoadmapNodes({
    nodes: [roadmapNode('intro'), roadmapNode('theory')],
    dependencies: [{ id: 'edge', ...dependency('intro', 'theory') }],
    completedNodeIds: new Set(['intro']),
    isClosed: false,
  });

  expect(roadmap.nodes).toEqual([
    {
      id: 'intro',
      title: 'Título intro',
      nodeTypeId: 'reading',
      positionX: 10,
      positionY: 20,
      isVisible: true,
      access: ACCESSIBLE,
      description: 'Descripción intro',
      resources: [{ id: 'resource-intro', title: 'Apunte', url: '/apunte', type: 'LINK' }],
      isCompleted: true,
      canComplete: false,
    },
    expect.objectContaining({ id: 'theory', isCompleted: false, canComplete: true }),
  ]);
  expect(roadmap.dependencies).toEqual([
    { id: 'edge', sourceNodeId: 'intro', targetNodeId: 'theory' },
  ]);
});

test('no accessible Node can be completed on a closed Roadmap', () => {
  const roadmap = studentRoadmapNodes({
    nodes: [roadmapNode('intro')],
    dependencies: [],
    completedNodeIds: new Set(),
    isClosed: true,
  });

  expect(roadmap.nodes).toEqual([
    expect.objectContaining({ id: 'intro', isCompleted: false, canComplete: false }),
  ]);
});
