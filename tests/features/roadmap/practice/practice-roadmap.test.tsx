import type { ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { resolveElement } from '@/shared/client/tutorial/tutorial-support';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
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
  render(
    <>
      {typeof nodeTypes.description === 'function'
        ? nodeTypes.description()
        : nodeTypes.description}
    </>,
  );
  expect(screen.getByText('Tipos de nodo')).toBeTruthy();
  expect(screen.getByText(/te permite crear tus propios tipos personalizados/)).toBeTruthy();
  expect(nodeTypes.advanceWhen).toBeUndefined();
  const creationDescription = steps[creation].description;
  expect(
    typeof creationDescription === 'function' ? creationDescription() : creationDescription,
  ).toBe('A continuación, presiona el botón flotante.');
});

it('highlights only the "Crear nodo" action of the open creation menu in "Crea un nodo"', async () => {
  const user = userEvent.setup();
  const creation = teachingTutorialSteps().find((step) => step.title === 'Crea un nodo')!;
  render(
    <NodeCreator
      nodeTypes={[]}
      onSubmit={async () => false}
      onCreateNodeType={async () => false}
      onUpdateNodeType={async () => false}
      onRequestDeleteNodeType={() => undefined}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'Crear en el mapa' });
  expect(resolveElement(creation.element)?.contains(trigger)).toBe(true);

  await user.click(trigger);
  const createItem = await screen.findByRole('menuitem', { name: 'Crear nodo' });
  const highlighted = resolveElement(creation.element);
  expect(highlighted).toBe(createItem);
  expect(
    highlighted?.contains(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' })),
  ).toBe(false);
});

function renderPracticeSession(reported: PracticeCanvasAction[]) {
  const persistence = createInMemoryRoadmapSessionPersistence(
    practiceRoadmap({ year: 2026, semester: 2 }, chileCalendarDay(new Date())),
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
  return renderHook(() => useRoadmapCanvasSession(input), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        {children}
      </RoadmapCanvasSessionPersistenceProvider>
    ),
  });
}

type PracticeSession = ReturnType<typeof renderPracticeSession>['result'];

async function confirmCommand(
  session: PracticeSession,
  command: Parameters<PracticeSession['current']['canvasCommands']['request']>[0],
  choice: Parameters<PracticeSession['current']['canvasCommands']['confirm']>[0],
) {
  await act(() => session.current.canvasCommands.request(command));
  await waitFor(() => expect(session.current.canvasCommands.pending?.phase).toBe('awaiting'));
  await act(() => session.current.canvasCommands.confirm(choice));
}

function practiceNode(session: PracticeSession, nodeId: string) {
  const node = session.current.roadmap?.nodes.find(({ id }) => id === nodeId);
  if (!node || !('isTeacherBlocked' in node)) return null;
  return {
    isTeacherBlocked: node.isTeacherBlocked,
    teacherUnlockAt: 'teacherUnlockAt' in node ? node.teacherUnlockAt : undefined,
  };
}

function renderStepDescription(title: string, steps = teachingTutorialSteps()) {
  const step = steps.find((candidate) => candidate.title === title)!;
  return render(
    <>{typeof step.description === 'function' ? step.description() : step.description}</>,
  );
}

it('advances "Oculta un nodo" when the Practice roadmap hides the Node, not when it shows it', async () => {
  const hideStep = teachingTutorialSteps().find((step) => step.title === 'Oculta un nodo')!;
  const reported: PracticeCanvasAction[] = [];
  const { result } = renderPracticeSession(reported);
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());

  for (const kind of ['show-node', 'hide-node'] as const)
    await confirmCommand(result, { kind, nodeId: practiceNodeIds.g }, kind);

  expect(reported.map((action) => hideStep.advanceWhen?.(action) ?? false)).toEqual([false, true]);
});

it('keeps "Proyecto final" scheduled after "Control 1" is unlocked with its blocked prerequisites', async () => {
  const steps = teachingTutorialSteps();
  const unlockStep = steps.find((step) => step.title === 'Desbloquea un nodo')!;
  const reported: PracticeCanvasAction[] = [];
  const { result } = renderPracticeSession(reported);
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());
  const scheduled = practiceNode(result, practiceNodeIds.f);

  await confirmCommand(
    result,
    { kind: 'change-teacher-block', nodeId: practiceNodeIds.b, operation: 'BLOCK' },
    'block-teacher',
  );
  await confirmCommand(
    result,
    { kind: 'change-teacher-block', nodeId: practiceNodeIds.e, operation: 'UNBLOCK' },
    'unlock-prerequisites',
  );

  expect(reported.map((action) => unlockStep.advanceWhen?.(action) ?? false)).toEqual([
    false,
    true,
  ]);
  expect(practiceNode(result, practiceNodeIds.e)?.isTeacherBlocked).toBe(false);
  expect(practiceNode(result, practiceNodeIds.f)).toEqual(scheduled);
  expect(scheduled?.isTeacherBlocked).toBe(true);
  renderStepDescription('Desbloqueo programado', steps);
  expect(
    screen.getByText(/será liberado al estudiantado en el día y hora seleccionados/),
  ).toBeTruthy();
  expect(screen.queryByText(/no fue desbloqueado/)).toBeNull();
});

it('keeps "Proyecto final" scheduled when "Conceptos básicos" is unlocked with its dependents', async () => {
  const reported: PracticeCanvasAction[] = [];
  const { result } = renderPracticeSession(reported);
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());
  const scheduled = practiceNode(result, practiceNodeIds.f);

  await confirmCommand(
    result,
    { kind: 'change-teacher-block', nodeId: practiceNodeIds.b, operation: 'BLOCK' },
    'block-teacher',
  );
  await confirmCommand(
    result,
    { kind: 'change-teacher-block', nodeId: practiceNodeIds.b, operation: 'UNBLOCK' },
    'unlock-branch',
  );

  expect(reported.at(-1)).toMatchObject({ operation: 'BRANCH_UNLOCK' });
  expect(practiceNode(result, practiceNodeIds.g)?.isTeacherBlocked).toBe(false);
  expect(practiceNode(result, practiceNodeIds.f)).toEqual(scheduled);
});

it('explains why "Proyecto final" stayed blocked when the unlock included dependents', () => {
  const steps = teachingTutorialSteps();
  const unlockStep = steps.find((step) => step.title === 'Desbloquea un nodo')!;
  expect(
    unlockStep.advanceWhen?.({
      type: 'changeTeacherBlock',
      nodeId: practiceNodeIds.e,
      operation: 'BRANCH_UNLOCK',
    }),
  ).toBe(true);

  renderStepDescription('Desbloqueo programado', steps);

  expect(
    screen.getByText(/no fue desbloqueado a pesar de ser un dependiente de/).textContent,
  ).toContain('Control 1');
});
