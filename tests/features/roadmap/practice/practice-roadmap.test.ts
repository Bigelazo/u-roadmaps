import { expect, it } from 'vitest';
import { practiceNodeIds, practiceRoadmap } from '@/features/roadmap/practice/practice-roadmap';
import { teachingTutorialSteps } from '@/features/roadmap/practice/teaching-tutorial';

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
