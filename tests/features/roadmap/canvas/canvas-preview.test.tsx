import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import {
  RoadmapCanvasForTest,
  identifier,
  roadmap,
  roadmapActions,
  renderCanvas,
  useRoadmapMock,
} from './test-harness';

test('lets teachers enter the persistent student canvas preview, complete a node, and reset it', async () => {
  const user = userEvent.setup();
  const simulationRoadmap = {
    ...roadmap,
    roadmap: { id: 'simulation-roadmap' },
    nodes: [
      {
        ...roadmap.nodes[0],
        access: { status: 'ACCESSIBLE' as const },
        isCompleted: false,
        canComplete: true,
      },
    ],
  };
  const loadSimulation = vi.fn().mockResolvedValue(true);
  const completeSimulatedNode = vi.fn().mockResolvedValue(true);
  const resetSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(
    roadmapActions({ simulationRoadmap, loadSimulation, completeSimulatedNode, resetSimulation }),
  );
  renderCanvas(true);

  expect(screen.getByRole('button', { name: 'Previsualizar canvas' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(await screen.findByText('Previsualización del canvas')).toBeTruthy();
  expect(loadSimulation).toHaveBeenCalled();
  expect(screen.getByTestId('roadmap-mode').textContent).toBe('student');
  expect(screen.getByTestId('displayed-roadmap').textContent).toBe('simulation-roadmap');
  expect(screen.queryByRole('button', { name: 'Crear en el mapa' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(completeSimulatedNode).toHaveBeenCalledWith('node-1');

  await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
  const resetDialog = screen.getByRole('alertdialog', {
    name: 'Reiniciar progreso de previsualización',
  });
  expect(resetDialog.getAttribute('data-intent')).toBe('destructive');
  expect(resetDialog.textContent).toContain('completaciones simuladas');
  expect(resetDialog.textContent).toContain('Completions estudiantiles');
  await user.click(within(resetDialog).getByRole('button', { name: 'Cancelar' }));
  expect(resetSimulation).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
  const confirmation = screen.getByRole('alertdialog', {
    name: 'Reiniciar progreso de previsualización',
  });
  await user.click(within(confirmation).getByRole('button', { name: 'Reiniciar progreso' }));
  expect(resetSimulation).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
  expect(screen.getByTestId('roadmap-mode').textContent).toBe('editing');
});

test('keeps a failed Canvas preview reset recoverable', async () => {
  const user = userEvent.setup();
  const simulationRoadmap = {
    ...roadmap,
    roadmap: { id: 'simulation-roadmap' },
    nodes: [
      {
        ...roadmap.nodes[0],
        access: { status: 'ACCESSIBLE' as const },
        isCompleted: false,
        canComplete: true,
      },
    ],
  };
  const resetSimulation = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      simulationRoadmap,
      loadSimulation: vi.fn().mockResolvedValue(true),
      completeSimulatedNode: vi.fn().mockResolvedValue(true),
      resetSimulation,
    }),
  );
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Completar' }));
  await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));

  const dialog = screen.getByRole('alertdialog', {
    name: 'Reiniciar progreso de previsualización',
  });
  await user.click(within(dialog).getByRole('button', { name: 'Reiniciar progreso' }));

  await waitFor(() => expect(resetSimulation).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole('alertdialog', { name: 'Reiniciar progreso de previsualización' }),
  ).toBeTruthy();

  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reiniciar progreso' }),
  );
  await waitFor(() => expect(resetSimulation).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('does not restore a prior preview viewport when entering a later preview', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Mover viewport a 100' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
  expect(screen.getByTestId('restored-viewport').textContent).toBe('100');

  await user.click(screen.getByRole('button', { name: 'Mover viewport a 400' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(screen.getByTestId('restored-viewport').textContent).toBe('none');
});

test('keeps a frozen teacher roadmap read-only and returns there from preview', async () => {
  const user = userEvent.setup();
  const loadSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap, loadSimulation }));
  render(
    <RoadmapCanvasForTest
      identifier={identifier}
      canPreview
      isHistorical
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={1}
    />,
  );

  expect(screen.getByTestId('roadmap-projection').textContent).toBe('teacher');
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  expect(screen.getByTestId('roadmap-projection').textContent).toBe('student');
  await user.click(screen.getByRole('button', { name: 'Volver al roadmap' }));

  expect(screen.getByTestId('roadmap-projection').textContent).toBe('teacher');
  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('does not offer completion or reset mutations in a frozen canvas preview', async () => {
  const user = userEvent.setup();
  const completeSimulatedNode = vi.fn();
  const simulationRoadmap = {
    ...roadmap,
    nodes: [
      {
        ...roadmap.nodes[0],
        access: { status: 'ACCESSIBLE' as const },
        isCompleted: false,
        canComplete: true,
      },
    ],
  };
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap, completeSimulatedNode }));
  render(
    <RoadmapCanvasForTest
      identifier={identifier}
      canPreview
      isHistorical
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  expect((screen.getByRole('button', { name: 'Completar' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.queryByRole('button', { name: 'Reiniciar progreso' })).toBeNull();
  expect(completeSimulatedNode).not.toHaveBeenCalled();
});
