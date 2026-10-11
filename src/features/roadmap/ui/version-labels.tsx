import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';

const positionLabels: Record<InstitutionalCoursePosition, string> = {
  COURSE_PROFESSOR: 'Profesor de cátedra',
  COORDINATING_PROFESSOR: 'Profesor coordinador',
  AUXILIARY_PROFESSOR: 'Auxiliar',
  TEACHING_ASSISTANT: 'Ayudante',
  STUDENT: 'Estudiante',
  OBSERVER: 'Oyente',
};

type Version = RoadmapVersionHistory['versions'][number];

/** Roadmaps that predate recorded authorship never get an inferred creator. */
export function creatorLabel(creator: { name: string } | null): string {
  return creator?.name ?? 'Creador no registrado';
}

export function originLabel(origin: Version['origin']): string {
  switch (origin.kind) {
    case 'COPY':
      return `Copiada de la edición ${origin.year}-${origin.semester}`;
    case 'EMPTY':
      return 'Creada desde cero';
  }
}

/** The creator and Teaching staff rows of a version's description list. */
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
