import type { Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';

export type { RoadmapNodeState, RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';

/** Called inside the mutation transaction. Returned work runs only after its successful commit. */
export interface RoadmapChangePort {
  report(
    transaction: Prisma.TransactionClient,
    changes: RoadmapChanges,
  ): Promise<void | (() => void | Promise<void>)>;
}
