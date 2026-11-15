import type { InstitutionalCoursePosition } from '@/shared/institutional-position';

const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

export function positionGroupLabel(position: InstitutionalCoursePosition | null) {
  return position ? positionLabels[position] : 'Cargo no informado';
}
