import { PositionPlate } from '@/shared/ui/position-plate';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';
import { creatorLabel } from '@/features/roadmap/ui/version-labels';

type Version = RoadmapVersionHistory['versions'][number];

export function VersionTeachingStaff({
  creator,
  teachingStaff,
}: Readonly<Pick<Version, 'creator' | 'teachingStaff'>>) {
  const creatorIsStaff = teachingStaff.some(({ id }) => id === creator?.id);
  return (
    <div className="@container grid gap-2 text-sm">
      {teachingStaff.length === 0 ? (
        <p className="text-muted-foreground">Sin registro del equipo docente</p>
      ) : (
        <ul
          aria-label="Equipo docente"
          className="grid gap-2 @md:grid-cols-[max-content_max-content_minmax(0,1fr)] @md:gap-x-3"
        >
          {teachingStaff.map((member) => (
            <li
              className="flex flex-wrap items-center gap-x-2 gap-y-1 @md:col-span-3 @md:grid @md:grid-cols-subgrid"
              key={member.id}
            >
              <span className="font-medium text-ink">{member.name}</span>
              <PositionPlate className="w-fit" position={member.institutionalPosition} />
              {member.id === creator?.id ? (
                <span className="text-xs text-muted-foreground">Creó la versión</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {creatorIsStaff ? null : (
        <p className="text-muted-foreground">
          {creator ? (
            <>
              Creada por <span className="font-medium text-ink">{creator.name}</span>
            </>
          ) : (
            creatorLabel(creator)
          )}
        </p>
      )}
    </div>
  );
}
