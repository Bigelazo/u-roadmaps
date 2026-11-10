import type { CSSProperties } from 'react';
import { cn } from 'cn';
import type { InstitutionalCoursePosition } from '@/shared/institutional-position';

export const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

const positionColors: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'var(--position-course-professor)',
  COORDINATING_PROFESSOR: 'var(--position-coordinating-professor)',
  AUXILIARY_PROFESSOR: 'var(--position-auxiliary-professor)',
  TEACHING_ASSISTANT: 'var(--position-teaching-assistant)',
  STUDENT: 'var(--position-student)',
  OBSERVER: 'var(--position-observer)',
};

export function PositionPlate({
  position,
  className,
}: Readonly<{ position: InstitutionalCoursePosition | null; className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-[color-mix(in_srgb,var(--position-color)_16%,var(--card))] px-2 py-0.5 text-xs font-bold whitespace-nowrap text-ink',
        className,
      )}
      style={
        {
          '--position-color': position ? positionColors[position] : 'var(--steel)',
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full',
          position ? 'bg-(--position-color)' : 'border border-graphite',
        )}
      />
      {position ? positionLabels[position] : 'Equipo docente'}
    </span>
  );
}
