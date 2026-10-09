import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import type { NoticeClass } from '../notice-effect';

/**
 * A Notice target, the descriptor kind that owns it (`noticeTarget`), and its place in the
 * hierarchy Roadmap ⊃ Node ⊃ aspect/Resource.
 */
export type NoticeTargetRef = Readonly<{
  noticeTarget: string;
  targetKey: string;
  nodeId: string | null;
}>;

export type RoadmapViewNode = Readonly<{
  id: string;
  title: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  nodeTypeId: string;
  nodeTypeName: string;
  description: string | null;
}>;

/** A Resource's pedagogical label and opaque content revision (never its URL or file). */
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

/** What a descriptor may read about one Roadmap; the module implements it over a transaction. */
export interface RoadmapView {
  readonly roadmapId: string;
  /** Active Participations, including the actor of the change. */
  participants(): Promise<readonly { userId: string; role: 'STUDENT' | 'TEACHER' }[]>;
  node(nodeId: string): Promise<RoadmapViewNode | null>;
  /** Every Node of the Roadmap; once loaded, `node` answers from it. */
  nodes(): Promise<readonly RoadmapViewNode[]>;
  /** Every Resource of the Roadmap, oldest first; once loaded, Resource lookups answer from it. */
  resources(): Promise<readonly RoadmapViewResource[]>;
  /** Every Dependency of the Roadmap; once loaded, `dependency` answers from it. */
  dependencies(): Promise<readonly RoadmapViewDependency[]>;
  /** Every Node type of the Roadmap; once loaded, `nodeType` answers from it. */
  nodeTypes(): Promise<readonly RoadmapViewNodeType[]>;
  /** Load the whole Roadmap at once, so later lookups need no further query. */
  preload(): Promise<void>;
  resource(resourceId: string): Promise<RoadmapViewResource | null>;
  /** The Node's current Resources, oldest first. */
  nodeResources(nodeId: string): Promise<readonly RoadmapViewResource[]>;
  /** Nodes accessible to the participant (ADR-0014 decision 10 "accessible"). */
  accessibleNodeIds(userId: string): Promise<ReadonlySet<string>>;
  /** The Dependency between an ordered pair of this Roadmap's Nodes, if any. */
  dependency(sourceNodeId: string, targetNodeId: string): Promise<{ id: string } | null>;
  nodeType(nodeTypeId: string): Promise<RoadmapViewNodeType | null>;
  /** The Course the Roadmap belongs to. */
  course(): Promise<{ courseCode: string } | null>;
}

export type TargetContext = Readonly<Record<string, unknown>>;

/**
 * The live value of a target; `visible` is its visibility gate for creating or updating
 * notices. `context` is the live presentation context (e.g. Node titles, a type name),
 * stored with the notice and, once recognized, with the Known value.
 */
export type TargetCurrent = Readonly<{ value: string; visible: boolean; context?: TargetContext }>;

/** What a stored notice keeps: the target's Known value, current value and their context. */
export type TargetValues = Readonly<{
  knownValue: string;
  currentValue: string;
  /** Presentation context of the current value, as it was when the notice was written. */
  context: TargetContext;
  /** Presentation context of the Known value, from the Known value store. */
  knownContext?: TargetContext;
}>;

/** A recipient's Known value of a target, as entry reads it. */
export type KnownTarget = NoticeTargetRef & Readonly<{ knownValue: string }>;

/** A target as entering the Roadmap shows it to the recipient. */
export type EntryValue = Readonly<{
  target: NoticeTargetRef;
  currentValue: string;
  /** Presentation context of the shown value, recognized with it. */
  context?: TargetContext;
}>;

/** Read-time text, shared by the Inbox and the Change summary. */
export type TargetWording = Readonly<{
  subject: string;
  body: string;
  /** `node` items are grouped under their Node; `general` items under «Ruta y clasificación». */
  summaryGroup: 'node' | 'general';
  /** Change summary item when it differs from `body` (e.g. a Node group already names the Node). */
  summary?: string;
}>;

