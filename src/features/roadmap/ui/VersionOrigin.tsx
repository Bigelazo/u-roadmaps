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
        className="w-fit text-sm text-primary underline-offset-4 hover:underline focus-visible:underline"
        href={versionUrl({ courseCode, year: origin.year, semester: origin.semester })}
      >
        {label}
      </Link>
    );
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
