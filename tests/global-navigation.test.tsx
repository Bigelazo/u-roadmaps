import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import GlobalNavigation from '@/components/app-shell/GlobalNavigation';

vi.mock('@/components/app-shell/SessionButton', () => ({
  default: ({ isAuthenticated }: { isAuthenticated: boolean }) => (
    <button type="button">{isAuthenticated ? 'Cerrar sesión' : 'Autenticarse'}</button>
  ),
}));

test.each([
  [true, 'Cerrar sesión'],
  [false, 'Autenticarse'],
])(
  'preserves the home destination and authentication action when authenticated is %s',
  (isAuthenticated, actionName) => {
    render(<GlobalNavigation isAuthenticated={isAuthenticated} />);

    expect(screen.getByRole('banner')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'U-Roadmaps' })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
    expect(screen.getByRole('button', { name: actionName })).not.toBeNull();
  },
);
