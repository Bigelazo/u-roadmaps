import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import SessionButton from '@/components/app-shell/SessionButton';

test('requires confirmation before submitting the logout request', async () => {
  const user = userEvent.setup();
  render(<SessionButton isAuthenticated />);

  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

  const dialog = screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' });
  expect(dialog.textContent).toContain('Tendrás que autenticarte nuevamente para ingresar.');

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
