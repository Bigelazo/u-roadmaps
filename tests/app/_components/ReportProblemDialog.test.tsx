import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { ReportProblemDialog } from '@/app/_components/ReportProblemDialog';

vi.mock('next/navigation', () => ({ usePathname: () => '/academic-overview' }));
vi.mock('@/shared/ui/notify', () => ({ notify: { success: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDialog() {
  const user = userEvent.setup();
  render(<ReportProblemDialog version="0.1.0" />);
  await user.click(screen.getByRole('button', { name: 'Reportar un problema' }));
  return user;
}

test('names every missing field and does not send an incomplete report', async () => {
  const fetchReport = vi.fn();
  vi.stubGlobal('fetch', fetchReport);
  const user = await openDialog();

  await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

  expect(screen.getByText('Escribe tu nombre.')).toBeTruthy();
  expect(screen.getByText(/Escribe un correo válido/)).toBeTruthy();
  expect(screen.getByText('Escribe un asunto breve.')).toBeTruthy();
  expect(screen.getByText('Describe qué ocurrió.')).toBeTruthy();
  await user.keyboard('A');
  expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('A');
  expect(fetchReport).not.toHaveBeenCalled();
});

test('sends the report with the current page and version, then closes', async () => {
  const fetchReport = vi.fn().mockResolvedValue(Response.json({ sent: true }, { status: 201 }));
  vi.stubGlobal('fetch', fetchReport);
  const user = await openDialog();

  await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Correo'), 'ana@ug.uchile.cl');
  await user.type(screen.getByLabelText('Asunto'), 'No carga un recurso');
  await user.type(screen.getByLabelText('Descripción'), 'El PDF no abre.');
  await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const [url, init] = fetchReport.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/problem-reports');
  expect(JSON.parse(init.body as string)).toEqual({
    name: 'Ana Pérez',
    email: 'ana@ug.uchile.cl',
    subject: 'No carga un recurso',
    description: 'El PDF no abre.',
    pageUrl: `${window.location.origin}/academic-overview`,
    version: '0.1.0',
  });
});

test('keeps the draft and shows the server message when sending fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { message: 'Los reportes no están disponibles por ahora.' } },
          { status: 503 },
        ),
      ),
  );
  const user = await openDialog();

  await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Correo'), 'ana@ug.uchile.cl');
  await user.type(screen.getByLabelText('Asunto'), 'No carga');
  await user.type(screen.getByLabelText('Descripción'), 'El PDF no abre.');
  await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

  expect(await screen.findByText('Los reportes no están disponibles por ahora.')).toBeTruthy();
  expect((screen.getByLabelText('Asunto') as HTMLInputElement).value).toBe('No carga');
});
