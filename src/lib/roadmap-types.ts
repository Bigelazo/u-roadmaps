import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';

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

export type RoadmapNode = {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
  isVisible: boolean;
  isCompleted?: boolean;
  canComplete?: boolean;
  resources: Resource[];
};

export type RoadmapDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

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
