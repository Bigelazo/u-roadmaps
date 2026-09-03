import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import GlobalNavigation from '@/app/_components/GlobalNavigation';

vi.mock('@/app/_components/SessionButton', () => ({
  default: ({ isAuthenticated }: { isAuthenticated: boolean }) => (
    <button type="button">{isAuthenticated ? 'Cerrar sesión' : 'Autenticarse'}</button>
  ),
}));

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
