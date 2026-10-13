import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { CreateRoadmapDialog } from '@/features/roadmap/ui/CreateRoadmapDialog';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

test('selects a Roadmap origin by keyboard and disables every choice during creation', async () => {
  const user = userEvent.setup();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versions: [
          {
            year: 2025,
            semester: 1,
            edition: '2025 · Semestre 1',
            creator: null,
            origin: { kind: 'EMPTY' },
          },
        ],
      }),
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetch);
  render(
    <CreateRoadmapDialog courseCode="CC1002" year={2026} semester={1} courseName="Programación" />,
  );
  await user.click(screen.getByRole('button', { name: 'Crear roadmap de Programación' }));

  const origins = await screen.findByRole('radiogroup', { name: 'Origen del roadmap' });
  const empty = within(origins).getByRole('radio', { name: 'Roadmap vacío' });
  await user.click(empty);
  await user.keyboard('{ArrowDown}');
  const previous = within(origins).getByRole('radio', { name: /2025 · Semestre 1/ });
  expect(previous.getAttribute('aria-checked')).toBe('true');
  await user.click(screen.getByRole('button', { name: 'Crear roadmap' }));

  await waitFor(() =>
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/CC1002/2026/1/roadmap',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: { year: 2025, semester: 1 } }),
      }),
    ),
  );
  for (const choice of within(origins).getAllByRole('radio')) {
    expect(choice.getAttribute('aria-disabled')).toBe('true');
  }
});
