import { CheckCircle2, Circle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { studentNodeBlockMessages } from '@/features/roadmap/student/node-status';
import type { StudentNodeBlockReason } from '@/lib/roadmap-access';
import { cn } from '@/lib/utils';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
  typeColor: string;
  typeName: string;
  status: RoadmapNodeStatus;
  isHidden: boolean;
  blockReason?: StudentNodeBlockReason;
  onToggleVisibility?: () => void;
};

export type RoadmapFlowNode = Node<RoadmapNodeData, 'roadmap'>;

export function RoadmapNode({ data }: NodeProps<RoadmapFlowNode>) {
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
      aria-disabled={locked ? true : undefined}
      className={cn(
        'max-w-[240px] min-w-[170px] rounded-lg border-2 px-4 py-3 motion-reduce:transform-none motion-reduce:transition-none',
        locked
          ? 'cursor-not-allowed opacity-[0.88] shadow-none'
          : cn(
              'cursor-pointer transition-[transform,box-shadow] hover:translate-y-[-2px] hover:shadow-[var(--shadow-roadmap-node-hover)]',
              !hidden && 'shadow-[var(--shadow-roadmap-node)]',
            ),
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${data.typeColor} 14%, ${surface})`,
        borderColor:
          hidden || locked
            ? `color-mix(in srgb, ${data.typeColor} 55%, ${surface})`
            : data.typeColor,
      }}
    >
      <span className="sr-only">{data.typeName}</span>
      <div className="flex items-center gap-2.5">
        {editing ? (
          <button
            type="button"
            className={cn(
              'nodrag nopan flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              hidden && 'border-graphite/25 bg-fog text-graphite',
            )}
            aria-label={hidden ? 'Mostrar a estudiantes' : 'Ocultar para estudiantes'}
            title={hidden ? 'Mostrar a estudiantes' : 'Ocultar para estudiantes'}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleVisibility?.();
            }}
          >
            {hidden ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : hidden ? (
          <EyeOff className="shrink-0" size={20} color="var(--graphite)" aria-hidden="true" />
        ) : (
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
        )}
        <p className="text-[15.5px] leading-[1.25] font-medium text-ink">{data.title}</p>
      </div>
      {hidden ? (
        <Badge variant="secondary" className="mt-2.5 bg-fog text-graphite">
          Oculto para estudiantes
        </Badge>
      ) : null}
      {blockMessage ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs leading-snug font-semibold text-graphite">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
          {blockMessage}
        </p>
      ) : null}
      {editing
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
              type="source"
              position={position}
              style={{
                width: 12,
                height: 12,
                background: 'var(--primary)',
                border: '2px solid var(--card)',
              }}
            />
          ))
        : null}
    </div>
  );
}
