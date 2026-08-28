import { CheckCircle2, Circle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
  typeColor: string;
  status: RoadmapNodeStatus;
  isHidden: boolean;
  onToggleVisibility?: () => void;
};

export type RoadmapFlowNode = Node<RoadmapNodeData, 'roadmap'>;

export function RoadmapNode({ data }: NodeProps<RoadmapFlowNode>) {
  const completed = data.status === 'completed';
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const accent = completed
    ? 'var(--progress-deep)'
    : locked
      ? 'var(--steel)'
      : data.status === 'available'
        ? 'var(--ink)'
        : 'var(--primary)';
  const surface = hidden || locked ? 'var(--cloud)' : 'var(--card)';
  const statusLabel = completed ? 'Completado' : locked ? 'Bloqueado' : 'Disponible';
  return (
    <div
      data-slot="roadmap-card"
      className={cn(
        'min-w-[170px] cursor-pointer rounded-lg border-2 border-transparent px-4 py-3 transition-[transform,box-shadow] hover:translate-y-[-2px] hover:shadow-[var(--shadow-roadmap-node-hover)] motion-reduce:transform-none motion-reduce:transition-none',
        hidden
          ? ''
          : locked
            ? 'opacity-[0.88] shadow-none'
            : 'shadow-[var(--shadow-roadmap-node)]',
      )}
      style={{
        backgroundImage: `linear-gradient(${surface}, ${surface}), linear-gradient(45deg, ${accent}, ${data.typeColor})`,
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }}
    >
      <div className={cn('flex items-center justify-between gap-2.5', editing ? 'mb-3' : 'mb-5')}>
        {editing ? (
          <button
            type="button"
            className={cn(
              'nodrag nopan flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              hidden && 'border-graphite/25 bg-fog text-graphite',
            )}
            aria-label={hidden ? 'Mostrar a estudiantes' : 'Ocultar para estudiantes'}
            title={hidden ? 'Mostrar a estudiantes' : 'Ocultar para estudiantes'}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggleVisibility?.();
            }}
          >
            {hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        ) : hidden ? (
          <EyeOff size={19} color="var(--graphite)" aria-hidden="true" />
        ) : completed ? (
          <CheckCircle2
            size={20}
            color="var(--progress-deep)"
            fill="var(--progress-deep)"
            stroke="var(--card)"
          />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="var(--primary-soft)" stroke={accent} />
        )}
        <div className="flex flex-wrap justify-end gap-1">
          {hidden ? (
            <Badge variant="secondary" className="bg-fog text-graphite">
              Oculto para estudiantes
            </Badge>
          ) : null}
          {!editing ? (
            <Badge
              className={
                completed
                  ? 'bg-progress-soft text-progress-deep'
                  : locked
                    ? 'bg-cloud text-graphite'
                    : 'bg-primary-soft text-primary-deep'
              }
            >
              {statusLabel}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="text-[15.5px] leading-[1.25] font-medium text-ink">{data.title}</p>
      {(
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
            visibility: editing ? 'visible' : 'hidden',
          }}
        />
      ))}
    </div>
  );
}

export const roadmapNodeTypes = { roadmap: RoadmapNode } as NodeTypes;
