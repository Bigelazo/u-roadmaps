import 'server-only';

import nodemailer from 'nodemailer';
import { ApplicationError } from '@/shared/errors/server';
import { problemReportEmailPattern, problemReportLimits } from '@/shared/problem-report';

export type ProblemReport = Readonly<{
  name: string;
  email: string;
  subject: string;
  description: string;
  pageUrl: string | null;
  version: string | null;
}>;

function singleLine(value: unknown, maximum: number, message: string) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > maximum) throw new ApplicationError(400, 'INVALID_REQUEST', message);
  return text;
}

function optionalSingleLine(value: unknown, maximum: number) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maximum) : null;
}

export function parseProblemReport(body: Record<string, unknown>): ProblemReport {
  const name = singleLine(body.name, problemReportLimits.name, 'Escribe tu nombre.');
  const email = singleLine(body.email, problemReportLimits.email, 'Escribe un correo válido.');
  if (!problemReportEmailPattern.test(email))
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Escribe un correo válido.');
  const subject = singleLine(body.subject, problemReportLimits.subject, 'Escribe un asunto.');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description || description.length > problemReportLimits.description)
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Describe el problema.');
  return {
    name,
    email,
    subject,
    description,
    pageUrl: optionalSingleLine(body.pageUrl, 500),
    version: optionalSingleLine(body.version, 40),
  };
}

type MailSettings = Readonly<{ transportUrl: string; sender: string; recipient: string }>;

function mailSettings(): MailSettings {
  const recipient = process.env.PROBLEM_REPORT_EMAIL;
  const transportUrl = process.env.SMTP_URL;
  const sender = process.env.SMTP_FROM;
  if (!recipient || !transportUrl || !sender)
    throw new ApplicationError(
      503,
      'PROBLEM_REPORTS_UNAVAILABLE',
      'Los reportes no están disponibles por ahora. Inténtalo más tarde.',
    );
  return { recipient, transportUrl, sender };
}

export function problemReportText(report: ProblemReport) {
  return [
    report.description,
    '',
    '---',
    `Nombre: ${report.name}`,
    `Correo: ${report.email}`,
    ...(report.pageUrl ? [`Página: ${report.pageUrl}`] : []),
    ...(report.version ? [`Versión: ${report.version}`] : []),
  ].join('\n');
}

export async function sendProblemReport(report: ProblemReport) {
  const { recipient, transportUrl, sender } = mailSettings();
  const transport = nodemailer.createTransport(transportUrl);
  try {
    await transport.sendMail({
      from: sender,
      to: recipient,
      replyTo: { name: report.name, address: report.email },
      subject: `[U-Roadmaps] ${report.subject}`,
      text: problemReportText(report),
    });
  } catch (error) {
    console.error('[problem-report] no se pudo enviar el correo', error);
    throw new ApplicationError(
      502,
      'PROBLEM_REPORT_NOT_SENT',
      'No se pudo enviar el reporte. Inténtalo de nuevo en unos minutos.',
    );
  }
}
