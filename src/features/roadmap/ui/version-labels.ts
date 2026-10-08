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

type VersionOrigin = RoadmapVersionHistory['versions'][number]['origin'];

export function originLabel(origin: VersionOrigin): string {
  switch (origin.kind) {
    case 'COPY':
      return `Copiada de la edición ${origin.year}-${origin.semester}`;
    case 'EMPTY':
      return 'Creada desde cero';
  }
}
