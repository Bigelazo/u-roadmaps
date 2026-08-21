import { expect, test } from 'vitest';
import { mapRoadmapGraph } from '../src/components/roadmap/RoadmapGraph';
import type { RoadmapDto } from '../src/lib/roadmap-types';

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
  expect(teacherNode.data.resourceCount).toBe(1);
  expect(studentNode.hidden).toBe(true);
});

test('allows teachers, but not students, to delete dependency arrows', () => {
  const teacherEdge = mapRoadmapGraph(roadmap, true).edges[0];
  const studentEdge = mapRoadmapGraph(roadmap, false).edges[0];

  expect(teacherEdge.deletable).toBe(true);
  expect(studentEdge.deletable).toBe(false);
});

test('keeps the selected source and target handles on dependency arrows', () => {
  const edge = mapRoadmapGraph(roadmap, true).edges[0];

  expect(edge.sourceHandle).toBe('bottom');
  expect(edge.targetHandle).toBe('top');
});

test('uses semantic theme variables for graph structure', () => {
  const { nodes, edges } = mapRoadmapGraph(roadmap, true);

  expect(nodes[0].data.typeColor).toBe('#024AD8');
  expect(edges[0].style).toMatchObject({ stroke: 'var(--steel)', strokeWidth: 1.5 });
  expect(edges[0].markerEnd).toMatchObject({ color: 'var(--steel)' });
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
