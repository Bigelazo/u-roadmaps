import type { ChangeImpactOf as PlannedChangeImpactOf } from '@/features/roadmap/domain/change-impact';
import {
  fileReplacementError,
  linkResourceOnlyError,
  resourceEditError,
  uploadedContentType,
} from '@/features/roadmap/domain/resource';
import {
  blockedPrerequisiteNodeIds,
  chileWallClock,
  decideScheduledUnlock,
} from '@/features/roadmap/domain/scheduled-unlock';
import type {
  NodeEditorGuardReason,
  NodeUpdate,
  ResourceInput,
} from '@/features/roadmap/editor/types';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import { nodesDisplacedByNewNode } from '@/features/roadmap/graph/node-collisions';
import type { PracticeRoadmap } from '@/features/roadmap/session/in-memory-persistence';
import type {
  ExecutionResult,
  NewRoadmapNode,
  PracticeCanvasAction,
  RoadmapNodeTypeInput,
} from '@/features/roadmap/session/types';
import {
  affectedNodes,
  canvasConfirmationChoices,
  canvasPreviewResetConfirmation,
  nodeDeletionConfirmation,
  nodeTypeDeletionConfirmation,
  roadmapAutoLayoutConfirmation,
  roadmapDependencyConfirmation,
  roadmapDependencyDeletionConfirmation,
  roadmapNodeVisibilityConfirmation,
  roadmapTeacherBlockConfirmation,
  type CanvasConfirmationChoice,
  type RoadmapConfirmationRoadmap,
  type UnlockScheduleDraft,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { formatCalendarDay } from '@/shared/calendar-day-format';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';
import type {
  AnyRoadmapDto,
  RoadmapDependency,
  RoadmapDependencyRequest,
  RoadmapNode,
  TeacherBlockOperation,
  TeacherBlockOperationImpact,
} from '@/features/roadmap/types';

export type RoadmapNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type RoadmapNodePlacement = {
  readonly nodeId: string;
  readonly position: RoadmapNodePosition;
};

export type NewNodePlacement = {
  readonly position: RoadmapNodePosition;
  readonly displaced: readonly RoadmapNodePlacement[];
};

type TeacherBlockChangeImpact = {
  readonly [Operation in TeacherBlockOperation]?: TeacherBlockOperationImpact;
};

export type ReadChangeImpactOf<Kind extends keyof PlannedChangeImpactOf> =
  PlannedChangeImpactOf[Kind];

type ImpactRead<Kind> = Kind extends keyof PlannedChangeImpactOf
  ? PlannedChangeImpactOf[Kind]
  : never;

export type RouteRequest = {
  readonly method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: object;
};

type CommandSession<Command extends { kind: string }> = {
  readChangeImpact(command: Command): Promise<ImpactRead<Command['kind']> | null>;
  execute(
    command: Command,
    previewVersion?: string,
  ): Promise<{ readonly applied: boolean } & ExecutionResult>;
};

export type ConfirmationInput = {
  readonly unlockAt?: string;
};

export type ConfirmationContext = {
  readonly schedule?: UnlockScheduleDraft;
  readonly isPending?: boolean;
};

export type CommandOutcome = ExecutionResult & {
  readonly choice?: CanvasConfirmationChoice;
  readonly input?: ConfirmationInput;
};

type ConfirmedAction<Command extends { kind: string }, Impact> = {
  draftGuard?(command: Command): NodeEditorGuardReason;
  impact?(session: CommandSession<Command>, command: Command): Promise<Impact | null>;
  needsConfirmation?(impact: Impact): boolean;
  apply(
    session: CommandSession<Command>,
    command: Command,
    impact: Impact,
    choice: CanvasConfirmationChoice | undefined,
    input?: ConfirmationInput,
  ): Promise<boolean>;
  confirmation(
    command: Command,
    impact: Impact | null,
    roadmap: RoadmapConfirmationRoadmap,
    context: ConfirmationContext,
  ): ConfirmationPresentation | null;
};

export type CommandEntry<Command extends { kind: string }, Impact> = {
  requests(command: Command): RouteRequest | readonly RouteRequest[];
  readonly previewHeader?: string;
  readonly failure: string;
  result?(responses: readonly Response[]): Promise<ExecutionResult>;
  practice(
    roadmap: PracticeRoadmap,
    command: Command,
    previewVersion?: string,
  ): ExecutionResult | void;
  readonly changesCanvasPreview?: true;
  shownBeforeRefresh?(command: Command, result: ExecutionResult): RoadmapUpdate | null;
  success?(command: Command, outcome: CommandOutcome, impact?: Impact | null): string;
  report?(command: Command, outcome: CommandOutcome): PracticeCanvasAction | null;
  readonly confirmedAction?: ConfirmedAction<Command, Impact>;
} & (Command['kind'] extends keyof PlannedChangeImpactOf
  ? { readonly changeImpact: { path(command: Command): string; readonly failure: string } }
  : unknown);

export type RoadmapUpdate = <Roadmap extends AnyRoadmapDto>(roadmap: Roadmap) => Roadmap;

const command = <Command extends { kind: string }, Impact = ImpactRead<Command['kind']>>(
  entry: CommandEntry<Command, Impact>,
) => entry;

const readChangeImpact = <Command extends { kind: string }>(
  session: CommandSession<Command>,
  command: Command,
) => session.readChangeImpact(command);

const executeAsRequested = async <Command extends { kind: string }>(
  session: CommandSession<Command>,
  command: Command,
  impact: { readonly version: string } | null,
) => (await session.execute(command, impact?.version)).applied;

const teacherBlockImpactOperations = (operation: TeacherBlockOperation) =>
  operation === 'BLOCK' ? (['BLOCK'] as const) : (['UNBLOCK', 'BRANCH_UNLOCK'] as const);

const teacherBlockOperationByChoice: Partial<
  Readonly<Record<CanvasConfirmationChoice, TeacherBlockOperation>>
> = {
  [canvasConfirmationChoices.blockTeacher]: 'BLOCK',
  [canvasConfirmationChoices.unlockNode]: 'UNBLOCK',
  [canvasConfirmationChoices.unlockBranch]: 'BRANCH_UNLOCK',
};

const chosenTeacherBlockOperation = (
  requested: TeacherBlockOperation,
  choice?: CanvasConfirmationChoice,
) => (choice && teacherBlockOperationByChoice[choice]) || requested;

const teacherBlockSuccess: Readonly<Record<TeacherBlockOperation, string>> = {
  BLOCK: 'Nodo bloqueado exitosamente.',
  UNBLOCK: 'Nodo desbloqueado exitosamente.',
  BRANCH_UNLOCK: 'Rama desbloqueada exitosamente.',
};

const completionSuccess = () => 'Nodo completado.';

type ScheduledUnlockRequest = {
  readonly nodeId: string;
  readonly unlockAt: string | null;
  readonly includeDependents?: boolean;
};

const scheduledUnlockRequest = ({
  nodeId,
  unlockAt,
  includeDependents,
}: ScheduledUnlockRequest): RouteRequest => ({
  path: `/nodes/${nodeId}/teacher-block/schedule`,
  ...(unlockAt
    ? {
        method: 'PUT',
        body: includeDependents ? { unlockAt, includeDependents } : { unlockAt },
      }
    : { method: 'DELETE' }),
});

const scheduleUnlockInPractice = (
  practice: PracticeRoadmap,
  { nodeId, unlockAt, includeDependents }: ScheduledUnlockRequest,
): ExecutionResult => {
  const nodes = practice.roadmap.nodes.filter(
    (node): node is RoadmapNode => 'isTeacherBlocked' in node,
  );
  const node = nodes.find(({ id }) => id === nodeId);
  if (!node) return {};
  const decision = decideScheduledUnlock({ node, unlockAt, includeDependents, now: new Date() });
  if (decision.kind === 'REJECTED') throw new Error(decision.message);
  const prerequisiteIds = decision.unlockAt
    ? blockedPrerequisiteNodeIds({ nodes, dependencies: practice.roadmap.dependencies, nodeId })
    : [];
  const schedules = new Map([
    [nodeId, { unlockAt: decision.unlockAt, includesDependents: decision.includesDependents }],
    ...prerequisiteIds.map(
      (id) => [id, { unlockAt: decision.unlockAt, includesDependents: false }] as const,
    ),
  ]);
  practice.updateNodes((current) =>
    current.map((candidate) => {
      const schedule = schedules.get(candidate.id);
      return schedule && 'isTeacherBlocked' in candidate
        ? {
            ...candidate,
            teacherUnlockAt: schedule.unlockAt ?? undefined,
            teacherUnlockIncludesDependents: schedule.includesDependents || undefined,
          }
        : candidate;
    }),
  );
  return { scheduledUnlock: { title: node.title, prerequisites: prerequisiteIds.length } };
};

type TeacherBlockSchedule = {
  readonly unlockAt: string;
};

const scheduledUnlock = (
  nodeId: string,
  operation: TeacherBlockOperation,
  { unlockAt }: TeacherBlockSchedule,
): ScheduledUnlockRequest => ({
  nodeId,
  unlockAt,
  includeDependents: operation === 'BRANCH_UNLOCK',
});

const scheduledMoment = (unlockAt: string) => {
  const { day, time } = chileWallClock(new Date(unlockAt));
  return `el ${formatCalendarDay(day)} a las ${time}`;
};

function scheduledUnlockSuccess({
  title,
  unlockAt,
  companions = 0,
  companion = 'dependiente',
}: {
  title: string;
  unlockAt: string;
  companions?: number;
  companion?: 'dependiente' | 'prerrequisito';
}) {
  const moment = scheduledMoment(unlockAt);
  if (companions === 0) return `${title} se desbloqueará ${moment}.`;
  const along = companions === 1 ? `su ${companion}` : `sus ${companions} ${companion}s`;
  return `Se desbloquearán ${title} y ${along} ${moment}.`;
}

const teacherBlockScheduleSuccess = (
  { nodeId, operation }: { nodeId: string; operation: TeacherBlockOperation },
  choice: CanvasConfirmationChoice | undefined,
  unlockAt: string,
  impact: TeacherBlockChangeImpact | null | undefined,
) => {
  const chosen = chosenTeacherBlockOperation(operation, choice);
  const preview = impact?.[chosen];
  const title = preview?.nodes.find(({ id }) => id === nodeId)?.title ?? 'El nodo';
  if (!preview) return scheduledUnlockSuccess({ title, unlockAt });
  if (choice === canvasConfirmationChoices.unlockPrerequisites)
    return scheduledUnlockSuccess({
      title,
      unlockAt,
      companions: affectedNodes(preview, nodeId).length,
      companion: 'prerrequisito',
    });
  return scheduledUnlockSuccess({
    title,
    unlockAt,
    companions: chosen === 'BRANCH_UNLOCK' ? affectedNodes(preview, nodeId).length : 0,
  });
};

const nodeMoves = {
  requests: ({ positions }: { positions: readonly RoadmapNodePlacement[] }): RouteRequest[] =>
    positions.map(({ nodeId, position }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { positionX: position.x, positionY: position.y },
    })),
  failure: 'No se pudo guardar la posición.',
  practice: (
    practice: PracticeRoadmap,
    { positions }: { positions: readonly RoadmapNodePlacement[] },
  ) =>
    practice.settleEach(positions, ({ nodeId, position }) =>
      practice.mutateNode(nodeId, (node) => ({
        ...node,
        positionX: position.x,
        positionY: position.y,
      })),
    ),
};

