import Link from 'next/link';
import { originLabel } from '@/features/roadmap/ui/version-labels';
import { versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';

type Version = RoadmapVersionHistory['versions'][number];

export function VersionOrigin({
  origin,
  courseCode,
  openEditions,
}: Readonly<{
  origin: Version['origin'];
  courseCode: string;
  openEditions: readonly { year: number; semester: number }[];
}>) {
  const label = originLabel(origin);
  const canOpenSource =
    origin.kind === 'COPY' &&
    openEditions.some(({ year, semester }) => year === origin.year && semester === origin.semester);
  if (origin.kind === 'COPY' && canOpenSource)
    return (
      <Link
        className="w-fit text-sm text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-current focus-visible:decoration-current"
        href={versionUrl({ courseCode, year: origin.year, semester: origin.semester })}
      >
        {label}
      </Link>
    );
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
