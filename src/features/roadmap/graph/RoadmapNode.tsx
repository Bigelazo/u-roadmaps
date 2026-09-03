import { CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { studentNodeBlockMessages } from '@/features/roadmap/student/node-status';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import { cn } from '@/shared/lib/utils';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
  typeColor: string;
  typeName: string;
  status: RoadmapNodeStatus;
  isHidden: boolean;
  blockReason?: StudentNodeBlockReason;
};

export type RoadmapFlowNode = Node<RoadmapNodeData, 'roadmap'>;

export function RoadmapNode({ data }: NodeProps<RoadmapFlowNode>) {
  const size = roadmapNodeSizeForTitle(data.title);
  const completed = data.status === 'completed';
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const blockMessage = data.blockReason ? studentNodeBlockMessages[data.blockReason] : undefined;
  const accent = completed
    ? 'var(--progress-deep)'
    : locked
      ? 'var(--steel)'
      : data.status === 'available'
        ? 'var(--ink)'
        : 'var(--primary)';
  const statusLabel = completed
    ? 'Completado'
    : locked
      ? (blockMessage ?? 'Bloqueado')
      : 'Disponible';
  // El tipo se lee en el color de la tarjeta: el borde lo lleva saturado y el
  // fondo la misma tinta sobre la superficie, sin gastar una línea en una
  // etiqueta. Las tarjetas bloqueadas y ocultas apagan la superficie.
  const surface = hidden || locked ? 'var(--cloud)' : 'var(--card)';
  return (
    <div
      data-slot="roadmap-card"
      data-testid="roadmap-card"
      data-hidden={hidden || undefined}
      aria-label={hidden ? `${data.title}: oculto para estudiantes` : undefined}
      aria-disabled={locked ? true : undefined}
      className={cn(
        'relative box-border rounded-lg border-2 px-4 py-3 motion-reduce:transform-none motion-reduce:transition-none',
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
        backgroundColor: `color-mix(in srgb, ${data.typeColor} 14%, ${surface})`,
        backgroundImage: hidden
          ? `repeating-linear-gradient(-45deg, transparent 0, transparent 9px, color-mix(in srgb, ${data.typeColor} 11%, transparent) 9px, color-mix(in srgb, ${data.typeColor} 11%, transparent) 11px)`
          : undefined,
        borderColor:
          hidden || locked
            ? `color-mix(in srgb, ${data.typeColor} 55%, ${surface})`
            : data.typeColor,
      }}
    >
      <span className="sr-only">{data.typeName}</span>
      <div className="flex items-start gap-2.5">
        <span className="shrink-0" role="img" aria-label={statusLabel}>
          {completed ? (
            <CheckCircle2
              size={24}
              color="var(--progress-deep)"
              fill="var(--progress-deep)"
              stroke="var(--card)"
              aria-hidden="true"
            />
          ) : locked ? (
            <LockKeyhole size={20} aria-hidden="true" />
          ) : (
            <Circle size={20} fill="var(--primary-soft)" stroke={accent} aria-hidden="true" />
          )}
        </span>
        <p
          title={data.title}
          className="min-w-0 break-words text-[15.5px] leading-[1.25] font-medium text-ink"
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
