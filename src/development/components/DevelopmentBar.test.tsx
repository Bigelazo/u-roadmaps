import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import DevelopmentBar from './DevelopmentBar';

const { refresh, replace } = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/academic-overview',
  useRouter: () => ({ refresh, replace }),
}));

afterEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

test('developer can open the persona menu and select a persona', async () => {
  const user = userEvent.setup();
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetch);

  render(
    <DevelopmentBar
      personas={[{ id: '10000000-0000-4000-8000-000000000001', label: 'Docente: Ana Pérez' }]}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Cambiar perfil de desarrollo' }));
  expect(screen.getByRole('menu')).not.toBeNull();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Cambiar perfil de desarrollo' }));
  await user.click(screen.getByRole('menuitem', { name: 'Docente: Ana Pérez' }));

  expect(fetch).toHaveBeenCalledWith('/api/development/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '10000000-0000-4000-8000-000000000001' }),
  });
  expect(replace).toHaveBeenCalledWith('/academic-overview');
  expect(refresh).toHaveBeenCalledOnce();
});
