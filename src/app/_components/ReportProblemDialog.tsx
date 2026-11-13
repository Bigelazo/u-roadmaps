'use client';

import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Spinner } from '@/shared/ui/spinner';
import { notify } from '@/shared/ui/notify';
import { problemReportEmailPattern, problemReportLimits } from '@/shared/problem-report';

type ReportField = 'name' | 'email' | 'subject' | 'description';
type ReportDraft = Record<ReportField, string>;
type FieldErrors = Partial<Record<ReportField, string>>;

const emptyDraft: ReportDraft = { name: '', email: '', subject: '', description: '' };
const fieldOrder: readonly ReportField[] = ['name', 'email', 'subject', 'description'];
const sendFailure = 'No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.';

export function draftErrors(draft: ReportDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) errors.name = 'Escribe tu nombre.';
  if (!problemReportEmailPattern.test(draft.email.trim()))
    errors.email = 'Escribe un correo válido, como nombre@ug.uchile.cl.';
  if (!draft.subject.trim()) errors.subject = 'Escribe un asunto breve.';
  if (!draft.description.trim()) errors.description = 'Describe qué ocurrió.';
  return errors;
}

async function responseMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === 'string') return body.error.message;
    // eslint-disable-next-line no-empty -- Sin cuerpo JSON se usa el mensaje genérico.
  } catch {}
  return sendFailure;
}

export function ReportProblemDialog({ version }: Readonly<{ version: string }>) {
  const pathname = usePathname();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function fieldId(field: ReportField) {
    return `${formId}-${field}`;
  }

  function change(field: ReportField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function openChanged(next: boolean) {
    if (sending) return;
    setOpen(next);
    if (next) {
      setErrors({});
      setFailure(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = draftErrors(draft);
    setErrors(found);
    setFailure(null);
    const firstInvalid = fieldOrder.find((field) => found[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(firstInvalid))}`)?.focus();
      return;
    }
    setSending(true);
    const response = await fetch('/api/problem-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, pageUrl: `${window.location.origin}${pathname}`, version }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      setFailure(response ? await responseMessage(response) : sendFailure);
      return;
    }
    setOpen(false);
    setDraft(emptyDraft);
    notify.success('Reporte enviado. Gracias por avisarnos.');
  }

  function describedBy(field: ReportField, ...extra: string[]) {
    return [errors[field] ? `${fieldId(field)}-error` : null, ...extra].filter(Boolean).join(' ');
  }

  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4 outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50">
        Reportar un problema
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-1.5 px-6 pt-6 pb-5">
          <DialogTitle className="font-heading text-[22px] leading-[1.15] font-semibold tracking-[-0.4px] text-ink">
            Reportar un problema
          </DialogTitle>
          <DialogDescription className="max-w-[52ch] text-graphite">
            Cuéntanos qué ocurrió. Si hace falta más información, te escribiremos al correo que
            indiques.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          onSubmit={submit}
          aria-busy={sending}
          className="grid gap-5 border-t border-fog px-6 py-5"
        >
          <fieldset disabled={sending} className="grid gap-5 sm:grid-cols-2 sm:gap-x-4">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={fieldId('name')}>Nombre</FieldLabel>
              <Input
                id={fieldId('name')}
                name="name"
                autoComplete="name"
                maxLength={problemReportLimits.name}
                value={draft.name}
                onChange={(event) => change('name', event.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={describedBy('name') || undefined}
                className="h-11"
              />
              <FieldError id={`${fieldId('name')}-error`}>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor={fieldId('email')}>Correo</FieldLabel>
              <Input
                id={fieldId('email')}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                maxLength={problemReportLimits.email}
                value={draft.email}
                onChange={(event) => change('email', event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describedBy('email') || undefined}
                className="h-11"
              />
              <FieldError id={`${fieldId('email')}-error`}>{errors.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.subject)} className="sm:col-span-2">
              <FieldLabel htmlFor={fieldId('subject')}>Asunto</FieldLabel>
              <Input
                id={fieldId('subject')}
                name="subject"
                maxLength={problemReportLimits.subject}
                value={draft.subject}
                onChange={(event) => change('subject', event.target.value)}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={describedBy('subject') || undefined}
                className="h-11"
              />
              <FieldError id={`${fieldId('subject')}-error`}>{errors.subject}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.description)} className="sm:col-span-2">
              <FieldLabel htmlFor={fieldId('description')}>Descripción</FieldLabel>
              <FieldDescription id={`${fieldId('description')}-hint`} className="text-graphite">
                Qué hacías, qué esperabas que ocurriera y qué ocurrió.
              </FieldDescription>
              <Textarea
                id={fieldId('description')}
                name="description"
                rows={6}
                maxLength={problemReportLimits.description}
                value={draft.description}
                onChange={(event) => change('description', event.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={describedBy('description', `${fieldId('description')}-hint`)}
                className="field-sizing-fixed min-h-36 resize-y"
              />
              <FieldError id={`${fieldId('description')}-error`}>{errors.description}</FieldError>
            </Field>
          </fieldset>
          <p className="text-xs text-graphite">
            El reporte incluye la página actual y la versión{' '}
            <span className="tabular-nums">v{version}</span>.
          </p>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
          <DialogFooter className="-mx-6 -mb-5 border-fog bg-cloud px-6 py-4">
            <DialogClose render={<Button variant="outline" type="button" disabled={sending} />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" role={undefined} />
              ) : (
                <Send aria-hidden="true" data-icon="inline-start" />
              )}
              {sending ? 'Enviando reporte…' : 'Enviar reporte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
