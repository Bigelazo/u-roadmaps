import type { CSSProperties } from 'react';
import { cn } from 'cn';
import { positionGroupLabel } from './position-labels';
import type { InstitutionalCoursePosition } from '@/shared/institutional-position';

const positionColors: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'var(--position-course-professor)',
  COORDINATING_PROFESSOR: 'var(--position-coordinating-professor)',
  AUXILIARY_PROFESSOR: 'var(--position-auxiliary-professor)',
  TEACHING_ASSISTANT: 'var(--position-teaching-assistant)',
  STUDENT: 'var(--position-student)',
  OBSERVER: 'var(--position-observer)',
};

type Position = InstitutionalCoursePosition | null;

function positionColorStyle(position: Position) {
  return {
    '--position-color': position ? positionColors[position] : 'var(--steel)',
  } as CSSProperties;
}

export function PositionDot({ position }: Readonly<{ position: Position }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full',
        position ? 'bg-(--position-color)' : 'border border-graphite',
      )}
      style={positionColorStyle(position)}
    />
  );
}

export function PositionPlate({
  position,
  className,
}: Readonly<{ position: Position; className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-[color-mix(in_srgb,var(--position-color)_16%,var(--card))] px-2 py-0.5 text-xs font-bold whitespace-nowrap text-ink',
        className,
      )}
      style={positionColorStyle(position)}
    >
      <PositionDot position={position} />
      {position ? positionGroupLabel(position) : 'Equipo docente'}
    </span>
  );
}
