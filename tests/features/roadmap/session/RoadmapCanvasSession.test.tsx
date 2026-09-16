import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import {
  InMemoryRoadmapCanvasSessionProvider,
  RoadmapCanvasSession,
  createInMemoryRoadmapSessionPersistence,
} from '@/features/roadmap/session';
import type { StudentRoadmapDto } from '@/features/roadmap/types';

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({ projection, onSelectNode }: { projection: { roadmap: { nodes: Array<{ id: string; title: string }> } }; onSelectNode: (nodeId: string) => void }) => (
    <button type="button" onClick={() => onSelectNode(projection.roadmap.nodes[0].id)}>
      {projection.roadmap.nodes[0].title}
    </button>
  ),
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: ({ node, onComplete }: { node?: { id: string; title: string }; onComplete: (node: { id: string }) => void }) =>
    node ? <button type="button" onClick={() => onComplete(node)}>Completar {node.title}</button> : null,
}));

const roadmap: StudentRoadmapDto = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [{ id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true }],
  nodes: [{ id: 'node-1', title: 'Límites', nodeTypeId: 'content', positionX: 0, positionY: 0, isVisible: true as const, access: { status: 'ACCESSIBLE' as const }, description: null, isCompleted: false, canComplete: true, resources: [] }],
  dependencies: [],
};

describe('RoadmapCanvasSession', () => {
  test('loads a student offering from its in-memory persistence seam and records a completion', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    render(
      <InMemoryRoadmapCanvasSessionProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{ identifier: { courseCode: 'CC1001', year: 2026, semester: 2 }, title: 'Programación I' }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </InMemoryRoadmapCanvasSessionProvider>,
    );

    const node = await screen.findByRole('button', { name: 'Límites' });
    await user.click(node);
    const complete = await screen.findByRole('button', { name: 'Completar Límites' });
    await user.click(complete);
    expect(await screen.findByRole('status', { name: 'Nodo completado.' })).not.toBeNull();
  });

  test('keeps the loaded offering visible after a later completion failure and lets the student dismiss it', async () => {
    const user = userEvent.setup();
    const persistence = {
      load: vi.fn().mockResolvedValue(roadmap),
      complete: vi.fn().mockRejectedValue(new Error('No se pudo completar el nodo.')),
    };
    render(
      <InMemoryRoadmapCanvasSessionProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{ identifier: { courseCode: 'CC1001', year: 2026, semester: 2 }, title: 'Programación I' }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </InMemoryRoadmapCanvasSessionProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(await screen.findByRole('button', { name: 'Completar Límites' }));
    expect(await screen.findByRole('alert', { name: 'No se pudo completar el nodo.' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Límites' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert', { name: 'No se pudo completar el nodo.' })).toBeNull(),
    );
  });
});
