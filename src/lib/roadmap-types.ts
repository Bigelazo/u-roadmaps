import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import type { StudentNodeAccess } from '@/lib/roadmap-access';

export type Resource = {
  id: string;
  title: string;
  url: string;
  type: 'FILE' | 'LINK' | 'VIDEO';
};

export type NodeType = {
  id: string;
  name: string;
  color: string;
  isPredefined: boolean;
};

type RoadmapNodeSummary = {
  id: string;
  title: string;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
};

type RoadmapNodeDetails = RoadmapNodeSummary & {
  description: string | null;
  isCompleted?: boolean;
  canComplete?: boolean;
  resources: Resource[];
};

export type VisibleRoadmapNode = RoadmapNodeDetails & {
  isVisible: true;
  isTeacherBlocked: boolean;
};

export type HiddenRoadmapNode = RoadmapNodeDetails & {
  isVisible: false;
  isTeacherBlocked: false;
};

export type RoadmapNode = VisibleRoadmapNode | HiddenRoadmapNode;

export type StudentAccessibleRoadmapNode = RoadmapNodeSummary & {
  isVisible: true;
  access: Extract<StudentNodeAccess, { status: 'ACCESSIBLE' }>;
  description: string | null;
  isCompleted: boolean;
  canComplete: boolean;
  resources: Resource[];
};

export type StudentBlockedRoadmapNode = RoadmapNodeSummary & {
  access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>;
};

export type StudentRoadmapNode = StudentAccessibleRoadmapNode | StudentBlockedRoadmapNode;

export type RoadmapDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: DependencyHandle;
  targetHandle: DependencyHandle;
};

export type DependencyHandle = 'top' | 'right' | 'bottom' | 'left';

export type RoadmapDto = {
  course: { code: string; name: string; department: string };
  courseOffering: { id: string; year: number; semester: number };
  roadmap: { id: string };
  nodeTypes: NodeType[];
  nodes: RoadmapNode[];
  dependencies: RoadmapDependency[];
};

export function roadmapUrl(identifier: CourseOfferingIdentifier, suffix = ''): string {
  return `/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap${suffix}`;
}