type AutomaticLayouts = Readonly<Record<RoadmapLayoutDirection, readonly RoadmapNodePlacement[]>>;

const chosenLayout = ({
  layouts,
  direction = 'TB',
}: {
  layouts: AutomaticLayouts;
  direction?: RoadmapLayoutDirection;
}) => layouts[direction];

const layoutDirectionByChoice: Partial<
  Readonly<Record<CanvasConfirmationChoice, RoadmapLayoutDirection>>
> = {
  [canvasConfirmationChoices.autoLayoutVertical]: 'TB',
  [canvasConfirmationChoices.autoLayoutHorizontal]: 'LR',
};

const visibility = (isVisible: boolean) => ({
  requests: ({ nodeId }: { nodeId: string }): RouteRequest => ({
    method: 'PATCH',
    path: `/nodes/${nodeId}`,
    body: { isVisible },
  }),
  previewHeader: 'x-node-visibility-preview',
  failure: 'No se pudo cambiar la visibilidad.',
  report: ({ nodeId }: { nodeId: string }): PracticeCanvasAction => ({
    type: 'changeVisibility',
    nodeId,
    isVisible,
  }),
});

const visibilityConfirmation = (
  roadmap: RoadmapConfirmationRoadmap,
  nodeId: string,
  isHiding: boolean,
  dependencies: readonly { id: string; sourceNodeId: string; targetNodeId: string }[] = [],
) => {
  const node = roadmap.nodes.find(({ id }) => id === nodeId);
  return node ? roadmapNodeVisibilityConfirmation(roadmap, node, isHiding, dependencies) : null;
};

