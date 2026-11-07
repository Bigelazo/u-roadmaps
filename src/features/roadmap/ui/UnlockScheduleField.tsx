'use client';

import { useId } from 'react';
import dynamic from 'next/dynamic';
import { CalendarClock } from 'lucide-react';
import { CHILE_TIME_ZONE } from '@/features/roadmap/domain/scheduled-unlock';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Switch } from '@/shared/ui/switch';

const DateTimePicker = dynamic(
  () => import('@/shared/ui/date-time-picker').then(({ DateTimePicker }) => DateTimePicker),
  { ssr: false, loading: () => <div className="h-11" aria-hidden="true" /> },
);

export const scheduledUnlockPrerequisiteHint =
  'Si a esa hora algún prerrequisito sigue bloqueado, este nodo no se desbloqueará hasta que se desbloqueen sus prerrequisitos.';

export type UnlockScheduleDraft = {
  readonly isScheduling: boolean;
  readonly unlockAt: Date | null;
  readonly onSchedulingChange: (isScheduling: boolean) => void;
  readonly onUnlockAtChange: (unlockAt: Date) => void;
};

export function UnlockScheduleField({
  draft,
  disabled = false,
}: {
  draft: UnlockScheduleDraft;
  disabled?: boolean;
}) {
  const id = useId();
  const switchId = `${id}-switch`;
  const descriptionId = `${id}-description`;

  return (
    <div
      data-slot="unlock-schedule"
      data-scheduling={draft.isScheduling || undefined}
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors data-scheduling:border-primary/30 data-scheduling:bg-primary/5"
    >
      <Field orientation="horizontal" className="items-center gap-3">
        <CalendarClock
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 self-start text-muted-foreground"
        />
        <FieldContent>
          <FieldLabel htmlFor={switchId} className="font-semibold">
            Programar desbloqueo
          </FieldLabel>
          <FieldDescription id={descriptionId}>
            {draft.isScheduling
              ? 'Elige cuándo se desbloqueará automáticamente.'
              : 'Elige un día y una hora en lugar de desbloquear ahora.'}
          </FieldDescription>
        </FieldContent>
        <Switch
          id={switchId}
          aria-describedby={descriptionId}
          checked={draft.isScheduling}
          disabled={disabled}
          onCheckedChange={draft.onSchedulingChange}
        />
      </Field>
      {draft.isScheduling ? (
        <div className="flex animate-in flex-col gap-2 duration-150 fade-in-0 slide-in-from-top-1">
          <DateTimePicker
            value={draft.unlockAt}
            onValueChange={draft.onUnlockAtChange}
            timeZone={CHILE_TIME_ZONE}
            disabled={disabled}
            dayLabel="Día del desbloqueo"
            timeLabel="Hora del desbloqueo"
          />
          <FieldDescription>{scheduledUnlockPrerequisiteHint}</FieldDescription>
        </div>
      ) : null}
    </div>
  );
}
