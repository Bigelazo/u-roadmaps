import type { CourseOfferingIdentifier } from './course-offering';
import type { NodeAccessState } from './node-access';
import type { resourceContentState } from './server/resource-content-state';

/**
 * Roadmap changes: per-object facts the roadmap feature reports through its change
 * port (ADR-0024). Shared so the notifications module can consume them without
 * importing roadmap server code.
 */
export type RoadmapNodeState = Readonly<{
  id: string;
  title: string;
  description: string | null;
  nodeTypeId: string;
  isVisible: boolean;
}>;

/** Facts describe mutations, not notice audiences. Access is computed by roadmap per person. */
export type RoadmapChangeFact =
  | { kind: 'node-created'; nodeId: string; previous: null; current: RoadmapNodeState }
  | {
      kind: 'node-deleted';
      nodeId: string;
      nodeTypeName: string;
      previous: RoadmapNodeState;
      current: null;
    }
  | { kind: 'node-title'; nodeId: string; previous: string; current: string }
  | { kind: 'node-description'; nodeId: string; previous: string | null; current: string | null }
  | {
      kind: 'node-type';
      nodeId: string;
      previous: { id: string; name: string };
      current: { id: string; name: string };
    }
  | { kind: 'node-visibility'; nodeId: string; previous: boolean; current: boolean }
  | {
      kind: 'node-access';
      nodeId: string;
      recipientId: string;
      previous: NodeAccessState;
      current: NodeAccessState;
      nodeTitle: string;
      nodeTypeName: string;
    }
  | {
      kind: 'resource';
      nodeId: string;
      resourceId: string;
      previous: ReturnType<typeof resourceContentState> | null;
      current: ReturnType<typeof resourceContentState> | null;
    }
  | {
      kind: 'dependency';
      dependencyId: string;
      sourceNodeId: string;
      targetNodeId: string;
      previous: boolean;
      current: boolean;
      sourceNode: { title: string; isVisible: boolean };
      targetNode: { title: string; isVisible: boolean };
    }
  | { kind: 'node-type-name'; nodeTypeId: string; previous: string; current: string }
  /** The Roadmap became available (empty or copied); its audience is the notifications module's. */
  | {
      kind: 'roadmap-created';
      previous: null;
      current: {
        courseOfferingId: string;
        courseName: string;
        actorName: string;
        occurredAt: Date;
      };
    }
  | { kind: 'participation-role'; recipientId: string; previous: 'STUDENT'; current: 'TEACHER' };

export type RoadmapChanges = Readonly<{
  actorId: string;
  roadmapId: string;
  identifier: Readonly<CourseOfferingIdentifier>;
  facts: readonly RoadmapChangeFact[];
}>;
