import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('confirms a teacher block from the most recent preview before mutating', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi.fn().mockResolvedValue({
    mode: 'BLOCK',
    version: 'preview',
    nodes: [
      { id: 'node-1', title: 'Límites' },
      { id: 'node-2', title: 'Continuidad' },
    ],
  });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  expect(previewTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK');
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('Continuidad');
  expect(dialog.textContent).toContain('puede afectar el acceso y progreso estudiantil');

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(changeTeacherBlock).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  await user.click(
    within(await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' })).getByRole(
      'button',
      { name: 'Bloquear rama' },
    ),
  );
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'preview'),
  );
});

test('keeps a failed teacher-block mutation recoverable and refreshes its preview', async () => {
  const user = userEvent.setup();
  const initialPreview = {
    mode: 'BLOCK' as const,
    version: 'initial',
    nodes: [{ id: 'node-1', title: 'Límites' }],
  };
  const refreshedPreview = {
    mode: 'BLOCK' as const,
    version: 'refreshed',
    nodes: [
      { id: 'node-1', title: 'Límites actualizado' },
      { id: 'node-2', title: 'Continuidad' },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialPreview)
    .mockResolvedValueOnce(initialPreview)
    .mockResolvedValueOnce(refreshedPreview)
    .mockResolvedValue(refreshedPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  const confirm = within(dialog).getByRole('button', { name: 'Bloquear rama' });

  await user.click(confirm);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'initial'),
  );
  await waitFor(() => expect(dialog.textContent).toContain('Límites actualizado'));
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(changeTeacherBlock).toHaveBeenCalledTimes(1);

  await user.click(confirm);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'refreshed'),
  );
  expect(changeTeacherBlock).toHaveBeenCalledTimes(2);
});

test('requires a renewed confirmation when the teacher-block preview changed', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'one',
      nodes: [{ id: 'node-1', title: 'Límites' }],
    })
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'two',
      nodes: [
        { id: 'node-1', title: 'Límites' },
        { id: 'node-3', title: 'Derivadas' },
      ],
    })
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'two',
      nodes: [
        { id: 'node-1', title: 'Límites' },
        { id: 'node-3', title: 'Derivadas' },
      ],
    });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  await user.click(within(dialog).getByRole('button', { name: 'Bloquear rama' }));

  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Derivadas');

  await user.click(within(dialog).getByRole('button', { name: 'Bloquear rama' }));
  await waitFor(() => expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'two'));
});

test('shows both unlock scopes as declarative sections and confirms individual operation', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
    ],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
      {
        id: 'node-2',
        title: 'Continuidad',
        relation: 'DEPENDENT' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  const individualSection = within(dialog).getByRole('region', { name: 'Solo este Nodo' });
  const branchSection = within(dialog).getByRole('region', { name: 'Este Nodo y su rama' });
  expect(within(individualSection).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(individualSection).getByText('Nodo seleccionado')).toBeTruthy();
  expect(within(individualSection).getByText('Contenido')).toBeTruthy();
  expect(within(branchSection).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(branchSection).getByRole('listitem', { name: 'Continuidad' })).toBeTruthy();
  expect(within(branchSection).getByText('Nodo seleccionado')).toBeTruthy();
  expect(within(branchSection).getByText('Dependiente')).toBeTruthy();
  expect(within(branchSection).getAllByText('Contenido')).toHaveLength(2);
  expect(within(dialog).getAllByLabelText('Contenido')).toHaveLength(3);
  expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
});

test('confirms the branch unlock alternative from the same preview pair', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
      },
    ],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  expect(within(dialog).getByText('Continuidad')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear la rama' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BRANCH_UNLOCK', 'branch'),
  );
});

test('revalidates only the individual unlock preview before mutating', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
  expect(previewTeacherBlock).toHaveBeenCalledTimes(3);
  expect(previewTeacherBlock).toHaveBeenNthCalledWith(3, 'node-1', 'UNBLOCK');
});

