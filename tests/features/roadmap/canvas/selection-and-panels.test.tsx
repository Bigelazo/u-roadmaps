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

test('starts with the editor closed and opens it when selecting a node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);
});

test('resumes a replacement selection only when NodeEditor permits it', async () => {
  const user = userEvent.setup();
  nodeEditorGuardMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: {
        ...roadmap,
        nodes: [...roadmap.nodes, { ...roadmap.nodes[0], id: 'node-2', title: 'Derivadas' }],
      },
    }),
  );
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Activar segundo nodo docente' }));
  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenCalledWith({ kind: 'replace-node', nodeId: 'node-2' }),
  );
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-1');

  await user.click(screen.getByRole('button', { name: 'Activar segundo nodo docente' }));
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-2'),
  );
});

test('replaces the editor with the shared student detail and keeps its completion local', async () => {
  const user = userEvent.setup();
  const completeNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ completeNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar' }));

  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);
  expect(screen.getByTestId('student-detail').textContent).toContain('Vista previa docente');
  expect(screen.getByTestId('student-detail').textContent).toContain('available');
  expect(screen.getByTestId('student-detail').getAttribute('data-panel-width')).toBe('360');

  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(screen.getByTestId('student-detail').textContent).toContain('completed');
  expect(completeNode).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
});

test('replaces a node information preview with the editor when selecting a node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar' }));
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  expect(screen.queryByTestId('student-detail')).toBeNull();
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);
});

test('hides the editor when deselecting its node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Deseleccionar nodo' }));

  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);
});

test('resumes canvas deselection only when NodeEditor permits it', async () => {
  const user = userEvent.setup();
  nodeEditorGuardMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Cerrar nodo con Escape' }));
  await waitFor(() =>
    expect(nodeEditorGuardMock).toHaveBeenCalledWith({ kind: 'deselect-node', nodeId: 'node-1' }),
  );
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Cerrar nodo con Escape' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true),
  );
});

test('requests focus return only when an editor surface is explicitly closed', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByTestId('focus-return-request').textContent).toBe('');

  await user.click(screen.getByRole('button', { name: 'Deseleccionar nodo' }));

  expect(screen.getByTestId('focus-return-request').textContent).not.toBe('');
});

test('does not select a blocked student node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: {
        ...roadmap,
        nodes: [
          {
            id: 'blocked-node',
            title: 'Nodo bloqueado',
            nodeTypeId: 'content',
            positionX: 0,
            positionY: 0,
            access: { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' },
          },
        ],
      },
    }),
  );
  renderCanvas();

  await user.click(screen.getByRole('button', { name: 'Activar nodo bloqueado' }));

  expect(screen.queryByTestId('student-detail')).toBeNull();
});
