import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const sendMail = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({}));
vi.mock('@/app/_adapters/roadmap', () => ({}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));

const { POST } = await import('@/app/api/problem-reports/route');

const validReport = {
  name: 'Ana Pérez',
  email: 'ana@ug.uchile.cl',
  subject: 'No carga\nun recurso',
  description: 'El PDF no abre.',
  pageUrl: 'https://u-roadmaps.example.test/academic-overview',
  version: '0.1.0',
};

function report(body: unknown) {
  return POST(
    new Request('https://u-roadmaps.example.test/api/problem-reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({});
  vi.stubEnv('PROBLEM_REPORT_EMAIL', 'reportes@example.test');
  vi.stubEnv('SMTP_URL', 'smtp://localhost:2525');
  vi.stubEnv('SMTP_FROM', 'U-Roadmaps <no-reply@example.test>');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('emails the report to the configured address and lets the maintainer reply to the reporter', async () => {
  const response = await report(validReport);

  expect(response.status).toBe(201);
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: 'U-Roadmaps <no-reply@example.test>',
      to: 'reportes@example.test',
      replyTo: { name: 'Ana Pérez', address: 'ana@ug.uchile.cl' },
      subject: '[U-Roadmaps] No carga un recurso',
    }),
  );
  const { text } = sendMail.mock.calls[0]![0] as { text: string };
  expect(text).toContain('El PDF no abre.');
  expect(text).toContain('Página: https://u-roadmaps.example.test/academic-overview');
  expect(text).toContain('Versión: 0.1.0');
});

test('rejects a report without a valid email', async () => {
  const response = await report({ ...validReport, email: 'ana' });

  expect(response.status).toBe(400);
  expect(sendMail).not.toHaveBeenCalled();
});

test('explains that reports are unavailable when no recipient is configured', async () => {
  vi.stubEnv('PROBLEM_REPORT_EMAIL', '');

  const response = await report(validReport);

  expect(response.status).toBe(503);
  expect(sendMail).not.toHaveBeenCalled();
});

test('reports a delivery failure without losing the reason in the logs', async () => {
  sendMail.mockRejectedValue(new Error('connection refused'));
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const response = await report(validReport);

  expect(response.status).toBe(502);
});
