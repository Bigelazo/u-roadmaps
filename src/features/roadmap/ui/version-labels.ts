import type { RoadmapVersionHistory } from '@/features/roadmap/version-types';

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
