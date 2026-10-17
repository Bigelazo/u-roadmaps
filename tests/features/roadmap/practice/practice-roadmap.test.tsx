import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { practiceNodeIds, practiceRoadmap } from '@/features/roadmap/practice/practice-roadmap';
import { teachingTutorialSteps } from '@/features/roadmap/practice/teaching-tutorial';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import {
  RoadmapCanvasSessionPersistenceProvider,
  useRoadmapCanvasSession,
} from '@/features/roadmap/session/session';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';

it('gives "Retroalimentación del control" the Contenido Node type', () => {
  const roadmap = practiceRoadmap({ year: 2026, semester: 2 }, '2026-10-09');
  const node = roadmap.nodes.find((candidate) => candidate.id === practiceNodeIds.g);
  const type = roadmap.nodeTypes.find((candidate) => candidate.id === node?.nodeTypeId);
  expect(node?.title).toBe('Retroalimentación del control');
  expect(type?.name).toBe('Contenido');
});

it('explains "Gestionar tipos de nodo" in its own step right after "Crea un nodo"', () => {
  const steps = teachingTutorialSteps();
  const creation = steps.findIndex((step) => step.title === 'Crea un nodo');
  const nodeTypes = steps[creation + 1];
  expect(nodeTypes.title).toBe('Tipos de nodo');
  expect(nodeTypes.description).toContain('Tipos de nodo');
  expect(nodeTypes.advanceWhen).toBeUndefined();
  expect(steps[creation].description).not.toContain('Gestionar tipos de nodo');
});

it('advances "Oculta un nodo" when the Practice roadmap hides the Node, not when it shows it', async () => {
  const hideStep = teachingTutorialSteps().find((step) => step.title === 'Oculta un nodo')!;
  const reported: PracticeCanvasAction[] = [];
  const persistence = createInMemoryRoadmapSessionPersistence(
    practiceRoadmap({ year: 2026, semester: 2 }, '2026-10-09'),
  );
  const input = {
    courseOffering: {
      identifier: { courseCode: 'AA0000', year: 2026, semester: 2 },
      title: 'Tutorial',
    },
    experience: { kind: 'teaching' as const, term: 'current' as const },
    practice: {
      nodeChangeCounts: {},
      onAction: (action: PracticeCanvasAction) => reported.push(action),
    },
  };
  const { result } = renderHook(() => useRoadmapCanvasSession(input), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        {children}
      </RoadmapCanvasSessionPersistenceProvider>
    ),
  });
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());
  const confirm = async (kind: 'show-node' | 'hide-node') => {
    await act(() => result.current.canvasCommands.request({ kind, nodeId: practiceNodeIds.g }));
    await waitFor(() => expect(result.current.canvasCommands.pending?.phase).toBe('awaiting'));
    await act(() => result.current.canvasCommands.confirm(kind));
  };

  await confirm('show-node');
  await confirm('hide-node');

  expect(reported.map((action) => hideStep.advanceWhen?.(action) ?? false)).toEqual([false, true]);
});
