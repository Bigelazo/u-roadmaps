import { CheckCircle2, Circle, EyeOff, LockKeyhole, Paperclip } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type RoadmapNodeStatus = 'completed' | 'available' | 'locked' | 'editing';
export type RoadmapNodeData = Record<string, unknown> & {
  title: string;
  typeName: string;
  typeColor: string;
  resourceCount: number;
  status: RoadmapNodeStatus;
  isHidden: boolean;
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
  const statusLabel = completed
    ? 'Completado'
    : locked
      ? 'Bloqueado'
      : editing
        ? 'Edición'
        : 'Disponible';
  return (
    <div
      data-slot="roadmap-card"
      className={cn(
        'min-w-[170px] cursor-pointer rounded-lg border-2 px-4 py-3 transition-[border-color,transform,box-shadow] hover:translate-y-[-2px] hover:!border-primary-bright hover:shadow-[var(--shadow-roadmap-node-hover)] motion-reduce:transform-none motion-reduce:transition-none',
        hidden
          ? 'bg-cloud'
          : locked
            ? 'bg-cloud opacity-[0.88] shadow-none'
            : 'bg-card shadow-[var(--shadow-roadmap-node)]',
      )}
      style={{ borderColor: accent }}
    >
      <div className="mb-5 flex items-center justify-between gap-2.5">
        {hidden ? (
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
        </div>
      </div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: data.typeColor }} />
        <span>{data.typeName}</span>
        {data.resourceCount ? (
          <Badge
            variant="link"
            className="nodrag ml-auto h-auto min-h-5 text-right whitespace-normal"
          >
            <Paperclip data-icon="inline-start" aria-hidden="true" />
            <span className="sr-only">Ver </span>
            {data.resourceCount} {data.resourceCount === 1 ? 'recurso' : 'recursos'}
          </Badge>
        ) : null}
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
