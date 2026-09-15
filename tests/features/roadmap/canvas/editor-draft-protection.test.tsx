import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmap, roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('confirms before discarding an unsaved editor draft to enter the canvas preview', async () => {
  const user = userEvent.setup();
  const loadSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap, loadSimulation }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  expect(loadSimulation).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.queryByText('Previsualización del canvas')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y previsualizar' }));

  await waitFor(() => expect(loadSimulation).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Previsualización del canvas')).toBeTruthy();
});

test('opens a resource composer without warning for the current draft and confirms only before replacing it', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: {
        ...roadmap,
        nodes: [
          ...roadmap.nodes,
          {
            ...roadmap.nodes[0],
            id: 'node-2',
            title: 'Derivadas',
          },
        ],
      },
    }),
  );
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Agregar recurso al nodo actual' }));
  expect(screen.queryByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-1');

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-2'),
  );
});

test('protects a dirty draft of the same Node before opening deletion confirmation', async () => {
  const user = userEvent.setup();
  const previewNodeDeletion = vi.fn().mockResolvedValue({
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [],
    resources: [],
    version: 'delete-preview',
  });
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  expect(previewNodeDeletion).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.queryByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await waitFor(() => expect(previewNodeDeletion).toHaveBeenCalledWith('node-1'));
  expect(screen.getByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();
});

test('routes NodeEditor deletion through the authoritative preview and mutation workflow', async () => {
  const user = userEvent.setup();
  const previewNodeDeletion = vi.fn().mockResolvedValue({
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [],
    resources: [],
    version: 'delete-preview',
  });
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion, deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo desde el editor' }));
  await waitFor(() => expect(previewNodeDeletion).toHaveBeenCalledWith('node-1'));
  await user.click(screen.getByRole('button', { name: 'Eliminar Nodo' }));

  await waitFor(() => expect(deleteNode).toHaveBeenCalledWith('node-1', 'delete-preview'));
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('');
});
