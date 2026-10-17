import { expect, it } from 'vitest';
import { practiceNodeIds, practiceRoadmap } from '@/features/roadmap/practice/practice-roadmap';
import { reportingPracticeActions } from '@/features/roadmap/practice/practice-actions';
import { teachingTutorialSteps } from '@/features/roadmap/practice/teaching-tutorial';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
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
  const persistence = reportingPracticeActions(
    createInMemoryRoadmapSessionPersistence(
      practiceRoadmap({ year: 2026, semester: 2 }, '2026-10-09'),
    ),
    (action) => reported.push(action),
  );
  const input = {
    courseOffering: {
      identifier: { courseCode: 'AA0000', year: 2026, semester: 2 },
      title: 'Tutorial',
    },
    experience: { kind: 'teaching' as const, term: 'current' as const },
  };

  await persistence.setVisibility(input, practiceNodeIds.g, true);
  await persistence.setVisibility(input, practiceNodeIds.g, false);

  expect(reported.map((action) => hideStep.advanceWhen?.(action) ?? false)).toEqual([false, true]);
});
