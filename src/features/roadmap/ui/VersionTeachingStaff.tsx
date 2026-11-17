import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';
import { creatorLabel } from '@/features/roadmap/ui/version-labels';
import { StaffByPosition } from '@/features/roadmap/ui/StaffByPosition';

type Version = RoadmapVersionHistory['versions'][number];
export function VersionTeachingStaff({
  creator,
  teachingStaff,
  layout = 'compact',
}: Readonly<Pick<Version, 'creator' | 'teachingStaff'> & { layout?: 'compact' | 'inline' }>) {
  const creatorIsStaff = teachingStaff.some(({ id }) => id === creator?.id);
  return (
    <div className="grid gap-3 text-sm">
      {teachingStaff.length === 0 ? (
        <p className="text-muted-foreground">Sin registro del equipo docente</p>
      ) : (
        <StaffByPosition
          layout={layout}
          staff={teachingStaff}
          memberKey={(member) => member.id}
          memberDetail={(member) => (member.id === creator?.id ? 'Creó la versión' : null)}
        />
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
