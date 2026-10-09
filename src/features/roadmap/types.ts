import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';

export type CourseOfferingIdentifier = {
  courseCode: string;
  year: number;
  semester: number;
};

export type StudentNodeBlockReason = 'TEACHER_BLOCK' | 'PREREQUISITE_BLOCK';

export type StudentNodeAccess =
  { status: 'ACCESSIBLE' } | { status: 'BLOCKED'; reason: StudentNodeBlockReason };

export type Resource = {
  id: string;
  title: string;
  url: string;
  type: 'FILE' | 'LINK' | 'VIDEO';
};

export type NodeType = {
  id: string;
  name: string;
  icon: NodeTypeIconId;
  color: NodeTypeColor;
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
  /** Chilean calendar day (`YYYY-MM-DD`) on which its Teacher block is scheduled to end. */
  teacherUnlockOn?: string;
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

export type RoadmapNodeDto = RoadmapNode | StudentRoadmapNode;

export type RoadmapDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: DependencyHandle;
  targetHandle: DependencyHandle;
};

export type DependencyHandle = 'top' | 'right' | 'bottom' | 'left';

export type RoadmapDependencyRequest = {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceHandle: DependencyHandle;
  readonly targetHandle: DependencyHandle;
};

export type TeacherBlockOperation = 'BLOCK' | 'UNBLOCK' | 'BRANCH_UNLOCK';

export type TeacherBlockUnlockMode = 'BLOCK' | 'UPSTREAM' | 'SINGLE' | 'BRANCH';

export type TeacherBlockImpact = {
  id: string;
  title: string;
  relation?: 'SELECTED_NODE' | 'PREREQUISITE' | 'DEPENDENT';
  nodeType?: { name: string; icon: string; color: string };
};

export type TeacherBlockPreview = {
  mode: TeacherBlockUnlockMode;
  nodes: TeacherBlockImpact[];
  version: string;
};

export type NodeDeletionImpact = {
  node: {
    title: string;
    nodeType: { name: string; icon: string; color: string };
  };
  dependencies: Array<{ id: string; sourceTitle: string; targetTitle: string }>;
  resources: Array<{ id: string; title: string }>;
  version: string;
};

type RoadmapDtoBase<Node extends RoadmapNodeDto> = {
  course: { code: string; name: string; department: string };
  courseOffering: { id: string; year: number; semester: number };
  roadmap: { id: string; closedAt?: Date | string | null };
  nodeTypes: NodeType[];
  nodes: Node[];
  dependencies: RoadmapDependency[];
};

export type RoadmapDto = RoadmapDtoBase<RoadmapNode>;
export type StudentRoadmapDto = RoadmapDtoBase<StudentRoadmapNode>;
export type AnyRoadmapDto = RoadmapDto | StudentRoadmapDto;

/** Whether the post-creation invitation offers to do or to repeat the teaching tutorial. */
export type PostCreationInvitationWording = 'hacer' | 'repetir';

/** The Roadmap tutorial and canvas experience offered on the Practice roadmap. */
export type PracticeExperience = 'student' | 'teaching';

/** A tutorial invitation shown once per User. */
export type TutorialInvitation = 'first-visit' | 'post-creation';

export function isTutorialInvitation(value: unknown): value is TutorialInvitation {
  return value === 'first-visit' || value === 'post-creation';
}

export function isPracticeExperience(value: unknown): value is PracticeExperience {
  return value === 'student' || value === 'teaching';
}