const setVisibility = (practice: PracticeRoadmap, nodeId: string, isVisible: boolean) =>
  practice.mutateNode(nodeId, (node) => ('isVisible' in node ? { ...node, isVisible } : node));

export const canvasCommandCatalog = {
  'hide-node': command<{ kind: 'hide-node'; nodeId: string }>({
    ...visibility(false),
    changeImpact: {
      path: ({ nodeId }) => `/nodes/${nodeId}?operation=HIDE`,
      failure: 'No se pudo calcular el impacto de ocultar el nodo.',
    },
    practice: (practice, command, previewVersion) => {
      practice.confirm(command, previewVersion);
      setVisibility(practice, command.nodeId, false);
    },
    confirmedAction: {
      impact: readChangeImpact,
      apply: executeAsRequested,
      confirmation: ({ nodeId }, impact, roadmap) =>
        visibilityConfirmation(roadmap, nodeId, true, impact?.dependencies),
    },
    success: () => 'Nodo ocultado exitosamente.',
  }),
  'show-node': command<{ kind: 'show-node'; nodeId: string }>({
    ...visibility(true),
    practice: (practice, { nodeId }) => setVisibility(practice, nodeId, true),
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: ({ nodeId }, _, roadmap) => visibilityConfirmation(roadmap, nodeId, false),
    },
    success: () => 'Nodo visible para estudiantes.',
  }),
  'delete-node': command<{ kind: 'delete-node'; nodeId: string }>({
    requests: ({ nodeId }) => ({ method: 'DELETE', path: `/nodes/${nodeId}` }),
    previewHeader: 'x-node-delete-preview',
    failure: 'No se pudo eliminar el nodo.',
    changeImpact: {
      path: ({ nodeId }) => `/nodes/${nodeId}?operation=DELETE`,
      failure: 'No se pudo calcular el impacto de eliminar el nodo.',
    },
    practice: (practice, command, previewVersion) => {
      practice.confirm(command, previewVersion);
      practice.updateNodes((nodes) => nodes.filter(({ id }) => id !== command.nodeId));
    },
    confirmedAction: {
      draftGuard: ({ nodeId }) => ({ kind: 'delete-node', nodeId }),
      impact: readChangeImpact,
      apply: executeAsRequested,
      confirmation: (_, impact) => (impact ? nodeDeletionConfirmation(impact) : null),
    },
    success: () => 'Nodo eliminado exitosamente.',
    report: ({ nodeId }) => ({ type: 'deleteNode', nodeId }),
  }),
  'change-teacher-block': command<
    {
      kind: 'change-teacher-block';
      nodeId: string;
      operation: TeacherBlockOperation;
      schedule?: TeacherBlockSchedule;
    },
    TeacherBlockChangeImpact
  >({
    requests: ({ nodeId, operation, schedule }) =>
      schedule
        ? scheduledUnlockRequest(scheduledUnlock(nodeId, operation, schedule))
        : {
            method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
            path: `/nodes/${nodeId}/teacher-block`,
          },
    previewHeader: 'x-teacher-block-preview',
    failure: 'No se pudo cambiar el bloqueo docente.',
    changeImpact: {
      path: ({ nodeId, operation }) => `/nodes/${nodeId}/teacher-block?operation=${operation}`,
      failure: 'No se pudo calcular el impacto del bloqueo docente.',
    },
    practice: (practice, command, previewVersion) =>
      command.schedule
        ? void scheduleUnlockInPractice(
            practice,
            scheduledUnlock(command.nodeId, command.operation, command.schedule),
          )
        : void practice.confirm(command, previewVersion),
    confirmedAction: {
      impact: async (session, command) => {
        const operations = teacherBlockImpactOperations(command.operation);
        const impacts = await Promise.all(
          operations.map((operation) => session.readChangeImpact({ ...command, operation })),
        );
        const impact: TeacherBlockChangeImpact = Object.fromEntries(
          operations.flatMap((operation, index) =>
            impacts[index] ? [[operation, impacts[index]]] : [],
          ),
        );
        return impact[command.operation] ? impact : null;
      },
      apply: async (session, command, impact, choice, input) => {
        const operation = chosenTeacherBlockOperation(command.operation, choice);
        const preview = impact[operation];
        const schedule =
          operation !== 'BLOCK' && input?.unlockAt ? { unlockAt: input.unlockAt } : undefined;
        return (
          await session.execute(
            { ...command, operation, ...(schedule ? { schedule } : {}) },
            preview?.version,
          )
        ).applied;
      },
      confirmation: ({ nodeId, operation }, impact, roadmap, { schedule, isPending }) => {
        const preview = impact?.[operation];
        return preview
          ? roadmapTeacherBlockConfirmation({
              roadmap,
              nodeId,
              preview,
              individualPreview: impact?.UNBLOCK,
              branchPreview: impact?.BRANCH_UNLOCK,
              schedule: operation === 'BLOCK' ? undefined : schedule,
              isPending,
            })
          : null;
      },
    },
    success: (command, { choice, input }, impact) =>
      input?.unlockAt && command.operation !== 'BLOCK'
        ? teacherBlockScheduleSuccess(command, choice, input.unlockAt, impact)
        : choice === canvasConfirmationChoices.unlockPrerequisites
          ? 'Nodos desbloqueados exitosamente.'
          : teacherBlockSuccess[chosenTeacherBlockOperation(command.operation, choice)],
    report: ({ nodeId, operation }, { choice, input }) =>
      input?.unlockAt
        ? null
        : {
            type: 'changeTeacherBlock',
            nodeId,
            operation: chosenTeacherBlockOperation(operation, choice),
          },
  }),
  'schedule-teacher-unlock': command<{
    kind: 'schedule-teacher-unlock';
    nodeId: string;
    unlockAt: string | null;
    includeDependents?: boolean;
  }>({
    requests: scheduledUnlockRequest,
    failure: 'No se pudo programar el desbloqueo.',
    result: async ([response]) => {
      const { title, scheduledPrerequisiteIds } = await response.json();
      return { scheduledUnlock: { title, prerequisites: scheduledPrerequisiteIds.length } };
    },
    practice: scheduleUnlockInPractice,
    success: ({ unlockAt }, { scheduledUnlock }) =>
      !unlockAt
        ? 'Desbloqueo programado cancelado.'
        : scheduledUnlockSuccess({
            title: scheduledUnlock?.title ?? 'El nodo',
            unlockAt,
            companions: scheduledUnlock?.prerequisites,
            companion: 'prerrequisito',
          }),
  }),
  'create-dependency': command<{ kind: 'create-dependency' } & RoadmapDependencyRequest>({
    requests: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) => ({
      method: 'POST',
      path: '/dependencies',
      body: { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
    }),
    previewHeader: 'x-dependency-preview',
    failure: 'No se pudo crear la dependencia.',
    changeImpact: {
      path: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) =>
        `/dependencies?${new URLSearchParams({ sourceNodeId, targetNodeId, sourceHandle, targetHandle })}`,
      failure: 'No se pudo calcular el impacto de la dependencia.',
    },
    result: async ([response]) => {
      const { dependency, nodes }: { dependency: RoadmapDependency; nodes: { id: string }[] } =
        await response.json();
      return { dependency, teacherBlockedNodeIds: nodes.map(({ id }) => id) };
    },
    practice: (practice, command, previewVersion) => {
      const { blockedNodeIds } = practice.confirm(command, previewVersion);
      const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = command;
      const dependency = {
        id: crypto.randomUUID(),
        sourceNodeId,
        targetNodeId,
        sourceHandle,
        targetHandle,
      };
      practice.roadmap = {
        ...practice.roadmap,
        dependencies: [...practice.roadmap.dependencies, dependency],
      };
      return { dependency, teacherBlockedNodeIds: blockedNodeIds };
    },
    shownBeforeRefresh: (_, { dependency, teacherBlockedNodeIds = [] }) => {
      if (!dependency) return null;
      const blocked = new Set(teacherBlockedNodeIds);
      return (roadmap) => ({
        ...roadmap,
        nodes: roadmap.nodes.map((node) =>
          'isTeacherBlocked' in node && blocked.has(node.id)
            ? { ...node, isTeacherBlocked: true }
            : node,
        ),
        dependencies: [...roadmap.dependencies, dependency],
      });
    },
    confirmedAction: {
      impact: readChangeImpact,
      needsConfirmation: (impact) => impact.nodes.length > 0,
      apply: executeAsRequested,
      confirmation: ({ sourceNodeId, targetNodeId }, impact, roadmap) =>
        impact?.nodes.length
          ? roadmapDependencyConfirmation({
              roadmap,
              sourceNodeId,
              targetNodeId,
              nodes: impact.nodes,
            })
          : null,
    },
    success: () => 'Dependencia creada exitosamente.',
    report: ({ sourceNodeId, targetNodeId }) => ({
      type: 'connectNodes',
      sourceNodeId,
      targetNodeId,
    }),
  }),
  'delete-dependencies': command<{
    kind: 'delete-dependencies';
    dependencyIds: readonly string[];
  }>({
    requests: ({ dependencyIds }) => ({
      method: 'DELETE',
      path: '/dependencies',
      body: { dependencyIds },
    }),
    failure: 'No se pudo eliminar la dependencia.',
    practice: (practice, { dependencyIds }) => {
      const removed = new Set(dependencyIds);
      practice.roadmap = {
        ...practice.roadmap,
        dependencies: practice.roadmap.dependencies.filter(({ id }) => !removed.has(id)),
      };
    },
    shownBeforeRefresh: ({ dependencyIds }) => {
      const removed = new Set(dependencyIds);
      return (roadmap) => ({
        ...roadmap,
        dependencies: roadmap.dependencies.filter(({ id }) => !removed.has(id)),
      });
    },
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: ({ dependencyIds }) => roadmapDependencyDeletionConfirmation(dependencyIds),
    },
    success: ({ dependencyIds }) =>
      dependencyIds.length === 1
        ? 'Dependencia eliminada exitosamente.'
        : 'Dependencias eliminadas exitosamente.',
  }),
  'move-nodes': command<{ kind: 'move-nodes'; positions: readonly RoadmapNodePlacement[] }>(
    nodeMoves,
  ),
  'apply-automatic-layout': command<{
    kind: 'apply-automatic-layout';
    layouts: AutomaticLayouts;
    direction?: RoadmapLayoutDirection;
  }>({
    requests: (layout) => nodeMoves.requests({ positions: chosenLayout(layout) }),
    failure: nodeMoves.failure,
    practice: (practice, layout) =>
      nodeMoves.practice(practice, { positions: chosenLayout(layout) }),
    confirmedAction: {
      apply: async (session, command, _, choice) =>
        (
          await session.execute({
            ...command,
            direction: choice ? layoutDirectionByChoice[choice] : command.direction,
          })
        ).applied,
      confirmation: () => roadmapAutoLayoutConfirmation,
    },
    success: () => 'Nodos ordenados exitosamente.',
  }),
  'add-node': command<{ kind: 'add-node'; node: NewRoadmapNode } & NewNodePlacement>({
    requests: ({ node, position, displaced }) => [
      {
        method: 'POST',
        path: '/nodes',
        body: {
          ...node,
          description: node.description || null,
          positionX: position.x,
          positionY: position.y,
        },
      },
      ...nodeMoves.requests({ positions: displaced }),
    ],
    failure: 'No se pudo crear el nodo.',
    result: async ([response]) => ({ createdNodeId: (await response.json()).node.id }),
    practice: (practice, { node, position: requested }) => {
      practice.requireAvailableNodeType(node.nodeTypeId);
      const id = crypto.randomUUID();
      const position = practice.createdNodePosition ?? requested;
      nodeMoves.practice(practice, {
        positions: nodesDisplacedByNewNode(
          practice.roadmap.nodes.map(({ id, title, positionX, positionY }) => ({
            id,
            title,
            position: { x: positionX, y: positionY },
          })),
          { id, title: node.title, position },
        ),
      });
      practice.updateNodes((nodes) => [
        ...nodes,
        {
          id,
          title: node.title,
          description: node.description || null,
          nodeTypeId: node.nodeTypeId,
          positionX: position.x,
          positionY: position.y,
          isVisible: node.isVisible,
          isTeacherBlocked: false,
          resources: [],
        },
      ]);
      return { createdNodeId: id };
    },
    success: () => 'Nodo creado exitosamente.',
    report: (_, { createdNodeId }) =>
      createdNodeId ? { type: 'addNode', nodeId: createdNodeId } : null,
  }),
  'update-node': command<{ kind: 'update-node'; nodeId: string; value: NodeUpdate }>({
    requests: ({ nodeId, value }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { ...value, description: value.description || null },
    }),
    failure: 'No se pudo guardar el nodo.',
    practice: (practice, { nodeId, value }) => {
      practice.requireAvailableNodeType(value.nodeTypeId);
      practice.mutateNode(nodeId, (node) => ({
        ...node,
        title: value.title,
        description: value.description || null,
        nodeTypeId: value.nodeTypeId,
      }));
    },
    success: () => 'Cambios guardados exitosamente.',
  }),
  'add-resource': command<{ kind: 'add-resource'; nodeId: string; resource: ResourceInput }>({
    requests: ({ nodeId, resource }) => ({
      method: 'POST',
      path: `/nodes/${nodeId}/resources`,
      body: resource,
    }),
    failure: 'No se pudo agregar el recurso.',
    practice: (practice, { nodeId, resource }) => {
      const error = linkResourceOnlyError(resource.type);
      if (error) throw new Error(error);
      practice.appendResource(nodeId, {
        ...resource,
        id: crypto.randomUUID(),
        fileContentType: null,
        fileSize: null,
        accessCount: 0,
      });
    },
    success: () => 'Enlace guardado exitosamente.',
    report: ({ nodeId }) => ({ type: 'addResource', nodeId }),
  }),
  'upload-resource': command<{ kind: 'upload-resource'; nodeId: string; file: File }>({
    requests: ({ nodeId, file }) => {
      const body = new FormData();
      body.append('file', file);
      return { method: 'POST', path: `/nodes/${nodeId}/resources`, body };
    },
    failure: 'No se pudo subir el archivo.',
    practice: (practice, { nodeId, file }) =>
      practice.appendResource(nodeId, {
        id: crypto.randomUUID(),
        title: file.name,
        url: file.name,
        type: 'FILE',
        fileContentType: uploadedContentType(file),
        fileSize: file.size,
        accessCount: 0,
      }),
    success: () => 'Recurso guardado exitosamente.',
  }),
  'update-resource': command<{
    kind: 'update-resource';
    resourceId: string;
    resource: ResourceInput;
    file?: File;
  }>({
    requests: ({ resourceId, resource, file }) => {
      const path = `/resources/${resourceId}`;
      if (!file)
        return {
          method: 'PATCH',
          path,
          body: resource.type === 'FILE' ? { title: resource.title } : resource,
        };
      const body = new FormData();
      body.append('title', resource.title);
      body.append('file', file);
      return { method: 'PATCH', path, body };
    },
    failure: 'No se pudo guardar el recurso.',
    practice: (practice, { resourceId, resource, file }) =>
      practice.mutateResource(resourceId, (current) => {
        if (file) {
          const error = fileReplacementError(current.type);
          if (error) throw new Error(error);
          practice.canvasPreviewProgress.reviewedResourceIds.delete(resourceId);
          return {
            ...current,
            title: resource.title,
            url: file.name,
            fileContentType: uploadedContentType(file),
            fileSize: file.size,
          };
        }
        const changes =
          current.type === 'FILE' && resource.type === 'FILE' && resource.url === current.url
            ? { title: resource.title }
            : resource;
        const error = resourceEditError(current.type, changes);
        if (error) throw new Error(error);
        return { ...current, ...changes };
      }),
    success: ({ resource }) =>
      resource.type === 'LINK' ? 'Enlace guardado exitosamente.' : 'Recurso guardado exitosamente.',
  }),
  'delete-resource': command<{ kind: 'delete-resource'; resourceId: string }>({
    requests: ({ resourceId }) => ({ method: 'DELETE', path: `/resources/${resourceId}` }),
    failure: 'No se pudo eliminar el recurso.',
    practice: (practice, { resourceId }) => practice.mutateResource(resourceId, () => null),
    success: () => 'Recurso eliminado exitosamente.',
  }),
  'add-node-type': command<{ kind: 'add-node-type'; nodeType: RoadmapNodeTypeInput }>({
    requests: ({ nodeType }) => ({ method: 'POST', path: '/node-types', body: nodeType }),
    failure: 'No se pudo crear el tipo de nodo.',
    practice: (practice, { nodeType }) => {
      practice.decideNodeType({ kind: 'create', name: nodeType.name });
      practice.roadmap = {
        ...practice.roadmap,
        nodeTypes: [
          ...practice.roadmap.nodeTypes,
          { ...nodeType, id: crypto.randomUUID(), isPredefined: false },
        ],
      };
    },
    success: () => 'Tipo de nodo creado exitosamente.',
  }),
  'update-node-type': command<{
    kind: 'update-node-type';
    nodeTypeId: string;
    nodeType: RoadmapNodeTypeInput;
  }>({
    requests: ({ nodeTypeId, nodeType }) => ({
      method: 'PATCH',
      path: `/node-types/${nodeTypeId}`,
      body: nodeType,
    }),
    failure: 'No se pudo guardar el tipo de nodo.',
    practice: (practice, { nodeTypeId, nodeType }) => {
      practice.decideNodeType({ kind: 'update', nodeTypeId, name: nodeType.name });
      practice.roadmap = {
        ...practice.roadmap,
        nodeTypes: practice.roadmap.nodeTypes.map((current) =>
          current.id === nodeTypeId ? { ...current, ...nodeType } : current,
        ),
      };
    },
    success: () => 'Tipo de nodo guardado exitosamente.',
  }),
  'delete-node-type': command<{ kind: 'delete-node-type'; nodeTypeId: string }>({
    requests: ({ nodeTypeId }) => ({ method: 'DELETE', path: `/node-types/${nodeTypeId}` }),
    failure: 'No se pudo eliminar el tipo de nodo.',
    practice: (practice, { nodeTypeId }) => {
      practice.decideNodeType({ kind: 'delete', nodeTypeId });
      practice.roadmap = {
        ...practice.roadmap,
        nodeTypes: practice.roadmap.nodeTypes.filter(({ id }) => id !== nodeTypeId),
      };
    },
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: ({ nodeTypeId }, _, roadmap) => {
        const nodeType = roadmap.nodeTypes.find(({ id }) => id === nodeTypeId);
        return nodeType ? nodeTypeDeletionConfirmation(nodeType) : null;
      },
    },
    success: () => 'Tipo de nodo eliminado exitosamente.',
  }),
  'complete-node': command<{ kind: 'complete-node'; nodeId: string }>({
    requests: ({ nodeId }) => ({ method: 'POST', path: `/nodes/${nodeId}/completion` }),
    failure: 'No se pudo completar el nodo.',
    practice: (practice, { nodeId }) => practice.complete(nodeId),
    success: completionSuccess,
  }),
  'complete-canvas-preview-node': command<{
    kind: 'complete-canvas-preview-node';
    nodeId: string;
  }>({
    requests: ({ nodeId }) => ({ method: 'POST', path: `/simulation/nodes/${nodeId}/completion` }),
    failure: 'No se pudo completar el nodo en la previsualización.',
    practice: (practice, { nodeId }) => practice.completeCanvasPreview(nodeId),
    changesCanvasPreview: true,
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeCanvasPreviewNode', nodeId }),
  }),
  'reset-canvas-preview': command<{ kind: 'reset-canvas-preview' }>({
    requests: () => ({ method: 'DELETE', path: '/simulation' }),
    failure: 'No se pudo reiniciar el progreso de previsualización.',
    practice: (practice) => practice.resetCanvasPreview(),
    changesCanvasPreview: true,
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: () => canvasPreviewResetConfirmation,
    },
    success: () => 'Progreso de previsualización reiniciado.',
  }),
};

type CanvasCommandKind = keyof typeof canvasCommandCatalog;

type EntryTypes = {
  [Kind in CanvasCommandKind]: (typeof canvasCommandCatalog)[Kind] extends CommandEntry<
    infer Command,
    infer Impact
  >
    ? { command: Readonly<Command>; impact: Impact }
    : never;
};

export type CanvasCommandOf<Kind extends CanvasCommandKind> = EntryTypes[Kind]['command'];

export type CanvasCommand = CanvasCommandOf<CanvasCommandKind>;

export type ChangeImpactCommand = CanvasCommandOf<keyof PlannedChangeImpactOf>;

type ChangeImpactOf<Kind extends CanvasCommandKind> = EntryTypes[Kind]['impact'];

export type AnyCommandEntry = CommandEntry<CanvasCommand, ChangeImpactOf<CanvasCommandKind> | null>;

export type PendingConfirmation = {
  [Kind in CanvasCommandKind]: {
    readonly kind: Kind;
    readonly request: CanvasCommandOf<Kind>;
    readonly impact: ChangeImpactOf<Kind> | null;
    readonly phase: 'reading-impact' | 'awaiting' | 'confirming';
    readonly choice?: CanvasConfirmationChoice;
  };
}[CanvasCommandKind];
