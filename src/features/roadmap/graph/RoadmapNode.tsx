import {
  CircleCheckBig,
  CircleEllipsis,
  Eye,
  EyeOff,
  FileText,
  Link2,
  LockKeyhole,
  LockKeyholeOpen,
  Settings,
  X,
} from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import type { NodeAccessActionOperation } from '@/features/roadmap/graph/node-action';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import styles from './NodeActionMenu.module.css';
import { cn } from 'cn';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
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
  onToggleActionMenu?: (nodeId: string, trigger: HTMLButtonElement) => void;
  onRequestAccessAction?: (nodeId: string, operation: NodeAccessActionOperation) => void;
  onRequestVisibilityAction?: (nodeId: string, isVisible: boolean) => void;
};

export type RoadmapFlowNode = Node<RoadmapNodeData, 'roadmap'>;

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
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <span
            className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="img"
            aria-label={name}
            tabIndex={0}
          />
        }
      >
        <NodeTypeIcon icon={icon} size={20} color={color} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

function StudentStatusBadge({ status }: Pick<RoadmapNodeData, 'status'>) {
  if (status === 'editing') return null;

  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';
  const label = isLocked ? 'Bloqueado' : isCompleted ? 'Completado' : 'Pendiente';
  const Icon = isLocked ? LockKeyhole : isCompleted ? CircleCheckBig : CircleEllipsis;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <span
            className="absolute right-[-10px] bottom-[-10px] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm transition-[transform,box-shadow,background-color] duration-150 ease-out hover:scale-110 hover:bg-muted hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none data-open:scale-110 data-open:bg-muted data-open:shadow-md"
            role="img"
            aria-label={label}
            tabIndex={0}
          />
        }
      >
        <Icon
          className="size-5"
          color={isLocked ? 'var(--graphite)' : isCompleted ? 'var(--progress-deep)' : 'var(--ink)'}
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function TeacherBlockBadge() {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <span
            className="absolute right-[-10px] bottom-[-10px] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="img"
            aria-label="Bloqueado por docencia"
            tabIndex={0}
          />
        }
      >
        <LockKeyhole className="size-5" color="var(--graphite)" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Bloqueado por docencia</TooltipContent>
    </Tooltip>
  );
}

function HiddenBadge() {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <span
            className="absolute right-[-10px] bottom-[-10px] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="img"
            aria-label="Oculto para estudiantes"
            tabIndex={0}
          />
        }
      >
        <EyeOff className="size-5" color="var(--graphite)" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Oculto para estudiantes</TooltipContent>
    </Tooltip>
  );
}

