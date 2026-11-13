import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ReportProblemLink } from '@/app/_components/ReportProblemLink';

vi.mock('next/navigation', () => ({ usePathname: () => '/academic-overview' }));

test('opens a prefilled email to the maintainer with the page URL and version', () => {
  render(<ReportProblemLink version="0.1.0" />);

  const href = screen.getByRole('link', { name: 'Reportar un problema' }).getAttribute('href')!;
  const url = new URL(href);
  expect(url.protocol).toBe('mailto:');
  expect(url.pathname).toBe('danielramirez@ug.uchile.cl');
  expect(url.searchParams.get('subject')).toBe('Problema en U-Roadmaps');
  const body = url.searchParams.get('body')!;
  expect(body).toContain('¿Qué ocurrió?');
  expect(body).toContain(`${window.location.origin}/academic-overview`);
  expect(body).toContain('0.1.0');
});
