import {
  CircleCheckBig,
  CircleEllipsis,
  EyeOff,
  FileText,
  Link2,
  LockKeyhole,
  Settings,
  X,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import type { NodeActionCallbacks } from '@/features/roadmap/graph/node-action';
import { nodeMenuActions } from '@/features/roadmap/graph/node-menu-actions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import styles from './NodeActionMenu.module.css';
import { cn } from 'cn';
import { formatBadgeCount } from '@/shared/badge-count';
import { useNodeChangeCount } from '@/features/notifications/client';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> &
  NodeActionCallbacks & {
    title: string;
    roadmapId?: string;
    notificationsEnabled?: boolean;
    typeColor: string;
    typeName: string;
    typeIcon: string;
    status: RoadmapNodeStatus;
    isHidden: boolean;
    isTeacherBlocked: boolean;
    fileCount?: number;
    linkCount?: number;
    blockReason?: StudentNodeBlockReason;
    canManageActions?: boolean;
    isActionMenuOpen?: boolean;
    isActionMenuClosing?: boolean;
    useActionSheet?: boolean;
    onToggleActionMenu?: (nodeId: string, trigger: HTMLButtonElement) => void;
  };

export type RoadmapFlowNode = Node<RoadmapNodeData, 'roadmap'>;

/** Changes stay marked after the Roadmap entry recognizes them, until this Node is opened. */
function NodeChangeBadge({ nodeId }: { nodeId: string }) {
  const count = useNodeChangeCount(nodeId);
  if (!count) return null;
  const label = `${count} ${count === 1 ? 'cambio' : 'cambios'} sin revisar`;
  return (
    <span
      aria-label={label}
      title={label}
      role="img"
      className="absolute top-[-10px] left-[-10px] z-10 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-destructive px-1 text-xs leading-none font-bold text-white tabular-nums shadow-sm"
    >
      {formatBadgeCount(count)}
    </span>
  );
}

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

/** A focusable icon that names itself and shows that name in a tooltip. */
function StatusIconBadge({
  label,
  side,
  className,
  children,
}: {
  label: string;
  side?: TooltipSide;
  className: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={<span className={className} role="img" aria-label={label} tabIndex={0} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

const cornerBadgeClassName =
  'absolute right-[-10px] bottom-[-10px] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm';
const badgeFocusClassName =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function NodeTypeBadge({
  icon,
  name,
  color,
}: {
  icon: RoadmapNodeData['typeIcon'];
  name: RoadmapNodeData['typeName'];
  color: RoadmapNodeData['typeColor'];
}) {
  return (
    <StatusIconBadge
      label={name}
      className={cn('shrink-0 rounded-sm outline-none', badgeFocusClassName)}
    >
      <NodeTypeIcon icon={icon} size={20} color={color} aria-hidden="true" />
    </StatusIconBadge>
  );
}

function StudentStatusBadge({ status }: Pick<RoadmapNodeData, 'status'>) {
  if (status === 'editing') return null;

  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';
  const label = isLocked ? 'Bloqueado' : isCompleted ? 'Completado' : 'Pendiente';
  const Icon = isLocked ? LockKeyhole : isCompleted ? CircleCheckBig : CircleEllipsis;

  return (
    <StatusIconBadge
      label={label}
      side="bottom"
      className={cn(
        cornerBadgeClassName,
        'transition-[transform,box-shadow,background-color] duration-150 ease-out hover:scale-110 hover:bg-muted hover:shadow-md',
        badgeFocusClassName,
        'motion-reduce:transform-none motion-reduce:transition-none data-open:scale-110 data-open:bg-muted data-open:shadow-md',
      )}
    >
      <Icon
        className="size-5"
        color={isLocked ? 'var(--graphite)' : isCompleted ? 'var(--progress-deep)' : 'var(--ink)'}
        aria-hidden="true"
      />
    </StatusIconBadge>
  );
}

const staffStateBadges = {
  teacherBlocked: { label: 'Bloqueado por docencia', Icon: LockKeyhole },
  hidden: { label: 'Oculto para estudiantes', Icon: EyeOff },
};

function StaffStateBadge({ state }: { state: keyof typeof staffStateBadges }) {
  const { label, Icon } = staffStateBadges[state];
  return (
    <StatusIconBadge
      label={label}
      side="bottom"
      className={cn(cornerBadgeClassName, 'outline-none', badgeFocusClassName)}
    >
      <Icon className="size-5" color="var(--graphite)" aria-hidden="true" />
    </StatusIconBadge>
  );
}

type NodeMenuAction = ReturnType<typeof nodeMenuActions>[number];

function NodeActionMenuItem({
  action: { id, label, Icon, HoverIcon, onSelect, angle },
  index,
  total,
}: {
  action: NodeMenuAction;
  index: number;
  total: number;
}) {
  const itemStyle = {
    '--i': index,
    '--total': total,
    '--angle': `${angle}deg`,
  } as CSSProperties;
  return (
    <div className={styles.actionItem} style={itemStyle}>
      <Tooltip>
        <TooltipTrigger
          delay={200}
          render={
            <button
              type="button"
              aria-label={label}
              data-slot={id === 'visibility' ? 'node-action-visibility' : undefined}
              data-angle={id === 'resource' ? 60 : undefined}
              className={cn(
                styles.actionButton,
                id === 'resource' && styles.resourceAction,
                id === 'delete' && styles.deleteAction,
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
            >
              {HoverIcon ? (
                <span className={styles.actionIcon} aria-hidden="true">
                  <Icon
                    className={cn('size-4', styles.actionDefaultIcon)}
                    data-testid={`node-action-${id}-default-icon`}
                  />
                  <HoverIcon
                    className={cn('size-4', styles.actionHoverIcon)}
                    data-testid={`node-action-${id}-hover-icon`}
                  />
                </span>
              ) : (
                <Icon aria-hidden="true" className="size-4" />
              )}
            </button>
          }
        />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </div>
  );
}

type NodeActionTriggerProps = {
  nodeId: string;
  hidden: boolean;
  teacherBlocked: boolean;
  isOpen: boolean;
  isClosing: boolean;
  useActionSheet: boolean;
  onToggle?: (nodeId: string, trigger: HTMLButtonElement) => void;
};

function NodeActionTriggerIcon({
  hidden,
  teacherBlocked,
  isOpen,
  isClosing,
}: Pick<NodeActionTriggerProps, 'hidden' | 'teacherBlocked' | 'isOpen' | 'isClosing'>) {
  if (isOpen) {
    return (
      <X
        data-testid="node-action-trigger-close"
        className={cn('size-5 transition-all duration-150', isClosing && 'scale-75 opacity-0')}
        aria-hidden="true"
      />
    );
  }

  const state = hidden ? 'hidden' : teacherBlocked ? 'blocked' : 'default';
  const Icon = { hidden: EyeOff, blocked: LockKeyhole, default: Settings }[state];
  return (
    <Icon data-testid={`node-action-trigger-${state}`} className="size-5" aria-hidden="true" />
  );
}

function NodeActionTrigger({
  nodeId,
  hidden,
  teacherBlocked,
  isOpen,
  isClosing,
  useActionSheet,
  onToggle,
}: NodeActionTriggerProps) {
  const trigger = (
    <button
      type="button"
      aria-label={isOpen ? 'Cerrar menú de acciones del nodo' : 'Abrir menú de acciones del nodo'}
      aria-expanded={isOpen}
      aria-haspopup={useActionSheet ? 'dialog' : undefined}
      aria-controls={`node-actions-${nodeId}`}
      className={cn('nodrag nopan', styles.actionTrigger, useActionSheet && styles.touchTrigger)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.(nodeId, event.currentTarget);
      }}
    >
      <NodeActionTriggerIcon
        hidden={hidden}
        teacherBlocked={teacherBlocked}
        isOpen={isOpen}
        isClosing={isClosing}
      />
    </button>
  );

  if (useActionSheet) return trigger;

  return (
    <Tooltip>
      <TooltipTrigger delay={200} render={trigger} />
      <TooltipContent side="bottom">
        {isOpen ? 'Cerrar acciones' : 'Acciones del nodo'}
      </TooltipContent>
    </Tooltip>
  );
}

function NodeActionMenu({
  nodeId,
  hidden,
  teacherBlocked,
  isOpen,
  isClosing,
  useActionSheet,
  onToggle,
  onAction,
}: NodeActionCallbacks & NodeActionTriggerProps) {
  const actions = nodeMenuActions(nodeId, hidden, teacherBlocked, onAction);

  return (
    <div
      className={cn(
        'absolute right-[-10px] bottom-[-10px] z-10',
        !useActionSheet && 'hidden lg:block',
      )}
    >
      {isOpen && !useActionSheet ? (
        <div
          aria-label="Menú de acciones del nodo"
          className={cn(styles.menuRing, isClosing ? styles.menuRingClosing : styles.menuRingOpen)}
          id={`node-actions-${nodeId}`}
          role="group"
        >
          {actions.map((action, index) => (
            <NodeActionMenuItem
              key={action.id}
              action={action}
              index={index}
              total={actions.length}
            />
          ))}
        </div>
      ) : null}
      <NodeActionTrigger
        nodeId={nodeId}
        hidden={hidden}
        teacherBlocked={teacherBlocked}
        isOpen={isOpen}
        isClosing={isClosing}
        useActionSheet={useActionSheet}
        onToggle={onToggle}
      />
    </div>
  );
}

function resourceCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function NodeResourceSummary({
  fileCount = 0,
  linkCount = 0,
}: Pick<RoadmapNodeData, 'fileCount' | 'linkCount'>) {
  const resourceGroups = [
    {
      count: fileCount,
      Icon: FileText,
      label: resourceCountLabel(fileCount, 'archivo', 'archivos'),
      className: 'text-graphite',
    },
    {
      count: linkCount,
      Icon: Link2,
      label: resourceCountLabel(linkCount, 'enlace', 'enlaces'),
      className: 'text-primary',
    },
  ].filter((group) => group.count > 0);

  if (!resourceGroups.length) return null;
  const hasSingleResource = resourceGroups.length === 1;

  return (
    <div
      data-testid="roadmap-node-resources"
      className={cn(
        'absolute top-[-10px] right-[-10px] z-10 grid place-items-center rounded-md border-2 border-card bg-card text-xs font-bold tabular-nums shadow-sm',
        hasSingleResource ? 'size-6 grid-cols-1' : 'h-6 w-12 grid-cols-2 gap-1',
      )}
    >
      {resourceGroups.map(({ count, Icon, label, className }) => (
        <StatusIconBadge
          key={label}
          label={label}
          side="bottom"
          className={cn(
            'relative flex size-3 items-center justify-center rounded-sm outline-none',
            badgeFocusClassName,
            className,
          )}
        >
          <Icon className="size-3" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute right-[-3px] bottom-[-3px] rounded-sm bg-card px-0.5 text-[8px] leading-none"
          >
            {count}
          </span>
        </StatusIconBadge>
      ))}
    </div>
  );
}

function NodeActionBadge({ id, data }: Pick<NodeProps<RoadmapFlowNode>, 'id' | 'data'>) {
  const hidden = data.isHidden;
  const teacherBlocked = data.status === 'editing' && data.isTeacherBlocked;
  return (
    <>
      {data.canManageActions ? (
        <NodeActionMenu
          nodeId={id}
          hidden={hidden}
          teacherBlocked={teacherBlocked}
          isOpen={Boolean(data.isActionMenuOpen)}
          isClosing={Boolean(data.isActionMenuClosing)}
          useActionSheet={Boolean(data.useActionSheet)}
          onToggle={data.onToggleActionMenu}
          onAction={data.onAction}
        />
      ) : hidden ? (
        <StaffStateBadge state="hidden" />
      ) : teacherBlocked ? (
        <StaffStateBadge state="teacherBlocked" />
      ) : (
        <StudentStatusBadge status={data.status} />
      )}
    </>
  );
}

function NodeNotificationBadge({ id, data }: Pick<NodeProps<RoadmapFlowNode>, 'id' | 'data'>) {
  // Only a Node its viewer can open can clear the mark. Teaching staff open hidden
  // and Teacher-blocked Nodes; a student cannot open a locked one.
  if (!data.notificationsEnabled || !data.roadmapId || data.status === 'locked') return null;
  return <NodeChangeBadge nodeId={id} />;
}

export function RoadmapNode({ id, data, selected }: NodeProps<RoadmapFlowNode>) {
  const size = roadmapNodeSizeForTitle(data.title);
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const canConnect = editing && Boolean(data.canManageActions);
  const teacherBlocked = editing && data.isTeacherBlocked;
  const blocked = locked || teacherBlocked;
  const nodeColor = blocked ? 'var(--blocked)' : data.typeColor;
  return (
    <div
      data-slot="roadmap-card"
      data-testid="roadmap-card"
      data-hidden={hidden || undefined}
      data-block-reason={data.blockReason}
      aria-label={hidden ? `${data.title}: oculto para estudiantes` : undefined}
      aria-disabled={locked ? true : undefined}
      className={cn(
        'relative box-border rounded-lg border-2 px-4 py-3 motion-reduce:transform-none motion-reduce:transition-none',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        hidden && 'border-dashed',
        locked
          ? 'cursor-not-allowed opacity-[0.88] shadow-none'
          : cn(
              'cursor-pointer transition-shadow hover:shadow-(--shadow-roadmap-node-hover)',
              !hidden && 'shadow-(--shadow-roadmap-node)',
            ),
      )}
      style={
        {
          '--roadmap-node-color': nodeColor,
          width: size.width,
          height: size.height,
          backgroundColor: blocked
            ? 'color-mix(in srgb, var(--blocked) 20%, var(--card))'
            : `color-mix(in srgb, ${data.typeColor} 3%, var(--card))`,
          backgroundImage: hidden
            ? `repeating-linear-gradient(-45deg, transparent 0, transparent 9px, color-mix(in srgb, ${nodeColor} 11%, transparent) 9px, color-mix(in srgb, ${nodeColor} 11%, transparent) 11px)`
            : undefined,
          borderColor: nodeColor,
        } as CSSProperties
      }
    >
      <div
        data-testid="roadmap-node-content"
        className="flex h-full min-w-0 items-center justify-start gap-2.5"
      >
        <NodeTypeBadge icon={data.typeIcon} name={data.typeName} color={nodeColor} />
        <p
          title={data.title}
          className="line-clamp-2 min-w-0 text-left text-[15.5px] leading-tight font-medium wrap-break-word text-ink"
        >
          {data.title}
        </p>
      </div>
      <NodeResourceSummary fileCount={data.fileCount} linkCount={data.linkCount} />
      <NodeActionBadge id={id} data={data} />
      {!hidden
        ? (
            [
              ['top', Position.Top],
              ['right', Position.Right],
              ['bottom', Position.Bottom],
              ['left', Position.Left],
            ] as const
          ).map(([id, position]) => (
            <Handle
              key={id}
              id={id}
              data-testid="roadmap-node-handle"
              type="source"
              position={position}
              isConnectable={canConnect}
              style={{
                width: 12,
                height: 12,
                background: 'var(--primary)',
                border: '2px solid var(--card)',
                visibility: canConnect ? 'visible' : 'hidden',
                pointerEvents: canConnect ? 'auto' : 'none',
              }}
            />
          ))
        : null}
      <NodeNotificationBadge id={id} data={data} />
    </div>
  );
}