function NodeActionMenu({
  nodeId,
  hidden,
  teacherBlocked,
  isOpen,
  isClosing,
  onToggle,
  onRequestAccessAction,
  onRequestVisibilityAction,
}: {
  nodeId: string;
  hidden: boolean;
  teacherBlocked: boolean;
  isOpen: boolean;
  isClosing: boolean;
  onToggle?: (nodeId: string, trigger: HTMLButtonElement) => void;
  onRequestAccessAction?: (nodeId: string, operation: NodeAccessActionOperation) => void;
  onRequestVisibilityAction?: (nodeId: string, isVisible: boolean) => void;
}) {
  const ClosedIcon = hidden ? EyeOff : teacherBlocked ? LockKeyhole : Settings;
  const accessLabel = teacherBlocked ? 'Desbloquear' : 'Bloquear rama';
  const visibilityLabel = hidden ? 'Mostrar para estudiantes' : 'Ocultar para estudiantes';

  return (
    <div className="absolute right-[-10px] bottom-[-10px] z-10 hidden lg:block">
      {isOpen ? (
        <div
          aria-label="Menú de acciones del nodo"
          className="pointer-events-none absolute inset-0"
        >
          {!hidden ? (
            <Tooltip>
              <TooltipTrigger
                delay={200}
                render={
                  <button
                    type="button"
                    aria-label={accessLabel}
                    className={cn(
                      styles.actionButton,
                      isClosing && styles.actionButtonClosing,
                      'group pointer-events-auto absolute top-0 left-[4.25rem] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card text-graphite shadow-md transition-all duration-240 hover:scale-110 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestAccessAction?.(nodeId, teacherBlocked ? 'UNBLOCK' : 'BLOCK');
                    }}
                  />
                }
              >
                {teacherBlocked ? (
                  <>
                    <LockKeyhole
                      aria-hidden="true"
                      className="size-4 group-hover:hidden group-focus-visible:hidden"
                    />
                    <LockKeyholeOpen
                      aria-hidden="true"
                      className="hidden size-4 group-hover:block group-focus-visible:block"
                    />
                  </>
                ) : (
                  <>
                    <LockKeyholeOpen
                      aria-hidden="true"
                      className="size-4 group-hover:hidden group-focus-visible:hidden"
                    />
                    <LockKeyhole
                      aria-hidden="true"
                      className="hidden size-4 group-hover:block group-focus-visible:block"
                    />
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">{accessLabel}</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              delay={200}
              render={
                <button
                  type="button"
                  aria-label={visibilityLabel}
                  data-slot="node-action-visibility"
                  className={cn(
                    styles.actionButton,
                    isClosing && styles.actionButtonClosing,
                    'group pointer-events-auto absolute top-6 left-[3.7rem] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card text-graphite shadow-md transition-all duration-240 hover:scale-110 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRequestVisibilityAction?.(nodeId, !hidden);
                  }}
                />
              }
            >
              {hidden ? (
                <>
                  <EyeOff
                    aria-hidden="true"
                    data-testid="visibility-current-icon"
                    className="size-4 group-hover:hidden group-focus-visible:hidden"
                  />
                  <Eye
                    aria-hidden="true"
                    data-testid="visibility-result-icon"
                    className="hidden size-4 group-hover:block group-focus-visible:block"
                  />
                </>
              ) : (
                <>
                  <Eye
                    aria-hidden="true"
                    data-testid="visibility-current-icon"
                    className="size-4 group-hover:hidden group-focus-visible:hidden"
                  />
                  <EyeOff
                    aria-hidden="true"
                    data-testid="visibility-result-icon"
                    className="hidden size-4 group-hover:block group-focus-visible:block"
                  />
                </>
              )}
            </TooltipTrigger>
            <TooltipContent side="right">{visibilityLabel}</TooltipContent>
          </Tooltip>
          <span
            aria-hidden="true"
            data-slot="node-action-resource"
            data-testid="node-action-resource-slot"
            className="absolute top-[3.7rem] left-6 size-8 rounded-full"
          />
          <span
            aria-hidden="true"
            data-slot="node-action-delete"
            data-testid="node-action-delete-slot"
            className="absolute top-[4.25rem] left-0 size-8 rounded-full"
          />
        </div>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          delay={200}
          render={
            <button
              type="button"
              aria-label={
                isOpen ? 'Cerrar menú de acciones del nodo' : 'Abrir menú de acciones del nodo'
              }
              aria-expanded={isOpen}
              className="nodrag nopan flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm transition-[transform,box-shadow,background-color] duration-150 ease-out hover:scale-110 hover:bg-muted hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onToggle?.(nodeId, event.currentTarget);
              }}
            />
          }
        >
          {isOpen ? (
            <X
              data-testid="node-action-trigger-close"
              className={cn(
                'size-5 transition-all duration-150',
                isClosing && 'scale-75 opacity-0',
              )}
              aria-hidden="true"
            />
          ) : (
            <ClosedIcon
              data-testid={`node-action-trigger-${hidden ? 'hidden' : teacherBlocked ? 'blocked' : 'default'}`}
              className="size-5"
              aria-hidden="true"
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isOpen ? 'Cerrar acciones' : 'Acciones del nodo'}
        </TooltipContent>
      </Tooltip>
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

  return (
    <div
      data-testid="roadmap-node-resources"
      className="absolute bottom-3 left-4 flex items-center gap-2.5 text-xs font-bold tabular-nums"
    >
      {resourceGroups.map(({ count, Icon, label, className }) => (
        <Tooltip key={label}>
          <TooltipTrigger
            delay={0}
            render={
              <span
                className={cn(
                  'flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  className,
                )}
                role="img"
                aria-label={label}
                tabIndex={0}
              />
            }
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span aria-hidden="true">{count}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function RoadmapNode({ id, data, selected }: NodeProps<RoadmapFlowNode>) {
  const size = roadmapNodeSizeForTitle(data.title);
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const teacherBlocked = editing && data.isTeacherBlocked;
  const surface = hidden || locked || teacherBlocked ? 'var(--cloud)' : '#fff';
  return (
    <div
      data-slot="roadmap-card"
      data-testid="roadmap-card"
      data-hidden={hidden || undefined}
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
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: surface,
        backgroundImage: hidden
          ? `repeating-linear-gradient(-45deg, transparent 0, transparent 9px, color-mix(in srgb, ${data.typeColor} 11%, transparent) 9px, color-mix(in srgb, ${data.typeColor} 11%, transparent) 11px)`
          : undefined,
        borderColor: data.typeColor,
      }}
    >
      <div
        data-testid="roadmap-node-content"
        className="flex h-full items-center justify-center gap-2.5"
      >
        <NodeTypeBadge icon={data.typeIcon} name={data.typeName} color={data.typeColor} />
        <p
          title={data.title}
          className="min-w-0 text-left text-[15.5px] leading-tight font-medium wrap-break-word text-ink"
        >
          {data.title}
        </p>
      </div>
      <NodeResourceSummary fileCount={data.fileCount} linkCount={data.linkCount} />
      {data.canManageActions ? (
        <NodeActionMenu
          nodeId={id}
          hidden={hidden}
          teacherBlocked={teacherBlocked}
          isOpen={Boolean(data.isActionMenuOpen)}
          isClosing={Boolean(data.isActionMenuClosing)}
          onToggle={data.onToggleActionMenu}
          onRequestAccessAction={data.onRequestAccessAction}
          onRequestVisibilityAction={data.onRequestVisibilityAction}
        />
      ) : hidden ? (
        <HiddenBadge />
      ) : teacherBlocked ? (
        <TeacherBlockBadge />
      ) : (
        <StudentStatusBadge status={data.status} />
      )}
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
              isConnectable={editing}
              style={{
                width: 12,
                height: 12,
                background: 'var(--primary)',
                border: '2px solid var(--card)',
                visibility: editing ? 'visible' : 'hidden',
                pointerEvents: editing ? 'auto' : 'none',
              }}
            />
          ))
        : null}
    </div>
  );
}
