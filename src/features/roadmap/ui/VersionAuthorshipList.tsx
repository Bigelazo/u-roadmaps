import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';
import { creatorLabel } from '@/features/roadmap/ui/version-labels';

const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

type Version = RoadmapVersionHistory['versions'][number];

export function VersionAuthorshipList({
  creator,
  teachingStaff,
}: Readonly<Pick<Version, 'creator' | 'teachingStaff'>>) {
  return (
    <>
      <dt className="font-semibold">Creada por</dt>
      <dd>{creatorLabel(creator)}</dd>
      <dt className="font-semibold">Equipo docente</dt>
      <dd>
        {teachingStaff.length === 0 ? (
          'Sin registro'
        ) : (
          <ul className="grid gap-1">
            {teachingStaff.map((member) => (
              <li key={member.id}>
                {member.name}
                {member.institutionalPosition
                  ? ` · ${positionLabels[member.institutionalPosition]}`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </>
  );
}
