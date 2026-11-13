import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RepositoryLink } from '@/app/_components/RepositoryLink';

const href = 'https://github.com/Bigelazo/u-roadmaps';

test('names the repository with its star count', () => {
  render(<RepositoryLink href={href} stars={12} />);

  const link = screen.getByRole('link', { name: 'Repositorio en GitHub, 12 estrellas' });
  expect(link.getAttribute('href')).toBe(href);
  expect(link.textContent).toBe('12');
});

test('uses the singular for a single star', () => {
  render(<RepositoryLink href={href} stars={1} />);

  expect(screen.getByRole('link', { name: 'Repositorio en GitHub, 1 estrella' }).textContent).toBe(
    '1',
  );
});

test('abbreviates large star counts on screen and spells them out for assistive technology', () => {
  render(<RepositoryLink href={href} stars={1234} />);

  const link = screen.getByRole('link', { name: 'Repositorio en GitHub, 1.234 estrellas' });
  expect(link.textContent?.replace(/\s/g, ' ')).toBe('1,2 K');
});

test('keeps the repository link without a count when the stars are unknown', () => {
  render(<RepositoryLink href={href} stars={null} />);

  const link = screen.getByRole('link', { name: 'Repositorio en GitHub' });
  expect(link.textContent).toBe('');
});