test('revalidates only the branch unlock preview before mutating', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(branchPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear la rama' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BRANCH_UNLOCK', 'branch'),
  );
  expect(previewTeacherBlock).toHaveBeenCalledTimes(3);
  expect(previewTeacherBlock).toHaveBeenNthCalledWith(3, 'node-1', 'BRANCH_UNLOCK');
});

test('disables both unlock actions while revalidating and marks only the chosen action pending', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  let resolveRevalidation!: (preview: typeof individualPreview) => void;
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockImplementationOnce(
      () =>
        new Promise<typeof individualPreview>((resolve) => {
          resolveRevalidation = resolve;
        }),
    );
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  const individualAction = within(dialog).getByRole('button', {
    name: 'Desbloquear este Nodo',
  });
  const branchAction = within(dialog).getByRole('button', { name: 'Desbloquear la rama' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });

  await user.click(individualAction);

  await waitFor(() => {
    expect((individualAction as HTMLButtonElement).disabled).toBe(true);
    expect((branchAction as HTMLButtonElement).disabled).toBe(true);
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
  });
  expect(individualAction.getAttribute('aria-busy')).toBe('true');
  expect(within(individualAction).getByTestId('confirmation-progress')).toBeTruthy();
  expect(branchAction.getAttribute('aria-busy')).toBeNull();
  expect(within(branchAction).queryByTestId('confirmation-progress')).toBeNull();

  resolveRevalidation(individualPreview);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
});

test('keeps both unlock scopes recoverable after a failed mutation', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividualPreview = {
    mode: 'SINGLE' as const,
    version: 'single-refreshed',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const refreshedBranchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch-refreshed',
    nodes: [
      { id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(refreshedIndividualPreview)
    .mockResolvedValueOnce(refreshedBranchPreview)
    .mockResolvedValueOnce(refreshedIndividualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenNthCalledWith(1, 'node-1', 'UNBLOCK', 'single'),
  );
  await waitFor(() => expect(dialog.textContent).toContain('Límites actualizado'));
  expect(within(dialog).getByRole('list', { name: 'Solo este Nodo' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Este Nodo y su rama' })).toBeTruthy();
  expect(
    (within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenNthCalledWith(2, 'node-1', 'UNBLOCK', 'single-refreshed'),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('uses one affirmative action when blocked prerequisites determine the unlock scope', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce({
      mode: 'UPSTREAM' as const,
      version: 'upstream',
      nodes: [
        { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
        { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      ],
    })
    .mockResolvedValueOnce({
      mode: 'UPSTREAM' as const,
      version: 'upstream',
      nodes: [
        { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
        { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      ],
    });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear prerrequisitos' });
  expect(within(dialog).getAllByRole('button')).toHaveLength(2);
  expect(within(dialog).queryByRole('button', { name: 'Desbloquear la rama' })).toBeNull();
  expect(within(dialog).getByRole('button', { name: 'Desbloquear 2 nodos' })).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear 2 nodos' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'upstream'),
  );
});

test('refreshes both unlock scopes and requires a new action when the selected preview is stale', async () => {
  const user = userEvent.setup();
  const initialIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-one',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const initialBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-one',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-two',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const refreshedBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-two',
    nodes: [
      { id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const },
      { id: 'node-3', title: 'Derivadas', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialIndividual)
    .mockResolvedValueOnce(initialBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(refreshedBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(refreshedBranch);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() => expect(previewTeacherBlock).toHaveBeenCalledTimes(4));
  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Límites actualizado');
  expect(dialog.textContent).toContain('Derivadas');

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single-two'),
  );
});

test('switches to upstream confirmation when the companion scope becomes upstream', async () => {
  const user = userEvent.setup();
  const initialIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-one',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const initialBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-one',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-two',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const upstreamPreview = {
    mode: 'UPSTREAM' as const,
    version: 'upstream-one',
    nodes: [
      { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
      { id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialIndividual)
    .mockResolvedValueOnce(initialBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(upstreamPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() => expect(previewTeacherBlock).toHaveBeenCalledTimes(4));
  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog', { name: 'Desbloquear prerrequisitos' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Desbloquear la rama' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Desbloquear 2 nodos' })).toBeTruthy();
});
