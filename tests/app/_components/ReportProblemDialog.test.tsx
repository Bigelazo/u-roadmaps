import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

async function fillReport(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Correo'), 'ana@ug.uchile.cl');
  await user.type(screen.getByLabelText('Asunto'), 'No carga un recurso');
  await user.type(screen.getByLabelText('Descripción'), 'El PDF no abre.');
}

test('sends only one report when two submissions arrive before React updates the controls', async () => {
  let finish!: (response: Response) => void;
  const fetchReport = vi.fn().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  vi.stubGlobal('fetch', fetchReport);
  const user = await openDialog();
  await fillReport(user);
  const form = screen.getByLabelText<HTMLInputElement>('Nombre').form!;

  act(() => {
    form.requestSubmit();
    form.requestSubmit();
  });

  expect(fetchReport).toHaveBeenCalledTimes(1);
  await act(async () => finish(Response.json({ sent: true }, { status: 201 })));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('keeps the report locked until an error response body is read and then allows retry', async () => {
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        body = controller;
      },
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  const fetchReport = vi
    .fn()
    .mockResolvedValueOnce(response)
    .mockResolvedValueOnce(Response.json({ sent: true }, { status: 201 }));
  vi.stubGlobal('fetch', fetchReport);
  const user = await openDialog();
  await fillReport(user);
  await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));

  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Enviando reporte…' }).disabled,
  ).toBe(true);
  fireEvent.submit(screen.getByLabelText<HTMLInputElement>('Nombre').form!);
  expect(fetchReport).toHaveBeenCalledTimes(1);

  await act(async () => {
    body.enqueue(
      new TextEncoder().encode(JSON.stringify({ error: { message: 'Servicio ocupado.' } })),
    );
    body.close();
  });
  expect(await screen.findByText('Servicio ocupado.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Enviar reporte' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(fetchReport).toHaveBeenCalledTimes(2);
});