/**
 * One Notice target kind, described once (ADR-0024): identity, Known value baseline,
 * audience (ADR-0014 decision 10), visibility gate, equality and wording.
 * Values are encoded strings; equality is exact string equality.
 */
export type NoticeReadSide = Readonly<{
  changeKind: string;
  changedFields: readonly string[];
  targetKind: 'node' | 'roadmap';
}>;

export interface NoticeTargetDescriptor<F extends RoadmapChangeFact = RoadmapChangeFact> {
  /** Stored as `data.noticeTarget`; also selects the descriptor at read time. */
  readonly noticeTarget: string;
  readonly noticeClass: NoticeClass;
  /** Read-side discriminators the Inbox SQL, grouping and counts still use. */
  readonly readSide: NoticeReadSide;
  /** Read-side discriminators that depend on the stored values (stored over `readSide`). */
  valueReadSide?(values: TargetValues): Partial<NoticeReadSide>;
  /**
   * Broad targets only: the part of the hierarchy Roadmap ⊃ Node ⊃ aspect/Resource the
   * target stands for. A recipient who has not recognized it learns later changes inside
   * it through it (see `application/absorption.ts`).
   */
  readonly scope?: 'roadmap' | 'node';
  /** False when the target never changes after its notice (a deleted Node): no Known value is kept. */
  readonly keepsKnownValue?: false;
  matches(fact: RoadmapChangeFact): fact is F;
  target(fact: F, changes: RoadmapChanges): NoticeTargetRef;
  /** The value recipients knew before the change. */
  previousValue(fact: F): string;
  /** Presentation context of the previous value, recorded with the Known value. */
  previousContext?(fact: F): TargetContext;
  /** Recipients whose Known value is recorded as the previous value (first baseline wins). */
  knowers(fact: F, changes: RoadmapChanges, roadmap: RoadmapView): Promise<readonly string[]>;
  /**
   * Recipients told about the change. The module never tells the actor: an actor in the
   * audience gets the actor rule instead (see `own-changes.ts`).
   */
  audience(fact: F, changes: RoadmapChanges, roadmap: RoadmapView): Promise<readonly string[]>;
  /**
   * For per-recipient targets whose live value the module cannot read (Node access):
   * the value at edit time, recorded as the Known value store's current value for these
   * recipients. Reconciliation then compares against it and ignores `current().value`.
   */
  currentAtEdit?(fact: F): Readonly<{ recipientIds: readonly string[]; value: string }>;
  /**
   * The target's live value (as `recipientId` sees it, for targets whose value depends on
   * the recipient), or null when it no longer exists.
   */
  current(
    target: NoticeTargetRef,
    roadmap: RoadmapView,
    recipientId: string,
  ): Promise<TargetCurrent | null>;
  /**
   * (C) The targets of this kind that entering the Roadmap shows `recipientId`, with the
   * values shown, including targets the recipient knew that are now gone (their absent
   * value). `known` are the recipient's Known values of this kind. The descriptor applies
   * its own audience and visibility gates; the module applies the hierarchy (a target
   * inside a hidden, never-recognized Node stays unknown). Omitted when entry shows none.
   */
  entryValues?(
    roadmap: RoadmapView,
    recipientId: string,
    known: readonly KnownTarget[],
  ): Promise<readonly EntryValue[]>;
  /** Presentation context only the change itself knows (e.g. a removed Dependency's id). */
  factContext?(fact: F, changes: RoadmapChanges): Readonly<Record<string, unknown>>;
  /** Target identity the read side (Inbox SQL and TS visibility) reads from stored `data`. */
  storedData?(target: NoticeTargetRef): Readonly<Record<string, unknown>>;
  wording(values: TargetValues): TargetWording;
  /** Fields the notice API exposes in `data` besides the stored values. */
  apiData(values: TargetValues): Readonly<Record<string, unknown>>;
}

/** The Node was visible before this change (a sibling visibility fact overrides the live state). */
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
