import type { ChangeImpactOf as PlannedChangeImpactOf } from '@/features/roadmap/domain/change-impact';
import { linkResourceOnlyError, resourceEditError } from '@/features/roadmap/domain/resource';
import {
  chileCalendarDay,
  decideScheduledUnlock,
} from '@/features/roadmap/domain/scheduled-unlock';
import type {
  NodeEditorGuardReason,
  NodeUpdate,
  ResourceInput,
} from '@/features/roadmap/editor/types';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type { PracticeRoadmap } from '@/features/roadmap/session/in-memory-persistence';
import type {
  ExecutionResult,
  NewRoadmapNode,
  PracticeCanvasAction,
  RoadmapNodeTypeInput,
} from '@/features/roadmap/session/types';
import {
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
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';
import type {
  RoadmapDependencyRequest,
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

export type TeacherBlockChangeImpact = {
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

export type CommandOutcome<Command> = ExecutionResult & {
  readonly choice?: CanvasConfirmationChoice;
  readonly remaining?: Command;
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
  ): Promise<boolean | { retry: Command }>;
  confirmation(
    command: Command,
    impact: Impact | null,
    roadmap: RoadmapConfirmationRoadmap,
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
  success?(command: Command, outcome: CommandOutcome<Command>): string;
  report?(command: Command, outcome: CommandOutcome<Command>): PracticeCanvasAction | null;
  readonly confirmedAction?: ConfirmedAction<Command, Impact>;
} & (Command['kind'] extends keyof PlannedChangeImpactOf
  ? { readonly changeImpact: { path(command: Command): string; readonly failure: string } }
  : unknown);

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
    { kind: 'change-teacher-block'; nodeId: string; operation: TeacherBlockOperation },
    TeacherBlockChangeImpact
  >({
    requests: ({ nodeId, operation }) => ({
      method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
      path: `/nodes/${nodeId}/teacher-block`,
    }),
    previewHeader: 'x-teacher-block-preview',
    failure: 'No se pudo cambiar el bloqueo docente.',
    changeImpact: {
      path: ({ nodeId, operation }) => `/nodes/${nodeId}/teacher-block?operation=${operation}`,
      failure: 'No se pudo calcular el impacto del bloqueo docente.',
    },
    practice: (practice, command, previewVersion) => practice.confirm(command, previewVersion),
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
      apply: async (session, command, impact, choice) => {
        const operation = chosenTeacherBlockOperation(command.operation, choice);
        return (await session.execute({ ...command, operation }, impact[operation]?.version))
          .applied;
      },
      confirmation: ({ nodeId, operation }, impact, roadmap) => {
        const preview = impact?.[operation];
        return preview
          ? roadmapTeacherBlockConfirmation({
              roadmap,
              nodeId,
              preview,
              individualPreview: impact?.UNBLOCK,
              branchPreview: impact?.BRANCH_UNLOCK,
            })
          : null;
      },
    },
    success: ({ operation }, { choice }) =>
      choice === canvasConfirmationChoices.unlockPrerequisites
        ? 'Nodos desbloqueados exitosamente.'
        : teacherBlockSuccess[chosenTeacherBlockOperation(operation, choice)],
    report: ({ nodeId, operation }, { choice }) => ({
      type: 'changeTeacherBlock',
      nodeId,
      operation: chosenTeacherBlockOperation(operation, choice),
    }),
  }),
  'schedule-teacher-unlock': command<{
    kind: 'schedule-teacher-unlock';
    nodeId: string;
    unlockOn: string | null;
  }>({
    requests: ({ nodeId, unlockOn }) => ({
      path: `/nodes/${nodeId}/teacher-block/schedule`,
      ...(unlockOn ? { method: 'PUT', body: { unlockOn } } : { method: 'DELETE' }),
    }),
    failure: 'No se pudo programar el desbloqueo.',
    practice: (practice, { nodeId, unlockOn }) =>
      practice.mutateNode(nodeId, (node) => {
        if (!('isTeacherBlocked' in node)) return node;
        const decision = decideScheduledUnlock({ node, unlockOn, today: chileCalendarDay() });
        if (decision.kind === 'REJECTED') throw new Error(decision.message);
        return { ...node, teacherUnlockOn: decision.day ?? undefined };
      }),
    success: ({ unlockOn }) =>
      unlockOn ? 'Desbloqueo programado.' : 'Desbloqueo programado cancelado.',
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
    practice: (practice, command, previewVersion) => {
      practice.confirm(command, previewVersion);
      const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = command;
      practice.roadmap = {
        ...practice.roadmap,
        dependencies: [
          ...practice.roadmap.dependencies,
          { id: crypto.randomUUID(), sourceNodeId, targetNodeId, sourceHandle, targetHandle },
        ],
      };
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
    requests: ({ dependencyIds }) =>
      dependencyIds.map((dependencyId) => ({
        method: 'DELETE',
        path: `/dependencies/${dependencyId}`,
      })),
    failure: 'No se pudo eliminar la dependencia.',
    practice: (practice, { dependencyIds }) =>
      practice.settleEach(dependencyIds, (dependencyId) => {
        if (!practice.roadmap.dependencies.some(({ id }) => id === dependencyId))
          throw new Error('La dependencia no existe en este roadmap.');
        practice.roadmap = {
          ...practice.roadmap,
          dependencies: practice.roadmap.dependencies.filter(({ id }) => id !== dependencyId),
        };
      }),
    confirmedAction: {
      apply: async (session, command) => {
        const deleted = await Promise.all(
          command.dependencyIds.map(
            async (dependencyId) =>
              (await session.execute({ ...command, dependencyIds: [dependencyId] })).applied,
          ),
        );
        const failed = command.dependencyIds.filter((_, index) => !deleted[index]);
        if (failed.length === 0) return true;
        if (failed.length === command.dependencyIds.length) return false;
        return { retry: { ...command, dependencyIds: failed } };
      },
      confirmation: ({ dependencyIds }) => roadmapDependencyDeletionConfirmation(dependencyIds),
    },
    success: ({ dependencyIds }, { remaining }) =>
      dependencyIds.length - (remaining?.dependencyIds.length ?? 0) === 1
        ? 'Dependencia eliminada exitosamente.'
        : 'Dependencias eliminadas exitosamente.',
  }),
  'move-nodes': command<{ kind: 'move-nodes'; positions: readonly RoadmapNodePlacement[] }>(
    nodeMoves,
  ),
  'apply-automatic-layout': command<{
    kind: 'apply-automatic-layout';
    positions: readonly RoadmapNodePlacement[];
    direction: RoadmapLayoutDirection;
  }>({
    ...nodeMoves,
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: () => roadmapAutoLayoutConfirmation,
    },
    success: () => 'Nodos ordenados exitosamente.',
  }),
  'add-node': command<{ kind: 'add-node'; node: NewRoadmapNode; position: RoadmapNodePosition }>({
    requests: ({ node, position }) => ({
      method: 'POST',
      path: '/nodes',
      body: {
        ...node,
        description: node.description || null,
        positionX: position.x,
        positionY: position.y,
      },
    }),
    failure: 'No se pudo crear el nodo.',
    result: async ([response]) => ({ createdNodeId: (await response.json()).node.id }),
    practice: (practice, { node, position: requested }) => {
      practice.requireAvailableNodeType(node.nodeTypeId);
      const id = crypto.randomUUID();
      const position = practice.createdNodePosition ?? requested;
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
      practice.appendResource(nodeId, { ...resource, id: crypto.randomUUID() });
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
      }),
    success: () => 'Recurso guardado exitosamente.',
  }),
  'update-resource': command<{
    kind: 'update-resource';
    resourceId: string;
    resource: ResourceInput;
  }>({
    requests: ({ resourceId, resource }) => ({
      method: 'PATCH',
      path: `/resources/${resourceId}`,
      body: resource.type === 'FILE' ? { title: resource.title } : resource,
    }),
    failure: 'No se pudo guardar el recurso.',
    practice: (practice, { resourceId, resource }) =>
      practice.mutateResource(resourceId, (current) => {
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
    practice: (practice, { nodeId }) => void practice.canvasPreviewCompletions.add(nodeId),
    changesCanvasPreview: true,
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeCanvasPreviewNode', nodeId }),
  }),
  'reset-canvas-preview': command<{ kind: 'reset-canvas-preview' }>({
    requests: () => ({ method: 'DELETE', path: '/simulation' }),
    failure: 'No se pudo reiniciar el progreso de previsualización.',
    practice: (practice) => practice.canvasPreviewCompletions.clear(),
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

export type ChangeImpactOf<Kind extends CanvasCommandKind> = EntryTypes[Kind]['impact'];

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
