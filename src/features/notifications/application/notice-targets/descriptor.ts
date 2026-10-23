import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import type { NoticeClass } from '../notice-effect';

export type NoticeTargetRef = Readonly<{
  noticeTarget: string;
  targetKey: string;
  nodeId: string | null;
}>;

export const SCOPE_DEPTH = { roadmap: 0, node: 1 } as const;

export type BroadScope = keyof typeof SCOPE_DEPTH;

export type RoadmapViewNode = Readonly<{
  id: string;
  title: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  nodeTypeId: string;
  nodeTypeName: string;
  description: string | null;
}>;

export type RoadmapViewResource = Readonly<{
  id: string;
  nodeId: string;
  title: string;
  revision: string;
}>;

export type RoadmapViewDependency = Readonly<{
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}>;

export type RoadmapViewNodeType = Readonly<{ id: string; name: string; hasVisibleNode: boolean }>;

export type ParticipantRole = 'STUDENT' | 'TEACHER';

export type ParticipantAccess = Readonly<{
  userId: string;
  role: ParticipantRole;
  accessibleNodeIds: ReadonlySet<string>;
}>;

export function seesEveryNode(role: ParticipantRole | null) {
  return role === 'TEACHER';
}

export interface RoadmapView {
  readonly roadmapId: string;
  participants(): Promise<readonly { userId: string; role: ParticipantRole }[]>;
  role(userId: string): Promise<ParticipantRole | null>;
  node(nodeId: string): Promise<RoadmapViewNode | null>;
  nodes(): Promise<readonly RoadmapViewNode[]>;
  resources(): Promise<readonly RoadmapViewResource[]>;
  dependencies(): Promise<readonly RoadmapViewDependency[]>;
  nodeTypes(): Promise<readonly RoadmapViewNodeType[]>;
  preload(): Promise<void>;
  resource(resourceId: string): Promise<RoadmapViewResource | null>;
  nodeResources(nodeId: string): Promise<readonly RoadmapViewResource[]>;
  accessibleNodeIds(userId: string): Promise<ReadonlySet<string>>;
  participantAccess(): Promise<readonly ParticipantAccess[]>;
  dependency(sourceNodeId: string, targetNodeId: string): Promise<{ id: string } | null>;
  nodeType(nodeTypeId: string): Promise<RoadmapViewNodeType | null>;
  course(): Promise<{ courseCode: string } | null>;
}

export type TargetContext = Readonly<Record<string, unknown>>;

export type TargetCurrent = Readonly<{ value: string; visible: boolean; context?: TargetContext }>;

export type TargetValues = Readonly<{
  knownValue: string;
  currentValue: string;
  context: TargetContext;
  knownContext?: TargetContext;
}>;

export type KnownTarget = NoticeTargetRef & Readonly<{ knownValue: string }>;

export type EntryValue = Readonly<{
  target: NoticeTargetRef;
  currentValue: string;
  context?: TargetContext;
}>;

export type TargetWording = Readonly<{
  subject: string;
  body: string;
  summaryGroup: 'node' | 'general';
  summary?: string;
}>;

export type ShownTo =
  'everyone' | 'node-viewers' | 'node-openers' | 'dependency-viewers' | 'node-type-viewers';

export interface NoticeTargetDescriptor<F extends RoadmapChangeFact = RoadmapChangeFact> {
  readonly noticeTarget: string;
  readonly noticeClass: NoticeClass;
  readonly shownTo: ShownTo;
  readonly scope?: BroadScope;
  readonly keepsKnownValue?: false;
  matches(fact: RoadmapChangeFact): fact is F;
  target(fact: F, changes: RoadmapChanges): NoticeTargetRef;
  previousValue(fact: F): string;
  previousContext?(fact: F): TargetContext;
  knowers(fact: F, changes: RoadmapChanges, roadmap: RoadmapView): Promise<readonly string[]>;
  audience(fact: F, changes: RoadmapChanges, roadmap: RoadmapView): Promise<readonly string[]>;
  currentAtEdit?(fact: F): Readonly<{ recipientIds: readonly string[]; value: string }>;
  current(
    target: NoticeTargetRef,
    roadmap: RoadmapView,
    recipientId: string,
  ): Promise<TargetCurrent | null>;
  entryValues?(
    roadmap: RoadmapView,
    recipientId: string,
    known: readonly KnownTarget[],
  ): Promise<readonly EntryValue[]>;
  factContext?(fact: F, changes: RoadmapChanges): Readonly<Record<string, unknown>>;
  storedData?(target: NoticeTargetRef): Readonly<Record<string, unknown>>;
  wording(values: TargetValues): TargetWording;
  apiData(values: TargetValues): Readonly<Record<string, unknown>>;
}

export async function nodeVisibleBefore(
  nodeId: string,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  const visibility = changes.facts.find(
    (fact) => fact.kind === 'node-visibility' && fact.nodeId === nodeId,
  );
  if (visibility?.kind === 'node-visibility') return visibility.previous;
  return (await roadmap.node(nodeId))?.isVisible ?? false;
}

export async function nodeVisibleThroughout(
  nodeId: string,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  return (
    (await nodeVisibleBefore(nodeId, changes, roadmap)) &&
    ((await roadmap.node(nodeId))?.isVisible ?? false)
  );
}

export async function nodeViewers(studentsSee: boolean, roadmap: RoadmapView) {
  return (await roadmap.participants())
    .filter(({ role }) => studentsSee || seesEveryNode(role))
    .map(({ userId }) => userId);
}

export async function isNodeViewer(
  studentsSee: boolean,
  recipientId: string,
  roadmap: RoadmapView,
) {
  return studentsSee || seesEveryNode(await roadmap.role(recipientId));
}

export async function nodeOpeners(studentsSee: boolean, nodeId: string, roadmap: RoadmapView) {
  return (await roadmap.participantAccess())
    .filter(
      ({ role, accessibleNodeIds }) =>
        seesEveryNode(role) || (studentsSee && accessibleNodeIds.has(nodeId)),
    )
    .map(({ userId }) => userId);
}

export async function isNodeOpener(nodeId: string, recipientId: string, roadmap: RoadmapView) {
  return (
    seesEveryNode(await roadmap.role(recipientId)) ||
    (await roadmap.accessibleNodeIds(recipientId)).has(nodeId)
  );
}

export async function participantIds(roadmap: RoadmapView) {
  return (await roadmap.participants()).map(({ userId }) => userId);
}
