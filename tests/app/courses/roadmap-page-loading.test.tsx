import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import RoadmapPageLoading from '@/app/courses/[courseCode]/[year]/[semester]/loading';

test('the Roadmap page shows the canvas loading state while the Course offering synchronizes', () => {
  render(<RoadmapPageLoading />);
  expect(screen.getByRole('status', { name: 'Cargando roadmap...' }).textContent).toContain(
    'Preparando los nodos y sus conexiones.',
  );
  expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true');
});
