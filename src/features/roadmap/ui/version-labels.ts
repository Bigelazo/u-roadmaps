import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import type { RoadmapVersionHistory } from '@/features/roadmap/server';

export const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

export const originLabels: Record<
  RoadmapVersionHistory['versions'][number]['origin']['kind'],
  string
> = {
  EMPTY: 'Creada desde cero',
};
