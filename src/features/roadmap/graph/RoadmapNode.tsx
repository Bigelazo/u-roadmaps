import { CircleCheckBig, CircleEllipsis, LockKeyhole } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import { studentNodeBlockMessages } from '@/features/roadmap/student/node-status';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from 'cn';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
  typeColor: string;
  typeName: string;
  typeIcon: string;
  status: RoadmapNodeStatus;
  isHidden: boolean;
  blockReason?: StudentNodeBlockReason;
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
        render={
          <span
            className="absolute right-[-10px] bottom-[-10px] flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="img"
            aria-label={label}
            tabIndex={0}
          />
        }
      >
        <Icon
          className="size-5"
          color={isLocked ? 'var(--steel)' : isCompleted ? 'var(--progress-deep)' : 'var(--ink)'}
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RoadmapNode({ data, selected }: NodeProps<RoadmapFlowNode>) {
  const size = roadmapNodeSizeForTitle(data.title);
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const blockMessage = data.blockReason ? studentNodeBlockMessages[data.blockReason] : undefined;
  const surface = hidden || locked ? 'var(--cloud)' : '#fff';
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
              'cursor-pointer transition-[transform,box-shadow] hover:translate-y-[-2px] hover:shadow-[var(--shadow-roadmap-node-hover)]',
              !hidden && 'shadow-[var(--shadow-roadmap-node)]',
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
        className={cn(
          'flex items-center gap-2.5',
          blockMessage ? 'h-[calc(100%-2.75rem)]' : 'h-full',
        )}
      >
        <NodeTypeBadge icon={data.typeIcon} name={data.typeName} color={data.typeColor} />
        <p
          title={data.title}
          className="line-clamp-2 min-w-0 text-left text-[15.5px] leading-[1.25] font-medium text-ink"
        >
          {data.title}
        </p>
      </div>
      {blockMessage ? (
        <p className="absolute right-4 bottom-3 left-4 line-clamp-2 flex items-center gap-1.5 text-xs leading-snug font-semibold text-graphite">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
          {blockMessage}
        </p>
      ) : null}
      <StudentStatusBadge status={data.status} />
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
