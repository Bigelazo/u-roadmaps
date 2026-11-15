import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import GlobalNavigation from '@/app/_components/GlobalNavigation';

vi.mock('@/app/_components/SessionButton', () => ({
  default: ({ isAuthenticated }: { isAuthenticated: boolean }) => (
    <button type="button">{isAuthenticated ? 'Cerrar sesión' : 'Autenticarse'}</button>
  ),
}));

function stubReducedMotion(reducedMotion: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  document.cookie = 'theme=; Path=/; Max-Age=0';
});

test.each([
  [true, 'María Pérez González', 'Cerrar sesión'],
  [false, null, 'Autenticarse'],
])(
  'preserves the home destination and authentication action when authenticated is %s',
  (isAuthenticated, userName, actionName) => {
    render(<GlobalNavigation isAuthenticated={isAuthenticated} userName={userName} />);

    expect(screen.getByRole('banner')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'U-Roadmaps' })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
    expect(screen.getByRole('button', { name: actionName })).not.toBeNull();
  },
);

test('shows the first name and two surnames of the authenticated person', () => {
  render(<GlobalNavigation isAuthenticated userName="María José Pérez González" />);

  expect(screen.getByText('María Pérez González')).not.toBeNull();
});

test('alternates between the light and the dark theme and remembers each choice', () => {
  stubReducedMotion(true);
  render(<GlobalNavigation isAuthenticated={false} userName={null} />);

  fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));

  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.cookie).toContain('theme=dark');
  expect(screen.queryByRole('menu')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema claro' }));

  expect(document.documentElement.dataset.theme).toBe('light');
  expect(document.cookie).toContain('theme=light');
  expect(screen.getByRole('button', { name: 'Cambiar a tema oscuro' })).not.toBeNull();
});

test('offers the light theme when the stored preference is dark', () => {
  render(<GlobalNavigation isAuthenticated={false} userName={null} theme="dark" />);

  expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).not.toBeNull();
});
