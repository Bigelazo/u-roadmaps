import type { ChangeImpactOf as PlannedChangeImpactOf } from '@/features/roadmap/domain/change-impact';
import { chileWallClock } from '@/features/roadmap/domain/scheduled-unlock';
import type { NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import type {
  CanvasCommand,
  CanvasCommandKind,
  CanvasCommandOf,
} from '@/features/roadmap/canvas/commands/canvas-command';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type { ExecutionResult, PracticeCanvasAction } from '@/features/roadmap/session/types';
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
  TeacherBlockOperation,
  TeacherBlockOperationImpact,
} from '@/features/roadmap/types';

type TeacherBlockChangeImpact = {
  readonly [Operation in TeacherBlockOperation]?: TeacherBlockOperationImpact;
};

type ImpactRead<Kind> = Kind extends keyof PlannedChangeImpactOf
  ? PlannedChangeImpactOf[Kind]
  : never;

type CommandSession<Command extends { kind: string }> = {
  readChangeImpact(command: Command): Promise<ImpactRead<Command['kind']> | null>;
  execute(
    command: Command,
    changeImpactVersion?: string,
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
  readonly changesCanvasPreview?: true;
  shownBeforeRefresh?(command: Command, result: ExecutionResult): RoadmapUpdate | null;
  success?(command: Command, outcome: CommandOutcome, impact?: Impact | null): string;
  report?(command: Command, outcome: CommandOutcome): PracticeCanvasAction | null;
  readonly confirmedAction?: ConfirmedAction<Command, Impact>;
};

export type RoadmapUpdate = <Roadmap extends AnyRoadmapDto>(roadmap: Roadmap) => Roadmap;

const command = <Kind extends CanvasCommandKind, Impact = ImpactRead<Kind>>(
  entry: CommandEntry<CanvasCommandOf<Kind>, Impact>,
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

const layoutDirectionByChoice: Partial<
  Readonly<Record<CanvasConfirmationChoice, RoadmapLayoutDirection>>
> = {
  [canvasConfirmationChoices.autoLayoutVertical]: 'TB',
  [canvasConfirmationChoices.autoLayoutHorizontal]: 'LR',
};

const visibility = (isVisible: boolean) => ({
  report: ({ nodeId }: { readonly nodeId: string }): PracticeCanvasAction => ({
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

export const canvasCommandCatalog = {
  'hide-node': command<'hide-node'>({
    ...visibility(false),
    confirmedAction: {
      impact: readChangeImpact,
      apply: executeAsRequested,
      confirmation: ({ nodeId }, impact, roadmap) =>
        visibilityConfirmation(roadmap, nodeId, true, impact?.dependencies),
    },
    success: () => 'Nodo ocultado exitosamente.',
  }),
  'show-node': command<'show-node'>({
    ...visibility(true),
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: ({ nodeId }, _, roadmap) => visibilityConfirmation(roadmap, nodeId, false),
    },
    success: () => 'Nodo visible para estudiantes.',
  }),
  'delete-node': command<'delete-node'>({
    confirmedAction: {
      draftGuard: ({ nodeId }) => ({ kind: 'delete-node', nodeId }),
      impact: readChangeImpact,
      apply: executeAsRequested,
      confirmation: (_, impact) => (impact ? nodeDeletionConfirmation(impact) : null),
    },
    success: () => 'Nodo eliminado exitosamente.',
    report: ({ nodeId }) => ({ type: 'deleteNode', nodeId }),
  }),
  'change-teacher-block': command<'change-teacher-block', TeacherBlockChangeImpact>({
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
  'schedule-teacher-unlock': command<'schedule-teacher-unlock'>({
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
  'create-dependency': command<'create-dependency'>({
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
  'delete-dependencies': command<'delete-dependencies'>({
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
  'move-nodes': command<'move-nodes'>({}),
  'apply-automatic-layout': command<'apply-automatic-layout'>({
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
  'add-node': command<'add-node'>({
    success: () => 'Nodo creado exitosamente.',
    report: (_, { createdNodeId }) =>
      createdNodeId ? { type: 'addNode', nodeId: createdNodeId } : null,
  }),
  'update-node': command<'update-node'>({
    success: () => 'Cambios guardados exitosamente.',
  }),
  'add-resource': command<'add-resource'>({
    success: () => 'Enlace guardado exitosamente.',
  }),
  'upload-resource': command<'upload-resource'>({
    success: () => 'Recurso guardado exitosamente.',
  }),
  'update-resource': command<'update-resource'>({
    success: ({ resource }) =>
      resource.type === 'LINK' ? 'Enlace guardado exitosamente.' : 'Recurso guardado exitosamente.',
  }),
  'delete-resource': command<'delete-resource'>({
    success: () => 'Recurso eliminado exitosamente.',
  }),
  'add-node-type': command<'add-node-type'>({
    success: () => 'Tipo de nodo creado exitosamente.',
  }),
  'update-node-type': command<'update-node-type'>({
    success: () => 'Tipo de nodo guardado exitosamente.',
  }),
  'delete-node-type': command<'delete-node-type'>({
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: ({ nodeTypeId }, _, roadmap) => {
        const nodeType = roadmap.nodeTypes.find(({ id }) => id === nodeTypeId);
        return nodeType ? nodeTypeDeletionConfirmation(nodeType) : null;
      },
    },
    success: () => 'Tipo de nodo eliminado exitosamente.',
  }),
  'complete-node': command<'complete-node'>({
    success: completionSuccess,
  }),
  'complete-canvas-preview-node': command<'complete-canvas-preview-node'>({
    changesCanvasPreview: true,
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeCanvasPreviewNode', nodeId }),
  }),
  'reset-canvas-preview': command<'reset-canvas-preview'>({
    changesCanvasPreview: true,
    confirmedAction: {
      apply: executeAsRequested,
      confirmation: () => canvasPreviewResetConfirmation,
    },
    success: () => 'Progreso de previsualización reiniciado.',
  }),
};

type ChangeImpactOf<Kind extends CanvasCommandKind> = {
  [Each in Kind]: (typeof canvasCommandCatalog)[Each] extends CommandEntry<
    CanvasCommandOf<Each>,
    infer Impact
  >
    ? Impact
    : never;
}[Kind];

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
