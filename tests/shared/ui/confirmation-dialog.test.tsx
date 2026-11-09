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

test('Escape and the cancellation button both cancel', async () => {
  const user = userEvent.setup();
  const leave = vi.fn();
  render(
    <ConfirmationDialog
      confirmation={{ ...singleActionConfirmation, cancelLabel: 'Salir' }}
      onAction={vi.fn()}
      onCancel={leave}
      className="tutorial-confirmation"
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  expect(dialog.classList.contains('tutorial-confirmation')).toBe(true);
  await user.keyboard('{Escape}');
  expect(leave).toHaveBeenCalledOnce();
  await user.click(within(dialog).getByRole('button', { name: 'Salir' }));
  expect(leave).toHaveBeenCalledTimes(2);
});

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

test('activates a focused action from the keyboard', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();

  render(
    <ConfirmationDialog
      confirmation={twoActionConfirmation}
      onAction={onAction}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear Nodo' });
  const branchAction = within(dialog).getByRole('button', { name: 'Desbloquear la rama' });
  branchAction.focus();

  await user.keyboard('{Enter}');

  expect(onAction).toHaveBeenCalledWith('branch');
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

test('renders supplementary content between the description and the actions', async () => {
  render(
    <ConfirmationDialog
      confirmation={{
        ...singleActionConfirmation,
        content: <p>Contenido adicional</p>,
      }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Archivar cambios' });
  expect(within(dialog).getByText('Contenido adicional')).toBeTruthy();
});

test('lets every action share the primary emphasis and disables an unavailable action', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(
    <ConfirmationDialog
      confirmation={{
        ...twoActionConfirmation,
        actions: [
          { id: 'node', label: 'Desbloquear este Nodo', emphasis: 'primary' },
          { id: 'branch', label: 'Desbloquear la rama', emphasis: 'primary', disabled: true },
        ],
      }}
      onAction={onAction}
      onCancel={vi.fn()}
    />,
  );

  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear Nodo' });
  const node = within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' });
  const branch = within(dialog).getByRole('button', { name: 'Desbloquear la rama' });
  expect(node.getAttribute('data-emphasis')).toBe('primary');
  expect(branch.getAttribute('data-emphasis')).toBe('primary');
  expect((branch as HTMLButtonElement).disabled).toBe(true);
  await user.click(node);
  expect(onAction).toHaveBeenCalledWith('node');
});

test('opens on Cancel, then restores focus to the element that opened the confirmation', async () => {
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
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
  await waitFor(() => expect(cancel.matches(':focus')).toBe(true));
  await user.click(cancel);

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
