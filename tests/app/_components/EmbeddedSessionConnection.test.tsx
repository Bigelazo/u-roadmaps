import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { EmbeddedSessionConnection } from '@/app/_components/EmbeddedSessionConnection';

const requestStorageAccess = vi.fn<() => Promise<void>>();

function grantStorageAccess({
  granted,
  request,
}: {
  granted: boolean;
  request: () => Promise<void>;
}) {
  requestStorageAccess.mockImplementation(request);
  Object.defineProperties(document, {
    hasStorageAccess: { configurable: true, value: () => Promise.resolve(granted) },
    requestStorageAccess: { configurable: true, value: requestStorageAccess },
  });
}

afterEach(() => {
  requestStorageAccess.mockReset();
  Reflect.deleteProperty(document, 'hasStorageAccess');
  Reflect.deleteProperty(document, 'requestStorageAccess');
});

test('asks for permission to use the U-Roadmaps session when the frame lacks storage access', async () => {
  const user = userEvent.setup();
  grantStorageAccess({ granted: false, request: () => Promise.resolve() });

  render(<EmbeddedSessionConnection />);
  await user.click(await screen.findByRole('button', { name: 'Conectar' }));

  expect(requestStorageAccess).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('link', { name: 'Ingresar con U-Pasaporte' })).toBeNull();
});

test('offers to log in through a new tab when the browser denies storage access', async () => {
  const user = userEvent.setup();
  grantStorageAccess({ granted: false, request: () => Promise.reject(new Error('denied')) });

  render(<EmbeddedSessionConnection />);
  await user.click(await screen.findByRole('button', { name: 'Conectar' }));

  const login = await screen.findByRole('link', { name: 'Ingresar con U-Pasaporte' });
  expect(login.getAttribute('href')).toBe('/api/plogin/start');
  expect(login.getAttribute('target')).toBe('_blank');
});

test('goes straight to logging in when the frame already shares the session storage', async () => {
  grantStorageAccess({ granted: true, request: () => Promise.resolve() });

  render(<EmbeddedSessionConnection />);

  expect(await screen.findByRole('heading', { name: 'Ingresa a U-Roadmaps' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ya ingresé' })).toBeTruthy();
});
