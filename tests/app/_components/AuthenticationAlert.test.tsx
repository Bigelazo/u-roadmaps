import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import AuthenticationAlert from '@/app/_components/AuthenticationAlert';

const navigation = vi.hoisted(() => ({
  error: 'Authentication',
  pathname: '/',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams({ error: navigation.error }),
}));

afterEach(() => {
  navigation.error = 'Authentication';
  navigation.pathname = '/';
  navigation.replace.mockReset();
});

test('shows the authentication failure on the landing page and dismisses it without reloading', async () => {
  const user = userEvent.setup();

  render(<AuthenticationAlert />);

  expect(
    screen.getByRole('alert', { name: 'No pudimos completar tu ingreso con U-Pasaporte.' }),
  ).not.toBeNull();
  expect(
    screen.getByText(
      'La respuesta de U-Pasaporte expiró o llegó incompleta. Vuelve a ingresar con U-Pasaporte.',
    ),
  ).not.toBeNull();

  await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }));

  expect(navigation.replace).toHaveBeenCalledWith('/');
});

test('explains that institutional sign-in could not start', () => {
  navigation.error = 'AuthenticationUnavailable';

  render(<AuthenticationAlert />);

  expect(
    screen.getByRole('alert', { name: 'El ingreso con U-Pasaporte no está disponible.' }),
  ).not.toBeNull();
});

test('does not show the alert for other routes or authentication states', () => {
  navigation.pathname = '/academic-overview';
  const { rerender } = render(<AuthenticationAlert />);

  expect(screen.queryByRole('alert')).toBeNull();

  navigation.pathname = '/';
  navigation.error = 'AccessDenied';
  rerender(<AuthenticationAlert />);

  expect(screen.queryByRole('alert')).toBeNull();
});
