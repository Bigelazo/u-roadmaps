import type { Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';

export type { RoadmapNodeState, RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';

export interface RoadmapChangePort {
  report(
    transaction: Prisma.TransactionClient,
    changes: RoadmapChanges,
  ): Promise<void | (() => void | Promise<void>)>;
}
