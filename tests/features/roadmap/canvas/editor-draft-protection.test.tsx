import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import {
  nodeEditorGuardMock,
  roadmap,
  roadmapActions,
  renderCanvas,
  useRoadmapMock,
} from './test-harness';

test('does not enter canvas preview when NodeEditor cancels its guard', async () => {
  const user = userEvent.setup();
  nodeEditorGuardMock.mockResolvedValueOnce(false);
  const loadSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap, loadSimulation }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenCalledWith({ kind: 'enter-canvas-preview' }),
  );
  expect(loadSimulation).not.toHaveBeenCalled();
  expect(screen.queryByText('Previsualización del canvas')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await waitFor(() => expect(loadSimulation).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Previsualización del canvas')).toBeTruthy();
});

test('routes resource transitions through the NodeEditor guard', async () => {
  const user = userEvent.setup();
  nodeEditorGuardMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
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
  await user.click(screen.getByRole('button', { name: 'Agregar recurso al nodo actual' }));
  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenCalledWith({ kind: 'open-resource', nodeId: 'node-1' }),
  );
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-1');

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenLastCalledWith({
      kind: 'open-resource',
      nodeId: 'node-2',
    }),
  );
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-1');

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-2'),
  );
});

test('publishes an opaque typed Resource command with its target selection', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));

  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-2'),
  );
  expect(screen.getByTestId('node-editor-command-id').textContent).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('starts Node deletion only when NodeEditor permits its guard', async () => {
  const user = userEvent.setup();
  nodeEditorGuardMock.mockResolvedValueOnce(false);
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
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenCalledWith({ kind: 'delete-node', nodeId: 'node-1' }),
  );
  expect(previewNodeDeletion).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
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
