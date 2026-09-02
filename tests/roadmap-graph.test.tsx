import { expect, test } from 'vitest';
import { mapRoadmapGraph } from '../src/features/roadmap/graph/map-roadmap-graph';
import { roadmapEdgeTypes } from '../src/features/roadmap/graph/DependencyEdge';
import { FloatingEdge } from '../src/features/roadmap/graph/FloatingEdge';
import type { RoadmapDto, StudentRoadmapDto } from '../src/lib/roadmap-types';

const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Introducción', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [{ id: 'content', name: 'Contenido', color: '#024AD8', isPredefined: true }],
  nodes: [
    {
      id: 'hidden-node',
      title: 'Material de preparación docente',
      description: null,
      positionX: 0,
      positionY: 0,
      nodeTypeId: 'content',
      isVisible: false,
      isTeacherBlocked: false,
      isCompleted: false,
      canComplete: false,
      resources: [
        {
          id: 'resource-1',
          title: 'Guía de preparación',
          url: 'https://example.test/guide',
          type: 'FILE',
        },
      ],
    },
  ],
  dependencies: [
    {
      id: 'dependency-1',
      sourceNodeId: 'hidden-node',
      targetNodeId: 'hidden-node',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
  ],
};

test('keeps hidden nodes on the teacher graph and marks them as hidden from students', () => {
  const teacherNode = mapRoadmapGraph(roadmap, true).nodes[0];
  const studentNode = mapRoadmapGraph(roadmap, false).nodes[0];

  expect(teacherNode.hidden).toBe(false);
  expect(teacherNode.data.isHidden).toBe(true);
  expect(teacherNode.data.typeColor).toBe('#024AD8');
  expect(teacherNode.data.typeName).toBe('Contenido');
  expect(studentNode.hidden).toBe(true);
});

test('allows teachers, but not students, to delete dependency arrows', () => {
  const teacherEdge = mapRoadmapGraph(roadmap, true, () => undefined).edges[0];
  const studentEdge = mapRoadmapGraph(roadmap, false).edges[0];

  expect(teacherEdge.deletable).toBe(true);
  expect(teacherEdge.selectable).toBe(true);
  expect(teacherEdge.data?.onDelete).toBeTypeOf('function');
  expect(studentEdge.deletable).toBe(false);
  expect(studentEdge.selectable).toBe(false);
  expect(studentEdge.focusable).toBe(false);
  expect(studentEdge.interactionWidth).toBe(0);
  expect(studentEdge.domAttributes).toMatchObject({ pointerEvents: 'none' });
  expect(studentEdge.data?.onDelete).toBeUndefined();
  expect(teacherEdge.type).toBe('dependency');
});

test('renders dependency arrows with the floating edge that selects the nearest handles', () => {
  const edge = mapRoadmapGraph(roadmap, true).edges[0];

  expect(edge.sourceHandle).toBe('bottom');
  expect(edge.targetHandle).toBe('top');
  expect(edge.type).toBe('dependency');
  expect(roadmapEdgeTypes.dependency).toBe(FloatingEdge);
});

test('keeps the original dependency-arrow appearance for teachers', () => {
  const completedRoadmap = structuredClone(roadmap);
  completedRoadmap.nodes[0].isCompleted = true;
  const teacherEdge = mapRoadmapGraph(roadmap, true).edges[0];
  const completedTeacherEdge = mapRoadmapGraph(completedRoadmap, true).edges[0];

  expect(teacherEdge.style).toMatchObject({ stroke: 'var(--steel)', strokeWidth: 1.5 });
  expect(teacherEdge.markerEnd).toMatchObject({ color: 'var(--steel)' });
  expect(completedTeacherEdge.style).toMatchObject({ stroke: 'var(--ink)' });
  expect(completedTeacherEdge.markerEnd).toMatchObject({ color: 'var(--ink)' });
});

test('uses fixed black arrows only for students', () => {
  const completedRoadmap = structuredClone(roadmap);
  completedRoadmap.nodes[0].isCompleted = true;
  const studentEdge = mapRoadmapGraph(completedRoadmap, false).edges[0];

  expect(studentEdge.style).toMatchObject({ stroke: 'var(--ink)', strokeWidth: 1.5 });
  expect(studentEdge.markerEnd).toMatchObject({ color: 'var(--ink)' });
});

test('preserves the teacher and student node-status mapping', () => {
  const completedRoadmap = structuredClone(roadmap);
  completedRoadmap.nodes[0].isCompleted = true;
  const availableRoadmap = structuredClone(roadmap);
  availableRoadmap.nodes[0].canComplete = true;

  expect(mapRoadmapGraph(roadmap, true).nodes[0].data.status).toBe('editing');
  expect(mapRoadmapGraph(roadmap, false).nodes[0].data.status).toBe('locked');
  expect(mapRoadmapGraph(completedRoadmap, false).nodes[0].data.status).toBe('completed');
  expect(mapRoadmapGraph(availableRoadmap, false).nodes[0].data.status).toBe('available');
});

test('maps each blocked reason to a disabled, non-selectable student node', () => {
  const studentRoadmap: StudentRoadmapDto = {
    ...roadmap,
    nodes: [
      {
        id: 'teacher-blocked',
        title: 'Contenido bloqueado por docencia',
        positionX: 40,
        positionY: 80,
        nodeTypeId: 'content',
        access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
      },
      {
        id: 'prerequisite-blocked',
        title: 'Contenido con prerrequisitos pendientes',
        positionX: 160,
        positionY: 80,
        nodeTypeId: 'content',
        access: { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' },
      },
      {
        id: 'released-completed',
        title: 'Contenido completado tras desbloquear',
        positionX: 280,
        positionY: 80,
        nodeTypeId: 'content',
        isVisible: true,
        access: { status: 'ACCESSIBLE' },
        description: null,
        isCompleted: true,
        canComplete: false,
        resources: [],
      },
    ],
    dependencies: [],
  };

  const [teacherBlocked, prerequisiteBlocked, releasedCompleted] = mapRoadmapGraph(
    studentRoadmap,
    false,
  ).nodes;

  expect(teacherBlocked.data).toMatchObject({
    status: 'locked',
    blockReason: 'TEACHER_BLOCK',
  });
  expect(prerequisiteBlocked.data).toMatchObject({
    status: 'locked',
    blockReason: 'PREREQUISITE_BLOCK',
  });
  for (const blockedNode of [teacherBlocked, prerequisiteBlocked]) {
    expect(blockedNode.selectable).toBe(false);
    expect(blockedNode.focusable).toBe(true);
    expect(blockedNode.ariaRole).toBe('button');
    expect(blockedNode.domAttributes).toMatchObject({ 'aria-disabled': true });
  }
  expect(releasedCompleted.data.status).toBe('completed');
  expect(releasedCompleted.selectable).toBe(true);
});
