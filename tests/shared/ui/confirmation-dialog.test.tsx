import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ConfirmationDialog, type ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

const singleActionConfirmation = {
  title: 'Archivar cambios',
  description: 'El borrador dejará de estar disponible para edición.',
  intent: 'default',
  actions: [{ id: 'archive', label: 'Archivar' }],
} as const satisfies ConfirmationPresentation;

const twoActionConfirmation = {
  title: 'Desbloquear Nodo',
  description: 'Elige el alcance de la operación.',
  intent: 'warning',
  actions: [
    { id: 'node', label: 'Desbloquear este Nodo' },
    { id: 'branch', label: 'Desbloquear la rama' },
  ],
} as const satisfies ConfirmationPresentation;

test('does not render a confirmation when its presentation is null', () => {
  render(<ConfirmationDialog confirmation={null} onAction={vi.fn()} onCancel={vi.fn()} />);

  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('renders an accessible one-action confirmation and reports its identifier', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();

  render(
    <ConfirmationDialog
      confirmation={singleActionConfirmation}
      onAction={onAction}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
  expect(dialog.textContent).toContain('El borrador dejará de estar disponible para edición.');
  expect(
    (within(dialog).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled,
  ).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));

  expect(onAction).toHaveBeenCalledWith('archive');
});

test('supports an established cancellation label without removing the cancellation action', async () => {
  render(
    <ConfirmationDialog
      confirmation={{ ...singleActionConfirmation, cancelLabel: 'Seguir editando' }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  expect(within(dialog).getByRole('button', { name: 'Seguir editando' })).toBeTruthy();
});

test('uses the intent to provide semantic treatment and fixed action emphasis', async () => {
  render(
    <ConfirmationDialog
      confirmation={{
        ...twoActionConfirmation,
        intent: 'destructive',
      }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear Nodo' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');

  expect(
    within(dialog)
      .getByRole('button', { name: 'Desbloquear este Nodo' })
      .getAttribute('data-emphasis'),
  ).toBe('secondary');
  expect(
    within(dialog)
      .getByRole('button', { name: 'Desbloquear la rama' })
      .getAttribute('data-emphasis'),
  ).toBe('primary');
});

test('renders item and relationship sections, including their empty state', async () => {
  render(
    <ConfirmationDialog
      confirmation={{
        ...singleActionConfirmation,
        sections: [
          {
            title: 'Nodos afectados',
            items: [
              {
                kind: 'item',
                id: 'node-1',
                title: 'Introducción',
                description: 'Contenido inicial',
                media: <span data-testid="node-media">Contenido</span>,
                badge: 'Seleccionado',
              },
            ],
          },
          {
            title: 'Dependencias eliminadas',
            items: [],
            emptyMessage: 'No se eliminarán dependencias.',
          },
          {
            title: 'Relaciones',
            items: [
              {
                kind: 'relationship',
                id: 'dependency-1',
                source: 'Introducción',
                target: 'Evaluación',
                description: 'La primera habilita la segunda.',
              },
            ],
          },
        ],
      }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  const nodes = within(dialog).getByRole('list', { name: 'Nodos afectados' });
  expect(within(nodes).getByRole('listitem', { name: 'Introducción' })).toBeTruthy();
  expect(within(nodes).getByText('Contenido inicial')).toBeTruthy();
  expect(within(nodes).getByText('Seleccionado')).toBeTruthy();
  expect(within(nodes).getByTestId('node-media')).toBeTruthy();

  const dependencies = within(dialog).getByRole('region', {
    name: 'Dependencias eliminadas',
  });
  expect(within(dependencies).getByText('No se eliminarán dependencias.')).toBeTruthy();

  const relationships = within(dialog).getByRole('list', { name: 'Relaciones' });
  expect(
    within(relationships).getByRole('listitem', {
      name: 'Relación: Introducción → Evaluación',
    }),
  ).toBeTruthy();
  expect(within(relationships).getByText('La primera habilita la segunda.')).toBeTruthy();
});

test('cancels and restores focus to the element that opened the confirmation', async () => {
  const user = userEvent.setup();

  function ConfirmationWithTrigger() {
    const [confirmation, setConfirmation] = useState<ConfirmationPresentation | null>(null);

    return (
      <>
        <button type="button" onClick={() => setConfirmation(singleActionConfirmation)}>
          Abrir confirmación
        </button>
        <ConfirmationDialog
          confirmation={confirmation}
          onAction={vi.fn()}
          onCancel={() => setConfirmation(null)}
        />
      </>
    );
  }

  render(<ConfirmationWithTrigger />);
  const trigger = screen.getByRole('button', { name: 'Abrir confirmación' });

  await user.click(trigger);
  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('alertdialog', { name: 'Archivar cambios' })).toBeTruthy();
});

test('keeps a pending confirmation stable and marks only the chosen action as pending', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();

  function PendingConfirmation() {
    const [pendingActionId, setPendingActionId] = useState<string>();

    return (
      <ConfirmationDialog
        confirmation={twoActionConfirmation}
        pendingActionId={pendingActionId}
        onAction={setPendingActionId}
        onCancel={onCancel}
      />
    );
  }

  render(<PendingConfirmation />);
  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear Nodo' });
  const nodeAction = within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' });
  const branchAction = within(dialog).getByRole('button', { name: 'Desbloquear la rama' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });

  await user.click(branchAction);

  await waitFor(() => {
    expect((branchAction as HTMLButtonElement).disabled).toBe(true);
    expect((nodeAction as HTMLButtonElement).disabled).toBe(true);
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
  });
  expect(branchAction.getAttribute('aria-busy')).toBe('true');
  expect(within(branchAction).getByTestId('confirmation-progress')).toBeTruthy();
  expect(nodeAction.getAttribute('aria-busy')).toBeNull();
  expect(within(nodeAction).queryByTestId('confirmation-progress')).toBeNull();

  await user.keyboard('{Escape}');
  await user.click(document.body);

  expect(screen.getByRole('alertdialog', { name: 'Desbloquear Nodo' })).toBeTruthy();
  expect(onCancel).not.toHaveBeenCalled();
});
